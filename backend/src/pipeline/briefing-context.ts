import type { Topic, ChatMessage, BriefingInput } from "../models/types.js";

/**
 * Build briefing context from a topic's processed inputs and chat distillation.
 *
 * Uses processed summaries when available, falls back to raw content.
 * Research data (keywords, angle, insights) is on the Topic itself
 * and is read directly by each prompt builder — not duplicated here.
 */
export function buildBriefingContext(
  topic: Topic,
  chatMessages?: ChatMessage[],
  options?: {
    maxInputChars?: number;
    maxChatMessages?: number;
    includeChat?: boolean;
  },
): string {
  const maxInput = options?.maxInputChars ?? 8000;
  const includeChat = options?.includeChat ?? true;
  const parts: string[] = [];
  const inputs = topic.inputs ?? [];

  // 1. Source Material — processed summaries (text, transcript, document)
  const sourceInputs = inputs.filter((i) =>
    ["text", "transcript", "document"].includes(i.type),
  );
  const processedSources = sourceInputs.filter((i) => i.processed?.status === "completed");
  const rawSources = sourceInputs.filter((i) => !i.processed || i.processed.status === "failed");

  if (processedSources.length > 0) {
    const summaryParts = processedSources.map((i) => {
      const label = i.type === "transcript" ? "Voice Memo"
        : i.type === "document" ? `Document: ${i.fileName ?? "unknown"}`
        : "Note";
      const lines: string[] = [`**${label}**`];
      if (i.processed!.summary) lines.push(i.processed!.summary);
      if (i.processed!.keyPoints?.length) {
        lines.push(...i.processed!.keyPoints.map((p) => `- ${p}`));
      }
      return lines.join("\n");
    });
    parts.push(`### Source Material\n\n${summaryParts.join("\n\n---\n\n").slice(0, maxInput)}`);
  }

  // Fallback: unprocessed text/transcript inputs
  if (rawSources.length > 0) {
    const combined = rawSources.map((i) => i.content).join("\n\n").slice(0, maxInput);
    if (combined.trim()) {
      parts.push(`### Raw Source Material\n\n${combined}`);
    }
  }

  // 2. URLs — summaries instead of just URL strings
  const urlInputs = inputs.filter((i) => i.type === "url");
  if (urlInputs.length > 0) {
    const urlParts = urlInputs.map((u) => {
      if (u.processed?.status === "completed" && u.processed.summary) {
        const lines = [`- **${u.content}**`, `  ${u.processed.summary}`];
        if (u.processed.keyPoints?.length) {
          lines.push(...u.processed.keyPoints.map((p) => `  - ${p}`));
        }
        return lines.join("\n");
      }
      return `- ${u.content}${u.processed?.status === "processing" ? " (analyzing...)" : ""}`;
    });
    parts.push(`### Reference URLs\n\n${urlParts.join("\n\n")}`);
  }

  // 3. Images — descriptions instead of just filenames
  const imageInputs = inputs.filter((i) => i.type === "image");
  if (imageInputs.length > 0) {
    const imageParts = imageInputs.map((img) => {
      if (img.processed?.status === "completed" && img.processed.description) {
        const lines = [`- **${img.fileName ?? "Image"}**: ${img.processed.description}`];
        if (img.processed.extractedText) {
          lines.push(`  Text in image: "${img.processed.extractedText}"`);
        }
        return lines.join("\n");
      }
      return `- ${img.fileName ?? img.type} (${img.mimeType ?? "image"})`;
    });
    parts.push(`### Images\n\n${imageParts.join("\n")}`);
  }

  // 4. Chat — distillation (preferred) or raw chat (fallback)
  if (includeChat) {
    if (topic.chatDistillation) {
      const d = topic.chatDistillation;
      const distParts: string[] = ["### Brainstorm Decisions"];
      if (d.contentDirection) distParts.push(`**Direction:** ${d.contentDirection}`);
      if (d.keyDecisions.length) {
        distParts.push("**Key Decisions:**");
        distParts.push(...d.keyDecisions.map((k) => `- ${k}`));
      }
      if (d.mustInclude.length) {
        distParts.push("**Must Include:**");
        distParts.push(...d.mustInclude.map((m) => `- ${m}`));
      }
      if (d.rejectedIdeas.length || d.rejectedApproaches.length) {
        distParts.push("**Rejected:**");
        distParts.push(...d.rejectedIdeas.map((r) => `- ${r}`));
        distParts.push(...d.rejectedApproaches.map((r) => `- ${r}`));
      }
      if (d.toneNotes) distParts.push(`**Tone:** ${d.toneNotes}`);
      parts.push(distParts.join("\n"));
    } else if (chatMessages && chatMessages.length > 0) {
      // Fallback to raw chat (last 8 messages, 500 chars each)
      const maxChat = options?.maxChatMessages ?? 8;
      const recent = chatMessages.slice(-maxChat);
      const chatParts = ["### Key Decisions from Brainstorm"];
      for (const msg of recent) {
        const prefix = msg.role === "user" ? "User" : "AI";
        chatParts.push(`**${prefix}:** ${msg.content.slice(0, 500)}`);
      }
      parts.push(chatParts.join("\n\n"));
    }
  }

  // 5. User Notes
  if (topic.userNotes) {
    parts.push(`### User Notes\n\n${topic.userNotes}`);
  }

  if (parts.length === 0) return "";
  return parts.join("\n\n");
}
