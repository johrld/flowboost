import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { Storyboard } from "./storyboard.js";

const log = createLogger("video:generate");

export interface GeneratedVideoAsset {
  scenePaths: string[];
  totalDuration: number;
  model: string;
  costUsd: number;
}

/**
 * Phase 3: Generate video clips from storyboard scenes.
 *
 * Uses external AI video generation API (Runway, Kling, etc.)
 * configured via the AI Service Registry.
 *
 * Currently a STUB — saves storyboard data and returns placeholder paths.
 * Actual API integration comes when customers connect their API keys.
 */
export async function runGeneratePhase(
  ctx: PipelineContext,
  storyboard: Storyboard,
): Promise<GeneratedVideoAsset> {
  const videoModel = ctx.project.pipeline.videoModel ?? "gen4";
  const scenePaths: string[] = [];

  const videoDir = path.join(ctx.scratchpadDir, "video-scenes");
  fs.mkdirSync(videoDir, { recursive: true });

  for (const scene of storyboard.scenes) {
    // TODO: Call external video generation API via AI Service Registry
    // const apiKey = aiRegistry.getApiKey("runway", projectApiKeys);
    // const result = await runwayClient.generate({ prompt: scene.generationPrompt, ... });

    // For now: save generation request as JSON (ready for API call)
    const requestPath = path.join(videoDir, `scene-${scene.id}-request.json`);
    fs.writeFileSync(requestPath, JSON.stringify({
      model: videoModel,
      prompt: scene.generationPrompt,
      duration: scene.durationSeconds,
      aspectRatio: scene.aspectRatio,
      cameraMotion: scene.cameraMotion,
      status: "pending_api_key",
    }, null, 2));

    scenePaths.push(requestPath);

    log.debug({
      sceneId: scene.id,
      duration: scene.durationSeconds,
      model: videoModel,
    }, "video generation request saved (awaiting API integration)");
  }

  log.info({
    scenes: scenePaths.length,
    totalDuration: storyboard.totalDuration,
    model: videoModel,
  }, "video generation requests prepared");

  return {
    scenePaths,
    totalDuration: storyboard.totalDuration,
    model: videoModel,
    costUsd: 0, // Will be set when actual API calls are made
  };
}
