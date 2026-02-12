import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { VideoScript, VideoScene } from "./script.js";

const log = createLogger("video:storyboard");

export interface Storyboard {
  scenes: StoryboardScene[];
  totalDuration: number;
  transitions: string[];
}

export interface StoryboardScene extends VideoScene {
  /** Refined prompt optimized for the target video model */
  generationPrompt: string;
  /** Aspect ratio for generation */
  aspectRatio: "16:9" | "9:16" | "1:1";
  /** Camera movement instructions */
  cameraMotion?: string;
}

/**
 * Phase 2: Refine the script into a storyboard with generation-ready prompts.
 * Optimizes visual prompts for the target AI video model (Runway, Kling, etc.)
 */
export async function runStoryboardPhase(
  ctx: PipelineContext,
  script: VideoScript,
): Promise<Storyboard> {
  // Refine each scene's visual prompt for AI generation
  const scenes: StoryboardScene[] = script.scenes.map((scene) => ({
    ...scene,
    generationPrompt: refinePromptForGeneration(scene),
    aspectRatio: "16:9" as const,
    cameraMotion: inferCameraMotion(scene),
  }));

  const storyboard: Storyboard = {
    scenes,
    totalDuration: scenes.reduce((sum, s) => sum + s.durationSeconds, 0),
    transitions: scenes.map(() => "crossfade"),
  };

  // Save storyboard
  const storyboardPath = path.join(ctx.scratchpadDir, "storyboard.json");
  fs.writeFileSync(storyboardPath, JSON.stringify(storyboard, null, 2));

  log.info({
    scenes: storyboard.scenes.length,
    totalDuration: storyboard.totalDuration,
  }, "storyboard created");

  return storyboard;
}

/** Refine a visual prompt to be more effective for AI video generation */
function refinePromptForGeneration(scene: VideoScene): string {
  // Add quality boosters and structure that video models respond well to
  const parts = [
    scene.visualPrompt,
    "cinematic lighting",
    "smooth motion",
    "high quality",
    "4K",
  ];
  return parts.join(", ");
}

/** Infer camera motion from scene description */
function inferCameraMotion(scene: VideoScene): string {
  const desc = scene.description.toLowerCase();
  if (desc.includes("zoom")) return "zoom_in";
  if (desc.includes("pan")) return "pan_right";
  if (desc.includes("aerial") || desc.includes("overview")) return "crane_up";
  if (desc.includes("close") || desc.includes("detail")) return "dolly_in";
  return "static";
}
