import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { ContentItemStatus, SocialVersionMeta, NewsletterVersionMeta } from "../../models/types.js";
import { ContentTypeStore, type CustomContentType } from "../../models/content-type.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import { buildContentWriterPrompt } from "../prompts/content-writer.js";
import { extractJson } from "../extract-json.js";

const log = createLogger("content-pipeline");

/**
 * Generic single-phase content pipeline.
 *
 * Driven entirely by ContentType definition — works for social posts,
 * newsletters, and any future single-phase content type.
 *
 * Flow: Generate → (optional) Image
 *
 * For multi-phase content (articles, guides), use runProductionPipeline instead.
 */
export async function runContentPipeline(
  ctx: PipelineContext,
  contentTypeId: string,
): Promise<void> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Content pipeline requires a topic");

  const model = project.pipeline.defaultModel;

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });
  log.info({ topic: topic.title, contentTypeId, runId: ctx.run.id }, "starting content pipeline");

  // ── Load ContentType ────────────────────────────────────
  const ctStore = new ContentTypeStore(ctx.projectDir);
  const contentType = ctStore.get(contentTypeId);
  if (!contentType) {
    const msg = `Content type not found: ${contentTypeId}`;
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw new Error(msg);
  }

  // ── Phase 1: Write ───────────────────────────────────────
  const phases = contentType.pipeline?.phases ?? ["write"];
  const writePhaseName = phases[0] ?? "write";
  ctx.startPhase(writePhaseName);

  let output: Record<string, unknown>;

  try {
    const briefingContext = ctx.buildFullFlowContext();
    const prompt = buildContentWriterPrompt(contentType, project, topic, briefingContext);

    const config: AgentConfig = {
      name: `content-writer-${contentTypeId}`,
      model,
      maxTurns: 5,
      useMcpTools: true,
      tools: ["Read", "WebSearch", "WebFetch", "mcp__flowboost__flowboost_read_project_data"],
    };

    const result = await runAgentTracked(ctx, writePhaseName, prompt, config);
    output = extractJson<Record<string, unknown>>(result.text);

    ctx.completePhase(writePhaseName);
    log.info({ contentTypeId, outputKeys: Object.keys(output) }, "content generated");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase(writePhaseName, msg);
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw error;
  }

  // ── Phase 2: Image (optional, non-fatal) ────────────────
  const imagePrompt = output.image as string | null | undefined;
  if (phases.includes("image") && imagePrompt) {
    ctx.startPhase("image");
    try {
      // Image generation placeholder — mark as completed
      ctx.completePhase("image");
      log.info("image phase completed (generation pending implementation)");
    } catch (error) {
      log.warn({ err: error }, "image generation failed — continuing");
      ctx.failPhase("image", error instanceof Error ? error.message : String(error));
    }
  }

  // ── Create ContentVersion ───────────────────────────────
  const now = new Date().toISOString();

  // Use run.contentId (set at creation) to find the content item directly —
  // avoids stale topic.outputIds snapshot issue
  const contentItem = ctx.run.contentId
    ? ctx.stores.content.get(ctx.run.contentId)
    : null;

  if (contentItem) {
    // Build type-appropriate version metadata
    const versionMeta = buildVersionMeta(contentType, output);

    const primaryText = extractPrimaryText(contentType, output);
    const slug = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);

    const version = ctx.stores.content.createVersion(contentItem.id, {
      contentId: contentItem.id,
      languages: [{
        lang: project.defaultLanguage,
        slug,
        title: (output.subject as string) ?? topic.title,
        description: primaryText.slice(0, 160),
        contentPath: "",
        wordCount: primaryText.split(/\s+/).length,
      }],
      assets: [],
      ...versionMeta,
      pipelineRunId: ctx.run.id,
      createdAt: now,
      createdBy: "pipeline",
    });

    // Save output as JSON file
    const versionDir = ctx.stores.content.getVersionDir(contentItem.id, version.id);
    const contentDir = path.join(versionDir, "content", project.defaultLanguage);
    fs.mkdirSync(contentDir, { recursive: true });
    fs.writeFileSync(
      path.join(contentDir, `${contentTypeId}.json`),
      JSON.stringify(output, null, 2),
      "utf-8",
    );

    const status: ContentItemStatus = "draft";
    ctx.stores.content.update(contentItem.id, {
      status,
      currentVersionId: version.id,
      updatedAt: now,
    });

    log.info({ contentId: contentItem.id, contentTypeId, status }, "content version created");
  }

  // ── Done ────────────────────────────────────────────────
  ctx.updateRun({ status: "completed", completedAt: new Date().toISOString() });
  log.info({ runId: ctx.run.id, contentTypeId, cost: ctx.run.totalCostUsd }, "content pipeline completed");
}

/**
 * Build type-appropriate version metadata from the content type and agent output.
 */
function buildVersionMeta(
  contentType: CustomContentType,
  output: Record<string, unknown>,
): Record<string, unknown> {
  switch (contentType.category) {
    case "social": {
      const text = (output.text ?? output.caption ?? "") as string;
      const hashtags = (output.hashtags ?? []) as string[];
      const meta: SocialVersionMeta = {
        platform: derivePlatform(contentType.id),
        characterCount: text.length,
        hashtagCount: hashtags.length,
        hasMedia: !!output.image,
        format: output.format as SocialVersionMeta["format"],
        slideCount: Array.isArray(output.slides) ? output.slides.length : undefined,
      };
      return { social: meta };
    }
    case "email": {
      const sections = output.sections as Array<{ heading: string; body: string }> | undefined;
      const totalWords = sections
        ? sections.reduce((sum, s) => sum + s.body.split(/\s+/).length, 0)
        : typeof output.body === "string" ? output.body.split(/\s+/).length : 0;
      const meta: NewsletterVersionMeta = {
        subject: (output.subject ?? "") as string,
        previewText: (output.preview ?? output.previewText ?? "") as string,
        wordCount: totalWords,
        sectionCount: sections?.length ?? 1,
      };
      return { newsletter: meta };
    }
    default:
      return {};
  }
}

/**
 * Extract the primary text content from the agent output for word count and description.
 */
function extractPrimaryText(contentType: CustomContentType, output: Record<string, unknown>): string {
  if (contentType.category === "social") {
    return (output.text ?? output.caption ?? "") as string;
  }
  if (contentType.category === "email") {
    if (typeof output.body === "string") return output.body;
    const sections = output.sections as Array<{ body: string }> | undefined;
    return sections?.map((s) => s.body).join("\n\n") ?? "";
  }
  // Generic: find the first long-text or markdown field
  const textField = contentType.fields.find((f) =>
    f.type === "long-text" || f.type === "markdown" || f.type === "rich-text",
  );
  return textField ? String(output[textField.id] ?? "") : "";
}

/**
 * Derive social platform from content type ID.
 */
function derivePlatform(contentTypeId: string): SocialVersionMeta["platform"] {
  if (contentTypeId.includes("linkedin")) return "linkedin";
  if (contentTypeId.includes("instagram")) return "instagram";
  if (contentTypeId.includes("tiktok")) return "tiktok";
  if (contentTypeId.includes("x-")) return "x";
  return "linkedin";
}
