import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import { extractJson } from "../extract-json.js";
import type { TopicStore } from "../../models/topic.js";
import type { FlowInput, ProcessedInputData } from "../../models/types.js";

const log = createLogger("ingest");

/** Max file size for processing (20 MB) */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/** Timeout for external API calls (60 seconds) */
const API_TIMEOUT_MS = 60_000;

/**
 * Process a briefing input asynchronously.
 *
 * Worker Fork Pattern:
 * - No sub-agents spawned
 * - Structured JSON output
 * - Stay in scope (only this one input)
 * - Summary max 500 words, key points max 7
 */
export async function processInput(
  topicStore: TopicStore,
  topicId: string,
  input: FlowInput,
): Promise<void> {
  // Orient-check: skip if already completed or currently processing
  if (input.processed?.status === "completed" || input.processed?.status === "processing") {
    log.debug({ topicId, inputId: input.id, status: input.processed?.status }, "input already processed/processing, skipping");
    return;
  }

  // Mark as processing
  topicStore.updateInputProcessed(topicId, input.id, { status: "processing" });

  try {
    let result: ProcessedInputData;

    switch (input.type) {
      case "url":
        result = await processUrl(input);
        break;
      case "document":
        result = await processDocument(topicStore, topicId, input);
        break;
      case "transcript":
        result = await processAudio(topicStore, topicId, input);
        break;
      case "image":
        result = await processImage(topicStore, topicId, input);
        break;
      case "text":
        result = await processText(input);
        break;
      default:
        result = { status: "completed" };
    }

    result.status = "completed";
    result.processedAt = new Date().toISOString();
    if (input.processed?.userNote) result.userNote = input.processed.userNote;

    topicStore.updateInputProcessed(topicId, input.id, result);
    log.info({ topicId, inputId: input.id, type: input.type }, "input processed");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    topicStore.updateInputProcessed(topicId, input.id, {
      status: "failed",
      error: msg,
      userNote: input.processed?.userNote,
    });
    log.error({ topicId, inputId: input.id, err: error }, "input processing failed");
  }
}

// ── Helpers ──────────────────────────────────────────────

const NOTE_CONTEXT = (note?: string) =>
  note ? `\n\nUser note: The user wants you to focus on: "${note}"` : "";

const SUMMARY_PROMPT = `Return JSON only:
\`\`\`json
{"summary": "2-3 paragraph summary (max 500 words)", "keyPoints": ["point 1", "point 2", ...max 7]}
\`\`\``;

/** Read file with size guard */
function readFileGuarded(filePath: string): Buffer {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large for processing: ${(stat.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB)`);
  }
  return fs.readFileSync(filePath);
}

/** Fetch with timeout via AbortSignal */
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── Per-type processors ──────────────────────────────────

async function processUrl(input: FlowInput): Promise<ProcessedInputData> {
  const note = input.processed?.userNote;

  // Fetch URL content directly (no Agent SDK — avoids tool permission issues in containers)
  const fetchResponse = await fetchWithTimeout(input.content, {
    headers: { "User-Agent": "FlowBoost/1.0 (Content Pipeline)" },
  });

  if (!fetchResponse.ok) {
    throw new Error(`Failed to fetch URL: ${fetchResponse.status} ${fetchResponse.statusText}`);
  }

  const html = await fetchResponse.text();
  // Basic HTML → text: strip tags, collapse whitespace
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);

  if (!textContent || textContent.length < 50) {
    throw new Error("URL returned no readable content");
  }

  const response = await callClaude([
    {
      type: "text",
      text: `Analyze this web page content and provide a summary.${NOTE_CONTEXT(note)}

URL: ${input.content}

Page content:
${textContent}

${SUMMARY_PROMPT}
Also include "fetchedContent": the first 2000 characters of readable text from the page.`,
    },
  ]);

  const parsed = extractJson<{ summary: string; keyPoints: string[]; fetchedContent?: string }>(response);
  return {
    status: "completed",
    summary: parsed.summary,
    keyPoints: parsed.keyPoints?.slice(0, 7),
    fetchedContent: parsed.fetchedContent?.slice(0, 3000),
  };
}

async function processDocument(
  topicStore: TopicStore,
  topicId: string,
  input: FlowInput,
): Promise<ProcessedInputData> {
  const note = input.processed?.userNote;
  const isTextFile = input.mimeType?.startsWith("text/");

  if (isTextFile) {
    const filePath = topicStore.getInputFilePath(topicId, input.id);
    if (!filePath) throw new Error("Document file not found on disk");
    readFileGuarded(filePath); // size check
    const textContent = fs.readFileSync(filePath, "utf-8").slice(0, 15000);

    if (textContent.length < 500) {
      return { status: "completed", summary: textContent, extractedText: textContent };
    }

    const response = await callClaude([
      { type: "text", text: `Summarize this document and extract key points.${NOTE_CONTEXT(note)}\n\n${textContent.slice(0, 10000)}\n\n${SUMMARY_PROMPT}` },
    ]);
    const parsed = extractJson<{ summary: string; keyPoints: string[] }>(response);
    return {
      status: "completed",
      summary: parsed.summary,
      keyPoints: parsed.keyPoints?.slice(0, 7),
      extractedText: textContent.slice(0, 5000),
    };
  }

  // PDF — Claude API native document block
  if (input.mimeType !== "application/pdf") {
    throw new Error(`Document type ${input.mimeType} is not supported for AI analysis. Only PDF and text files can be analyzed.`);
  }

  const filePath = topicStore.getInputFilePath(topicId, input.id);
  if (!filePath) throw new Error("Document file not found on disk");

  const fileBuffer = readFileGuarded(filePath);
  const base64 = fileBuffer.toString("base64");

  const response = await callClaude([
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
    { type: "text", text: `Analyze this document thoroughly — text, charts, tables, images.${NOTE_CONTEXT(note)}\n\n${SUMMARY_PROMPT}\nAlso include "extractedText": the most important text passages (max 3000 chars).` },
  ]);

  const parsed = extractJson<{ summary: string; keyPoints: string[]; extractedText?: string }>(response);
  return {
    status: "completed",
    summary: parsed.summary,
    keyPoints: parsed.keyPoints?.slice(0, 7),
    extractedText: parsed.extractedText?.slice(0, 5000),
  };
}

async function processAudio(
  topicStore: TopicStore,
  topicId: string,
  input: FlowInput,
): Promise<ProcessedInputData> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured — audio transcription unavailable");
  }

  const filePath = topicStore.getInputFilePath(topicId, input.id);
  if (!filePath) throw new Error("Audio file not found on disk");

  const fileBuffer = readFileGuarded(filePath);
  const blob = new Blob([fileBuffer], { type: input.mimeType ?? "audio/mpeg" });

  const formData = new FormData();
  formData.append("file", blob, input.fileName ?? "audio.mp3");
  formData.append("model", "whisper-1");

  const whisperResponse = await fetchWithTimeout(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    },
  );

  if (!whisperResponse.ok) {
    const body = await whisperResponse.text().catch(() => "");
    throw new Error(`Whisper API failed: ${whisperResponse.status} ${body}`);
  }

  const { text: transcript } = (await whisperResponse.json()) as { text: string };
  const note = input.processed?.userNote;

  const response = await callClaude([
    { type: "text", text: `Summarize this voice memo transcript and extract key points.${NOTE_CONTEXT(note)}\n\n${transcript.slice(0, 10000)}\n\n${SUMMARY_PROMPT}` },
  ]);

  const parsed = extractJson<{ summary: string; keyPoints: string[] }>(response);
  return {
    status: "completed",
    summary: parsed.summary,
    keyPoints: parsed.keyPoints?.slice(0, 7),
    transcript,
  };
}

async function processImage(
  topicStore: TopicStore,
  topicId: string,
  input: FlowInput,
): Promise<ProcessedInputData> {
  const filePath = topicStore.getInputFilePath(topicId, input.id);
  if (!filePath) throw new Error("Image file not found on disk");

  const fileBuffer = readFileGuarded(filePath);
  const base64 = fileBuffer.toString("base64");
  const mediaType = (input.mimeType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const note = input.processed?.userNote;

  const response = await callClaude([
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
    {
      type: "text",
      text: `Analyze this image for content creation purposes.${NOTE_CONTEXT(note)}

Return JSON only:
\`\`\`json
{"description": "detailed description of what the image shows", "extractedText": "any visible text in the image (OCR) or empty string", "keyPoints": ["how this could be relevant for content creation"]}
\`\`\``,
    },
  ]);

  const parsed = extractJson<{ description: string; extractedText?: string; keyPoints?: string[] }>(response);
  return {
    status: "completed",
    description: parsed.description,
    extractedText: parsed.extractedText || undefined,
    keyPoints: parsed.keyPoints?.slice(0, 7),
  };
}

async function processText(input: FlowInput): Promise<ProcessedInputData> {
  if (input.content.length < 500) {
    return { status: "completed", summary: input.content };
  }

  const note = input.processed?.userNote;
  const response = await callClaude([
    { type: "text", text: `Extract key points from this text.${NOTE_CONTEXT(note)}\n\n${input.content.slice(0, 10000)}\n\n${SUMMARY_PROMPT}` },
  ]);

  const parsed = extractJson<{ summary: string; keyPoints: string[] }>(response);
  return {
    status: "completed",
    summary: parsed.summary,
    keyPoints: parsed.keyPoints?.slice(0, 7),
  };
}

// ── Claude API direct call ──────────────────────────────────
// Used instead of Agent SDK query() because:
// 1. query() injects the full Claude Code system prompt (~20K tokens) making Haiku calls fail with "Prompt too long"
// 2. query() doesn't support multimodal content blocks (PDF document, image)
// This function resolves auth from all available sources (project API key, env var, CLI OAuth credentials)

interface ContentBlock {
  type: string;
  source?: { type: string; media_type: string; data: string };
  text?: string;
}

let cachedApiKey: string | null = null;

/**
 * Resolve Anthropic API key from all available sources:
 * 1. ANTHROPIC_API_KEY env var (explicit config)
 * 2. ANTHROPIC_AUTH_TOKEN env var
 * 3. Claude CLI OAuth credentials (~/.claude/.credentials.json)
 */
function resolveApiKey(): string {
  if (cachedApiKey) return cachedApiKey;

  // 1. Explicit API key
  if (process.env.ANTHROPIC_API_KEY) {
    cachedApiKey = process.env.ANTHROPIC_API_KEY;
    return cachedApiKey;
  }

  // 2. Auth token
  if (process.env.ANTHROPIC_AUTH_TOKEN) {
    cachedApiKey = process.env.ANTHROPIC_AUTH_TOKEN;
    return cachedApiKey;
  }

  // 3. CLI OAuth credentials
  const credPaths = [
    path.join(process.env.HOME ?? "/root", ".claude", ".credentials.json"),
    "/root/.claude/.credentials.json",
  ];

  for (const credPath of credPaths) {
    try {
      if (fs.existsSync(credPath)) {
        const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));
        const token = creds?.claudeAiOauth?.accessToken;
        if (token) {
          log.debug("resolved API key from CLI OAuth credentials");
          cachedApiKey = token as string;
          return cachedApiKey;
        }
      }
    } catch {
      // Try next path
    }
  }

  throw new Error("No Anthropic API key found. Set ANTHROPIC_API_KEY in .env, or ensure Claude CLI is authenticated.");
}

/** Reset cached key (e.g. if token expired) */
function resetApiKeyCache(): void {
  cachedApiKey = null;
}

/**
 * Call Claude API directly with content blocks.
 * Supports text, document (PDF), and image content blocks.
 */
export async function callClaude(content: ContentBlock[]): Promise<string> {
  const apiKey = resolveApiKey();

  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content }],
      }),
    },
  );

  if (!response.ok) {
    // If auth failed, reset cache so next call re-resolves
    if (response.status === 401 || response.status === 403) {
      resetApiKeyCache();
    }
    const body = await response.text().catch(() => "");
    throw new Error(`Claude API failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
  return data.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
}
