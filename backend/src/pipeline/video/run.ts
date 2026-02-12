import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import { runScriptPhase } from "./script.js";
import { runStoryboardPhase } from "./storyboard.js";
import { runGeneratePhase } from "./generate.js";
import { runSubtitlePhase } from "./subtitle.js";
import { runThumbnailPhase } from "./thumbnail.js";

const log = createLogger("video-pipeline");

/**
 * Run the full video production pipeline.
 *
 * Flow:
 *   Script → Storyboard → Generate → Review → Subtitle → Thumbnail
 *
 * The pipeline creates a ContentItem with type "video" and attaches
 * generated video + thumbnail as MediaAssets.
 */
export async function runVideoPipeline(ctx: PipelineContext): Promise<void> {
  const { topic } = ctx;
  if (!topic) throw new Error("Video pipeline requires a topic");

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });
  log.info({ topic: topic.title, runId: ctx.run.id }, "starting video pipeline");

  try {
    // ── Phase 1: Script ─────────────────────────────────────────
    ctx.startPhase("script");
    const script = await runScriptPhase(ctx);
    ctx.completePhase("script");

    // ── Phase 2: Storyboard ─────────────────────────────────────
    ctx.startPhase("storyboard");
    const storyboard = await runStoryboardPhase(ctx, script);
    ctx.completePhase("storyboard");

    // ── Phase 3: Generate Video ─────────────────────────────────
    ctx.startPhase("generate");
    const videoAsset = await runGeneratePhase(ctx, storyboard);
    ctx.completePhase("generate");

    // ── Phase 4: Subtitles ──────────────────────────────────────
    ctx.startPhase("subtitle");
    try {
      await runSubtitlePhase(ctx, script, videoAsset);
      ctx.completePhase("subtitle");
    } catch (err) {
      log.warn({ err }, "subtitle generation failed (non-fatal)");
      ctx.failPhase("subtitle", err instanceof Error ? err.message : String(err));
    }

    // ── Phase 5: Thumbnail ──────────────────────────────────────
    ctx.startPhase("thumbnail");
    try {
      await runThumbnailPhase(ctx, videoAsset);
      ctx.completePhase("thumbnail");
    } catch (err) {
      log.warn({ err }, "thumbnail generation failed (non-fatal)");
      ctx.failPhase("thumbnail", err instanceof Error ? err.message : String(err));
    }

    // Mark pipeline complete
    ctx.updateRun({ status: "completed", completedAt: new Date().toISOString() });
    log.info({ runId: ctx.run.id }, "video pipeline completed");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.updateRun({ status: "failed", completedAt: new Date().toISOString(), error: msg });
    log.error({ err: error, runId: ctx.run.id }, "video pipeline failed");
    throw error;
  }
}
