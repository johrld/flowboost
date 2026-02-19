#!/usr/bin/env npx tsx
/**
 * Standalone MCP server over stdio for FlowBoost tools.
 * Launched by Claude Code CLI as a child process.
 *
 * Usage: npx tsx src/tools/mcp-stdio-server.ts
 * Env:   FLOWBOOST_DATA_DIR (required) - path to data directory
 */
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  validateArticle,
  validateSection,
  assembleArticle,
  type SectionType,
} from "../utils/markdown.js";

const dataDir = process.env.FLOWBOOST_DATA_DIR;
const projectDir = process.env.FLOWBOOST_PROJECT_DIR;
const customerDir = process.env.FLOWBOOST_CUSTOMER_DIR;
if (!dataDir) {
  process.stderr.write("FLOWBOOST_DATA_DIR not set\n");
  process.exit(1);
}

const server = new McpServer({ name: "flowboost", version: "0.1.0" });

// ── Tool 1: Validate Section ─────────────────────────────────────

server.tool(
  "flowboost_validate_section",
  "Validate a content section file against type-specific rules. Returns pass/fail with metrics and issues.",
  {
    path: z.string().describe("Absolute path to the section file"),
    type: z.enum(["introduction", "h2_section", "conclusion", "faq", "meta"]).describe("Section type"),
    targetWords: z.number().optional().describe("Target word count for h2_section type"),
  },
  async (args) => {
    if (!fs.existsSync(args.path)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `File not found: ${args.path}` }) }] };
    }
    const content = fs.readFileSync(args.path, "utf-8");
    const result = validateSection(content, args.type as SectionType, args.targetWords);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Tool 2: Validate Article ─────────────────────────────────────

server.tool(
  "flowboost_validate_article",
  "Validate a complete markdown article. Checks word count, paragraphs, H2 structure, FAQ, internal links, and answer capsule.",
  {
    path: z.string().describe("Absolute path to the markdown article file"),
  },
  async (args) => {
    if (!fs.existsSync(args.path)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `File not found: ${args.path}` }) }] };
    }
    const content = fs.readFileSync(args.path, "utf-8");
    const result = validateArticle(content);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Tool 3: Assemble Article ─────────────────────────────────────

server.tool(
  "flowboost_assemble_article",
  "Assemble individual section files (meta.yaml, intro.md, section-*.md, conclusion.md, faq.yaml) into a complete markdown article.",
  {
    scratchpadDir: z.string().describe("Directory containing the section files"),
    outputPath: z.string().describe("Path where the assembled article will be written"),
  },
  async (args) => {
    const result = assembleArticle(args.scratchpadDir, args.outputPath);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Tool 4: Generate Image ───────────────────────────────────────

server.tool(
  "flowboost_generate_image",
  "Generate an image using Google Imagen 4 Fast API. Returns the saved file path. Costs ~$0.02 per image.",
  {
    prompt: z.string().describe("English image generation prompt (detailed scene description)"),
    outputPath: z.string().describe("Absolute path where the PNG will be saved"),
    aspectRatio: z.enum(["16:9", "1:1", "9:16", "4:3", "3:4"]).default("16:9").describe("Image aspect ratio"),
  },
  async (args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "GEMINI_API_KEY not set" }) }] };
    }

    const model = process.env.IMAGEN_MODEL ?? "imagen-4.0-fast-generate-001";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: args.prompt }],
        parameters: { sampleCount: 1, aspectRatio: args.aspectRatio, personGeneration: "allow_adult" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Imagen API error: ${response.status}`, details: errorText }) }] };
    }

    const data = (await response.json()) as { predictions?: Array<{ bytesBase64Encoded: string }> };
    if (!data.predictions?.[0]?.bytesBase64Encoded) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No image data in response" }) }] };
    }

    fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
    const buffer = Buffer.from(data.predictions[0].bytesBase64Encoded, "base64");
    fs.writeFileSync(args.outputPath, buffer);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, path: args.outputPath, sizeKb: Math.round(buffer.length / 1024) }),
      }],
    };
  },
);

// ── Tool 5: Read Project Data ────────────────────────────────────

server.tool(
  "flowboost_read_project_data",
  "Read project configuration, brand voice, style guide, SEO guidelines, templates, section specs, or other project resources. Brand voice and style guide use fallback: project-level > customer-level.",
  {
    resource: z.string().describe("Resource to read: project, brand-voice, style-guide, seo-guidelines, content-types, content-plan, template:<name>, section-spec:<name>"),
  },
  async (args) => {
    if (!projectDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "FLOWBOOST_PROJECT_DIR not set" }) }] };
    }

    const resourceMap: Record<string, string> = {
      project: "project.json",
      "seo-guidelines": "seo-guidelines.md",
      "seo-ai-strategy": "seo-ai-strategy.md",
      "content-types": "content-types.md",
      "content-plan": "content-plan.json",
    };

    // Resources with customer-level fallback
    const fallbackResources = ["brand-voice", "style-guide"];

    let filePath: string | undefined;
    const resource = args.resource;

    if (resource.startsWith("template:")) {
      filePath = path.join(projectDir, "templates", `${resource.slice(9)}.md`);
    } else if (resource.startsWith("section-spec:")) {
      filePath = path.join(projectDir, "section-specs", `${resource.slice(13)}.md`);
    } else if (fallbackResources.includes(resource)) {
      // Try project-level first, then customer-level
      const fileName = `${resource}.md`;
      const projectPath = path.join(projectDir, fileName);
      const customerPath = customerDir ? path.join(customerDir, fileName) : null;

      if (fs.existsSync(projectPath)) {
        filePath = projectPath;
      } else if (customerPath && fs.existsSync(customerPath)) {
        filePath = customerPath;
      } else {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Resource not found: ${resource} (checked project and customer level)` }) }] };
      }
    } else if (resourceMap[resource]) {
      filePath = path.join(projectDir, resourceMap[resource]);
    } else {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown resource: ${resource}` }) }] };
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Resource not found: ${filePath ?? resource}` }) }] };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const isJson = filePath.endsWith(".json");

    return {
      content: [{
        type: "text" as const,
        text: isJson ? content : JSON.stringify({ resource, content }),
      }],
    };
  },
);

// ── Tool 6: Read Content Index ───────────────────────────────────

server.tool(
  "flowboost_read_content_index",
  "Read the project's content index — all published and in-progress articles with metadata (title, category, language, keywords, word count). Use this to understand what content already exists.",
  {
    status: z.string().optional().describe("Filter by status: live, archived, planned, producing, review, delivered"),
    channel: z.string().optional().describe("Filter by channel: website, social"),
  },
  async (args) => {
    if (!projectDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "FLOWBOOST_PROJECT_DIR not set" }) }] };
    }
    const indexPath = path.join(projectDir, "content-index.json");
    if (!fs.existsSync(indexPath)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ entries: [], total: 0 }) }] };
    }
    const index = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as {
      lastSyncedAt?: string;
      entries?: Array<{ status?: string; channel?: string }>;
    };
    let entries = index.entries ?? [];
    if (args.status) entries = entries.filter((e) => e.status === args.status);
    if (args.channel) entries = entries.filter((e) => e.channel === args.channel);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ total: entries.length, lastSyncedAt: index.lastSyncedAt, entries }),
      }],
    };
  },
);

// ── Tool 7: Read Article via GitHub API ─────────────────────────

server.tool(
  "flowboost_read_article",
  "Read the full markdown content of a specific article from the repository via GitHub API. Use sparingly — for most tasks, the content index metadata is sufficient.",
  {
    filePath: z.string().describe("File path within the repo (e.g. src/content/posts/de/article-slug.md)"),
  },
  async (args) => {
    if (!projectDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "FLOWBOOST_PROJECT_DIR not set" }) }] };
    }

    // Load project config for GitHub connector
    const projectPath = path.join(projectDir, "project.json");
    if (!fs.existsSync(projectPath)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "project.json not found" }) }] };
    }

    const project = JSON.parse(fs.readFileSync(projectPath, "utf-8")) as {
      connector?: {
        type?: string;
        github?: { installationId: number; owner: string; repo: string; branch: string };
      };
    };
    const gh = project.connector?.github;
    if (!gh) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No GitHub connector configured" }) }] };
    }

    try {
      // Dynamic import to avoid hard dependency — github.ts uses env vars for auth
      const { getFileContent } = await import("../services/github.js");
      const content = await getFileContent(gh.installationId, gh.owner, gh.repo, args.filePath, gh.branch);
      return { content: [{ type: "text" as const, text: content }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Failed to read article: ${msg}` }) }] };
    }
  },
);

// ── Start server ─────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
