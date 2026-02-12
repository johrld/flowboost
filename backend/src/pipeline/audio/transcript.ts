import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { AudioScript } from "./script.js";

const log = createLogger("audio:transcript");

/**
 * Phase 3: Generate a transcript from the audio script.
 *
 * Creates a markdown transcript with timestamps for accessibility and SEO.
 * When STT is available, this can be replaced with actual audio transcription.
 */
export async function runTranscriptPhase(
  ctx: PipelineContext,
  script: AudioScript,
): Promise<string> {
  const transcriptPath = path.join(ctx.scratchpadDir, "transcript.md");
  let content = `# ${script.title}\n\n`;
  content += `> ${script.description}\n\n`;

  let currentTime = 0;
  for (const segment of script.segments) {
    const timestamp = formatTimestamp(currentTime);
    content += `**[${timestamp}]** *${segment.type}*\n\n`;
    content += `${segment.text}\n\n`;
    currentTime += segment.durationSeconds;
  }

  content += `---\n*Total duration: ${formatTimestamp(currentTime)}*\n`;

  fs.writeFileSync(transcriptPath, content, "utf-8");
  log.info({ segments: script.segments.length }, "transcript generated");

  return transcriptPath;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
