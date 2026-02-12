import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { GeneratedVideoAsset } from "./generate.js";

const log = createLogger("video:thumbnail");

/**
 * Phase 5: Generate a thumbnail for the video.
 *
 * Options:
 * 1. Extract a key frame from the generated video (when video files exist)
 * 2. Generate via AI image model (Imagen, DALL-E)
 * 3. Use a text-overlay template
 *
 * Currently a STUB — creates a thumbnail request for the AI image model.
 */
export async function runThumbnailPhase(
  ctx: PipelineContext,
  videoAsset: GeneratedVideoAsset,
): Promise<string> {
  const thumbnailDir = path.join(ctx.scratchpadDir, "thumbnail");
  fs.mkdirSync(thumbnailDir, { recursive: true });

  // Save thumbnail generation request (ready for Imagen API call)
  const requestPath = path.join(thumbnailDir, "thumbnail-request.json");
  fs.writeFileSync(requestPath, JSON.stringify({
    model: ctx.project.pipeline.imagenModel ?? "imagen-4-fast",
    prompt: `YouTube video thumbnail, professional, eye-catching, topic: ${ctx.topic?.title ?? "video"}`,
    aspectRatio: "16:9",
    width: 1280,
    height: 720,
    status: "pending",
  }, null, 2));

  log.info({ model: ctx.project.pipeline.imagenModel }, "thumbnail request prepared");
  return requestPath;
}
