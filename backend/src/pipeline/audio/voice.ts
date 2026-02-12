import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { AudioScript } from "./script.js";

const log = createLogger("audio:voice");

export interface GeneratedAudioAsset {
  segmentPaths: string[];
  totalDuration: number;
  model: string;
  voice: string;
  costUsd: number;
}

/**
 * Phase 2: Generate voice audio from the script.
 *
 * Uses external TTS API (ElevenLabs, PlayHT, etc.)
 * configured via the AI Service Registry.
 *
 * Currently a STUB — saves generation requests as JSON.
 * Actual API integration comes when customers connect their API keys.
 */
export async function runVoicePhase(
  ctx: PipelineContext,
  script: AudioScript,
): Promise<GeneratedAudioAsset> {
  const audioModel = ctx.project.pipeline.audioModel ?? "eleven_multilingual_v2";
  const voice = ctx.project.pipeline.preferredVoice ?? "default";
  const segmentPaths: string[] = [];

  const audioDir = path.join(ctx.scratchpadDir, "audio-segments");
  fs.mkdirSync(audioDir, { recursive: true });

  for (const segment of script.segments) {
    // TODO: Call ElevenLabs API via AI Service Registry
    // const apiKey = aiRegistry.getApiKey("elevenlabs", projectApiKeys);
    // const audio = await elevenLabsClient.textToSpeech({ text: segment.text, voice, model });

    const requestPath = path.join(audioDir, `segment-${segment.id}-request.json`);
    fs.writeFileSync(requestPath, JSON.stringify({
      model: audioModel,
      voice,
      text: segment.text,
      voiceStyle: segment.voiceStyle,
      durationTarget: segment.durationSeconds,
      status: "pending_api_key",
    }, null, 2));

    segmentPaths.push(requestPath);

    log.debug({
      segmentId: segment.id,
      type: segment.type,
      model: audioModel,
    }, "audio generation request saved");
  }

  log.info({
    segments: segmentPaths.length,
    totalDuration: script.durationTarget,
    model: audioModel,
    voice,
  }, "audio generation requests prepared");

  return {
    segmentPaths,
    totalDuration: script.durationTarget,
    model: audioModel,
    voice,
    costUsd: 0,
  };
}
