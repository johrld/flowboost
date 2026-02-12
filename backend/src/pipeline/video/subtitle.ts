import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { VideoScript } from "./script.js";
import type { GeneratedVideoAsset } from "./generate.js";

const log = createLogger("video:subtitle");

/**
 * Phase 4: Generate subtitles from the script voiceover.
 *
 * Creates an SRT file with timed subtitles based on scene durations.
 * When STT (Speech-to-Text) is available, this can be replaced with
 * actual audio transcription for better timing.
 */
export async function runSubtitlePhase(
  ctx: PipelineContext,
  script: VideoScript,
  _videoAsset: GeneratedVideoAsset,
): Promise<string> {
  const srtPath = path.join(ctx.scratchpadDir, "subtitles.srt");
  let srtContent = "";
  let currentTime = 0;

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const startTime = formatSrtTime(currentTime);
    const endTime = formatSrtTime(currentTime + scene.durationSeconds);

    srtContent += `${i + 1}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${scene.voiceoverText}\n\n`;

    currentTime += scene.durationSeconds;
  }

  fs.writeFileSync(srtPath, srtContent, "utf-8");
  log.info({ scenes: script.scenes.length, duration: currentTime }, "subtitles generated");

  return srtPath;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(ms)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}
