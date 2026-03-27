import { createLogger } from "../../utils/logger.js";
import { extractJson } from "../extract-json.js";
import { callClaude } from "./process-input.js";
import type { ChatMessage, ChatDistillation } from "../../models/types.js";
import type { TopicStore } from "../../models/topic.js";

const log = createLogger("distill-chat");

/**
 * Distill a brainstorm chat into structured decisions.
 *
 * Merge pattern: if existingDistillation provided, the prompt instructs
 * the agent to update/merge rather than create from scratch.
 *
 * Absolute dates: current date is injected so time-relative decisions
 * ("next week", "current trend") get timestamped.
 */
export async function distillChat(
  topicStore: TopicStore,
  topicId: string,
  chatMessages: ChatMessage[],
  existingDistillation?: ChatDistillation,
): Promise<ChatDistillation> {
  if (chatMessages.length === 0) {
    const empty: ChatDistillation = {
      keyDecisions: [],
      contentDirection: "",
      mustInclude: [],
      rejectedIdeas: [],
      rejectedApproaches: [],
      contentReferences: [],
      toneNotes: "",
      distilledAt: new Date().toISOString(),
    };
    topicStore.updateChatDistillation(topicId, empty);
    return empty;
  }

  // Truncate at message boundary, not mid-sentence
  let chatText = "";
  for (const m of chatMessages) {
    const line = `${m.role === "user" ? "User" : "AI"}: ${m.content}\n\n`;
    if (chatText.length + line.length > 12000) break;
    chatText += line;
  }

  const today = new Date().toISOString().split("T")[0];

  const mergeContext = existingDistillation
    ? `\n\nHere is the PREVIOUS distillation. Merge new decisions into it — add new items, remove contradicted ones, keep still-valid ones:\n\`\`\`json\n${JSON.stringify(existingDistillation, null, 2)}\n\`\`\``
    : "";

  const prompt = `Today's date: ${today}. Analyze this brainstorm conversation and extract structured decisions.${mergeContext}

<conversation>
${chatText}
</conversation>

IMPORTANT: Convert any relative time references ("next week", "yesterday", "current trend") to absolute dates using today's date (${today}).

Return JSON only:
\`\`\`json
{
  "keyDecisions": ["decision 1", "decision 2"],
  "contentDirection": "Brief description of the agreed content direction",
  "mustInclude": ["element that must be included"],
  "rejectedIdeas": ["idea that was explicitly rejected"],
  "rejectedApproaches": ["approach or method that was rejected and why"],
  "contentReferences": ["specific sources, inputs, or URLs referenced in the chat"],
  "toneNotes": "Any agreed tone, style, or voice notes"
}
\`\`\`

Only include items that were explicitly discussed or agreed upon. Leave arrays empty if nothing was decided.`;

  const result = await callClaude([{ type: "text", text: prompt }]);
  const parsed = extractJson<Omit<ChatDistillation, "distilledAt">>(result);

  const distillation: ChatDistillation = {
    keyDecisions: parsed.keyDecisions ?? [],
    contentDirection: parsed.contentDirection ?? "",
    mustInclude: parsed.mustInclude ?? [],
    rejectedIdeas: parsed.rejectedIdeas ?? [],
    rejectedApproaches: parsed.rejectedApproaches ?? [],
    contentReferences: parsed.contentReferences ?? [],
    toneNotes: parsed.toneNotes ?? "",
    distilledAt: new Date().toISOString(),
  };

  topicStore.updateChatDistillation(topicId, distillation);
  log.info({ topicId, decisions: distillation.keyDecisions.length }, "chat distilled");

  return distillation;
}
