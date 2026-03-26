import type { Topic, ChatMessage } from "../models/types.js";

/**
 * Build briefing context from a topic's inputs and chat history.
 *
 * This contains ONLY data that is NOT already on the Topic object:
 * - Source material (text inputs, transcripts)
 * - Reference URLs
 * - File references
 * - Brainstorm chat highlights
 * - User notes
 *
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
  const maxInput = options?.maxInputChars ?? 4000;
  const maxChat = options?.maxChatMessages ?? 8;
  const includeChat = options?.includeChat ?? true;
  const parts: string[] = [];

  // 1. Text/Transcript Inputs
  const textInputs = (topic.inputs ?? [])
    .filter((i) => i.type === "text" || i.type === "transcript")
    .map((i) => i.content);
  if (textInputs.length > 0) {
    const combined = textInputs.join("\n\n").slice(0, maxInput);
    parts.push(`### Source Material\n\n${combined}`);
  }

  // 2. URLs
  const urls = (topic.inputs ?? []).filter((i) => i.type === "url");
  if (urls.length > 0) {
    parts.push(`### Reference URLs\n\n${urls.map((u) => `- ${u.content}`).join("\n")}`);
  }

  // 3. File references (images, documents — mention but don't inline)
  const files = (topic.inputs ?? []).filter((i) => i.type === "image" || i.type === "document");
  if (files.length > 0) {
    parts.push(`### Attached Files\n\n${files.map((f) => `- ${f.fileName ?? f.type} (${f.mimeType ?? f.type})`).join("\n")}`);
  }

  // 4. Brainstorm Chat (last N messages)
  if (includeChat && chatMessages && chatMessages.length > 0) {
    const recent = chatMessages.slice(-maxChat);
    const chatParts = [`### Key Decisions from Brainstorm`];
    for (const msg of recent) {
      const prefix = msg.role === "user" ? "User" : "AI";
      chatParts.push(`**${prefix}:** ${msg.content.slice(0, 500)}`);
    }
    parts.push(chatParts.join("\n\n"));
  }

  // 5. User Notes
  if (topic.userNotes) {
    parts.push(`### User Notes\n\n${topic.userNotes}`);
  }

  if (parts.length === 0) return "";
  return parts.join("\n\n");
}
