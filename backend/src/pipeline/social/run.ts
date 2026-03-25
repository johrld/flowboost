import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { ContentItemStatus, SocialVersionMeta } from "../../models/types.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import { buildSocialWriterPrompt } from "../prompts/social-writer.js";
import { extractJson } from "../extract-json.js";

const log = createLogger("social-production");

interface SocialOutput {
  text: string;
  hashtags: string[];
  format: string;
  imagePrompt?: string | null;
  slides?: string[] | null;
}

/**
 * Run the social post production pipeline.
 *
 * Flow: Generate → (optional) Image → Quality Check
 *
 * Much simpler than article production — a single agent call
 * produces the entire post.
 */
export async function runSocialPipeline(
  ctx: PipelineContext,
  platform: string,
): Promise<void> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Social pipeline requires a topic");

  const model = project.pipeline.defaultModel;

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });
  log.info({ topic: topic.title, platform, runId: ctx.run.id }, "starting social pipeline");

  // ── Phase 1: Generate ─────────────────────────────────────
  ctx.startPhase("generate");

  let socialOutput: SocialOutput;

  try {
    // Build context from briefing inputs
    const briefingInputs = (topic.inputs ?? [])
      .filter((i) => i.type === "text" || i.type === "transcript")
      .map((i) => i.content);

    const prompt = buildSocialWriterPrompt(project, topic, platform, {
      inputs: briefingInputs,
      researchAngle: topic.suggestedAngle,
    });

    const config: AgentConfig = {
      name: `social-writer-${platform}`,
      model,
      maxTurns: 3,
      useMcpTools: true,
      tools: ["Read", "mcp__flowboost__flowboost_read_project_data"],
    };

    const result = await runAgentTracked(ctx, "generate", prompt, config);
    socialOutput = extractJson<SocialOutput>(result.text);

    ctx.completePhase("generate");
    log.info({
      platform,
      textLength: socialOutput.text.length,
      hashtags: socialOutput.hashtags.length,
      format: socialOutput.format,
    }, "social post generated");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("generate", msg);
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw error;
  }

  // ── Phase 2: Image (optional, non-fatal) ──────────────────
  if (socialOutput.imagePrompt) {
    ctx.startPhase("image");
    try {
      // Image generation would go here — skip for now, mark as completed
      // Future: call Imagen API with socialOutput.imagePrompt
      ctx.completePhase("image");
      log.info("image phase skipped (not yet implemented for social)");
    } catch (error) {
      log.warn({ err: error }, "social image generation failed — continuing");
      ctx.failPhase("image", error instanceof Error ? error.message : String(error));
    }
  }

  // ── Create ContentVersion ─────────────────────────────────
  const now = new Date().toISOString();

  // Find the ContentItem that was created for this run
  const outputIds = topic.outputIds ?? [];
  const contentItems = outputIds
    .map((id) => ctx.stores.content.get(id))
    .filter((item) => item !== null);

  const contentItem = contentItems.find((item) =>
    item!.type === "social_post" && item!.status === "planned",
  );

  if (contentItem) {
    const socialMeta: SocialVersionMeta = {
      platform: platform as SocialVersionMeta["platform"],
      characterCount: socialOutput.text.length,
      hashtagCount: socialOutput.hashtags.length,
      hasMedia: !!socialOutput.imagePrompt,
      format: socialOutput.format as SocialVersionMeta["format"],
      slideCount: socialOutput.slides?.length,
    };

    const version = ctx.stores.content.createVersion(contentItem.id, {
      contentId: contentItem.id,
      languages: [{
        lang: project.defaultLanguage,
        slug: topic.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
        title: topic.title,
        description: socialOutput.text.slice(0, 160),
        contentPath: "",
        wordCount: socialOutput.text.split(/\s+/).length,
      }],
      assets: [],
      social: socialMeta,
      pipelineRunId: ctx.run.id,
      createdAt: now,
      createdBy: "pipeline",
    });

    // Save the post text as a file
    const versionDir = ctx.stores.content.getVersionDir(contentItem.id, version.id);
    const fs = await import("node:fs");
    const path = await import("node:path");
    const contentDir = path.join(versionDir, "content", project.defaultLanguage);
    fs.mkdirSync(contentDir, { recursive: true });

    const postContent = JSON.stringify({
      text: socialOutput.text,
      hashtags: socialOutput.hashtags,
      format: socialOutput.format,
      slides: socialOutput.slides,
      imagePrompt: socialOutput.imagePrompt,
    }, null, 2);
    fs.writeFileSync(path.join(contentDir, "post.json"), postContent, "utf-8");

    // Update content item status
    const status: ContentItemStatus = "draft";
    ctx.stores.content.update(contentItem.id, {
      status,
      currentVersionId: version.id,
      updatedAt: now,
    });

    log.info({ contentId: contentItem.id, platform, status }, "social content version created");
  }

  // ── Done ──────────────────────────────────────────────────
  ctx.updateRun({ status: "completed", completedAt: new Date().toISOString() });
  log.info({ runId: ctx.run.id, platform, cost: ctx.run.totalCostUsd }, "social pipeline completed");
}
