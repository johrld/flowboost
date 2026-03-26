import type { Topic, ChatMessage } from "../models/types.js";

/**
 * Build a comprehensive briefing context string from a topic's inputs, research, and chat.
 * This context block is injected into agent prompts so they know the full briefing background.
 *
 * Used by:
 * - Brainstorm Chat system prompt (inputs + urls)
 * - Enricher/Research prompt (inputs + urls + chat)
 * - Outline Architect prompt (full context)
 * - Social/Newsletter Writer prompts (full context)
 * - Editor Chat system prompt (full context as "briefing memory")
 */
export function buildBriefingContext(
  topic: Topic,
  chatMessages?: ChatMessage[],
  options?: {
    maxInputChars?: number;
    maxChatMessages?: number;
    includeResearch?: boolean;
    includeChat?: boolean;
  },
): string {
  const maxInput = options?.maxInputChars ?? 4000;
  const maxChat = options?.maxChatMessages ?? 8;
  const includeResearch = options?.includeResearch ?? true;
  const includeChat = options?.includeChat ?? true;
  const parts: string[] = [];

  // 1. Text/Transcript Inputs
  const textInputs = (topic.inputs ?? [])
    .filter((i) => i.type === "text" || i.type === "transcript")
    .map((i) => i.content);
  if (textInputs.length > 0) {
    const combined = textInputs.join("\n\n").slice(0, maxInput);
    parts.push(`## Source Material\n\n${combined}`);
  }

  // 2. URLs
  const urls = (topic.inputs ?? []).filter((i) => i.type === "url");
  if (urls.length > 0) {
    parts.push(`## Reference URLs\n\n${urls.map((u) => `- ${u.content}`).join("\n")}`);
  }

  // 3. File references (images, documents — mention but don't inline)
  const files = (topic.inputs ?? []).filter((i) => i.type === "image" || i.type === "document");
  if (files.length > 0) {
    parts.push(`## Attached Files\n\n${files.map((f) => `- ${f.fileName ?? f.type} (${f.mimeType ?? f.type})`).join("\n")}`);
  }

  // 4. Research
  if (includeResearch && topic.keywords?.primary) {
    const researchParts: string[] = [`## Research`];
    researchParts.push(`- **Primary Keyword:** ${topic.keywords.primary}`);
    if (topic.keywords.secondary.length > 0) {
      researchParts.push(`- **Secondary Keywords:** ${topic.keywords.secondary.join(", ")}`);
    }
    if (topic.keywords.longTail.length > 0) {
      researchParts.push(`- **Long-tail:** ${topic.keywords.longTail.join(", ")}`);
    }
    if (topic.searchIntent) {
      researchParts.push(`- **Search Intent:** ${topic.searchIntent}`);
    }
    if (topic.suggestedAngle) {
      researchParts.push(`- **Angle:** ${topic.suggestedAngle}`);
    }
    if (topic.competitorInsights) {
      researchParts.push(`- **Competitors:** ${topic.competitorInsights}`);
    }
    parts.push(researchParts.join("\n"));
  }

  // 5. Brainstorm Chat (last N messages)
  if (includeChat && chatMessages && chatMessages.length > 0) {
    const recent = chatMessages.slice(-maxChat);
    const chatParts = [`## Key Decisions from Brainstorm`];
    for (const msg of recent) {
      const prefix = msg.role === "user" ? "User" : "AI";
      chatParts.push(`**${prefix}:** ${msg.content.slice(0, 500)}`);
    }
    parts.push(chatParts.join("\n\n"));
  }

  // 6. User Notes
  if (topic.userNotes) {
    parts.push(`## User Notes\n\n${topic.userNotes}`);
  }

  if (parts.length === 0) return "";
  return `\n# Briefing Context\n\n${parts.join("\n\n")}`;
}
