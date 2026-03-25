import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import { runAgentTracked } from "../engine.js";
import { extractJson } from "../extract-json.js";
import type { PipelineContext } from "../context.js";

const log = createLogger("video:script");

export interface VideoScript {
  title: string;
  description: string;
  durationTarget: number; // seconds
  scenes: VideoScene[];
  voiceover: string;
}

export interface VideoScene {
  id: number;
  description: string;
  durationSeconds: number;
  visualPrompt: string;
  voiceoverText: string;
  textOverlay?: string;
}

/**
 * Phase 1: Generate a video script from the topic.
 * Uses Claude to write a scene-by-scene script with visual prompts.
 */
export async function runScriptPhase(ctx: PipelineContext): Promise<VideoScript> {
  const { topic, project } = ctx;
  if (!topic) throw new Error("Script phase requires a topic");

  const brandVoice = ctx.getBrandVoice() ?? "";
  const lang = project.defaultLanguage;

  const prompt = `You are a video scriptwriter. Create a video script for the following topic.

Topic: ${topic.title}
Category: ${topic.category}
Keywords: ${topic.keywords.primary}, ${topic.keywords.secondary.join(", ")}
Angle: ${topic.suggestedAngle}
Language: ${lang}
${brandVoice ? `Brand Voice:\n${brandVoice}` : ""}

Requirements:
- Target duration: 60-90 seconds
- Write 4-8 scenes
- Each scene needs: description, duration (seconds), visual prompt (for AI video generation), voiceover text
- Include text overlays for key points
- The visual prompts should be detailed enough for an AI video generator (Runway Gen-4)
- Voiceover should be natural, conversational, matching the brand voice

Output ONLY valid JSON in this exact format:
{
  "title": "Video title",
  "description": "Short description for platform",
  "durationTarget": 75,
  "scenes": [
    {
      "id": 1,
      "description": "Scene description",
      "durationSeconds": 10,
      "visualPrompt": "Detailed visual prompt for AI generation",
      "voiceoverText": "What the narrator says",
      "textOverlay": "Key point text"
    }
  ],
  "voiceover": "Full voiceover script concatenated"
}`;

  const result = await runAgentTracked(ctx, "script", prompt, {
    name: "video-scriptwriter",
    model: "sonnet",
    maxTurns: 1,
    useMcpTools: false,
  });

  // Parse JSON from agent response
  const script = extractJson<VideoScript>(result.text);

  // Save script to scratchpad
  const scriptPath = path.join(ctx.scratchpadDir, "script.json");
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));

  log.info({
    title: script.title,
    scenes: script.scenes.length,
    duration: script.durationTarget,
  }, "script generated");

  return script;
}
