import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import { runAudioScriptPhase } from "./script.js";
import { runVoicePhase } from "./voice.js";
import { runTranscriptPhase } from "./transcript.js";

const log = createLogger("audio-pipeline");

/**
 * Run the full audio production pipeline.
 *
 * Flow:
 *   Script → Voice Generation → Mix → Review → Transcript
 *
 * Creates a ContentItem with type "audio" and attaches
 * the generated audio file as MediaAsset.
 */
export async function runAudioPipeline(ctx: PipelineContext): Promise<void> {
  const { topic } = ctx;
  if (!topic) throw new Error("Audio pipeline requires a topic");

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });
  log.info({ topic: topic.title, runId: ctx.run.id }, "starting audio pipeline");

  try {
    // ── Phase 1: Script ─────────────────────────────────────────
    ctx.startPhase("script");
    const script = await runAudioScriptPhase(ctx);
    ctx.completePhase("script");

    // ── Phase 2: Voice Generation ───────────────────────────────
    ctx.startPhase("voice");
    const audioAsset = await runVoicePhase(ctx, script);
    ctx.completePhase("voice");

    // ── Phase 3: Transcript ─────────────────────────────────────
    ctx.startPhase("transcript");
    try {
      await runTranscriptPhase(ctx, script);
      ctx.completePhase("transcript");
    } catch (err) {
      log.warn({ err }, "transcript generation failed (non-fatal)");
      ctx.failPhase("transcript", err instanceof Error ? err.message : String(err));
    }

    ctx.updateRun({ status: "completed", completedAt: new Date().toISOString() });
    log.info({ runId: ctx.run.id }, "audio pipeline completed");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.updateRun({ status: "failed", completedAt: new Date().toISOString(), error: msg });
    log.error({ err: error, runId: ctx.run.id }, "audio pipeline failed");
    throw error;
  }
}
