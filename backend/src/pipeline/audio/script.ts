import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import { runAgentTracked } from "../engine.js";
import { extractJson } from "../extract-json.js";
import type { PipelineContext } from "../context.js";

const log = createLogger("audio:script");

export interface AudioScript {
  title: string;
  description: string;
  durationTarget: number;
  segments: AudioSegment[];
  fullScript: string;
}

export interface AudioSegment {
  id: number;
  type: "intro" | "content" | "transition" | "outro";
  text: string;
  durationSeconds: number;
  voiceStyle?: string;
  backgroundMusic?: string;
}

/**
 * Phase 1: Generate an audio/podcast script from the topic.
 */
export async function runAudioScriptPhase(ctx: PipelineContext): Promise<AudioScript> {
  const { topic, project } = ctx;
  if (!topic) throw new Error("Audio script phase requires a topic");

  const brandVoice = ctx.getBrandVoice() ?? "";

  const seo = topic.enrichment?.seo;
  const keywords = seo?.keywords?.primary
    ? [seo.keywords.primary, ...(seo.keywords.secondary ?? [])].join(", ")
    : "not specified";

  const prompt = `You are a podcast/audio scriptwriter. Create an audio script for the following topic.

Topic: ${topic.title}
Category: ${topic.category}
Keywords: ${keywords}
Angle: ${topic.direction ?? ""}
Language: ${project.defaultLanguage}
${brandVoice ? `Brand Voice:\n${brandVoice}` : ""}

Requirements:
- Target duration: 3-5 minutes
- Include intro, content segments, transitions, and outro
- Write for spoken delivery (conversational, clear)
- Include voice style notes (pace, emotion, emphasis)

Output ONLY valid JSON:
{
  "title": "Episode title",
  "description": "Short description",
  "durationTarget": 240,
  "segments": [
    {
      "id": 1,
      "type": "intro",
      "text": "Spoken text...",
      "durationSeconds": 30,
      "voiceStyle": "warm, inviting",
      "backgroundMusic": "soft ambient"
    }
  ],
  "fullScript": "Complete concatenated script text"
}`;

  const result = await runAgentTracked(ctx, "script", prompt, {
    name: "audio-scriptwriter",
    model: "sonnet",
    maxTurns: 1,
    useMcpTools: false,
  });

  const script = extractJson<AudioScript>(result.text);

  const scriptPath = path.join(ctx.scratchpadDir, "audio-script.json");
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));

  log.info({ title: script.title, segments: script.segments.length }, "audio script generated");
  return script;
}
