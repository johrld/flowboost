import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { ContentItemStatus, SocialVersionMeta } from "../../models/types.js";
import { ContentTypeStore } from "../../models/content-type.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import { buildContentWriterPrompt } from "../prompts/content-writer.js";
import { extractJson } from "../extract-json.js";

const log = createLogger("social-production");

interface SocialOutput {
  text?: string;
  caption?: string;
  hashtags: string[];
  format?: string;
  image?: string | null;
  slides?: string[] | null;
  [key: string]: unknown;
}

/** Map platform name to content type ID */
const PLATFORM_CONTENT_TYPE: Record<string, string> = {
  linkedin: "linkedin-post",
  instagram: "instagram-post",
  x: "x-post",
  tiktok: "tiktok-post",
};

/**
 * Run the social post production pipeline.
 *
 * Flow: Generate → (optional) Image
 *
 * Uses the generic content writer prompt builder driven by
 * the platform's content type (e.g. linkedin-post.json).
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

  // ── Load content type ────────────────────────────────────
  const ctStore = new ContentTypeStore(ctx.projectDir);
  const contentTypeId = PLATFORM_CONTENT_TYPE[platform] ?? "linkedin-post";
  const contentType = ctStore.get(contentTypeId);
  if (!contentType) {
    const msg = `Content type not found: ${contentTypeId}`;
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw new Error(msg);
  }

  // ── Phase 1: Generate ─────────────────────────────────────
  ctx.startPhase("generate");

  let socialOutput: SocialOutput;

  try {
    const briefingContext = ctx.buildFullFlowContext();
    const prompt = buildContentWriterPrompt(contentType, project, topic, briefingContext);

    const config: AgentConfig = {
      name: `social-writer-${platform}`,
      model,
      maxTurns: 5,
      useMcpTools: true,
      tools: ["Read", "mcp__flowboost__flowboost_read_project_data"],
    };

    const result = await runAgentTracked(ctx, "generate", prompt, config);
    socialOutput = extractJson<SocialOutput>(result.text);

    ctx.completePhase("generate");
    const postText = socialOutput.text ?? socialOutput.caption ?? "";
    log.info({
      platform,
      textLength: postText.length,
      hashtags: socialOutput.hashtags?.length ?? 0,
      format: socialOutput.format,
    }, "social post generated");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("generate", msg);
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw error;
  }

  // ── Phase 2: Image (optional, non-fatal) ──────────────────
  const imagePrompt = socialOutput.image;
  if (imagePrompt) {
    ctx.startPhase("image");
    try {
      // Image generation would go here — skip for now, mark as completed
      ctx.completePhase("image");
      log.info("image phase skipped (not yet implemented for social)");
    } catch (error) {
      log.warn({ err: error }, "social image generation failed — continuing");
      ctx.failPhase("image", error instanceof Error ? error.message : String(error));
    }
  }

  // ── Create ContentVersion ─────────────────────────────────
  const now = new Date().toISOString();
  const postText = socialOutput.text ?? socialOutput.caption ?? "";

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
      characterCount: postText.length,
      hashtagCount: socialOutput.hashtags?.length ?? 0,
      hasMedia: !!imagePrompt,
      format: socialOutput.format as SocialVersionMeta["format"],
      slideCount: socialOutput.slides?.length,
    };

    const version = ctx.stores.content.createVersion(contentItem.id, {
      contentId: contentItem.id,
      languages: [{
        lang: project.defaultLanguage,
        slug: topic.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
        title: topic.title,
        description: postText.slice(0, 160),
        contentPath: "",
        wordCount: postText.split(/\s+/).length,
      }],
      assets: [],
      social: socialMeta,
      pipelineRunId: ctx.run.id,
      createdAt: now,
      createdBy: "pipeline",
    });

    // Save the post as a file
    const versionDir = ctx.stores.content.getVersionDir(contentItem.id, version.id);
    const fs = await import("node:fs");
    const path = await import("node:path");
    const contentDir = path.join(versionDir, "content", project.defaultLanguage);
    fs.mkdirSync(contentDir, { recursive: true });
    fs.writeFileSync(
      path.join(contentDir, "post.json"),
      JSON.stringify(socialOutput, null, 2),
      "utf-8",
    );

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
