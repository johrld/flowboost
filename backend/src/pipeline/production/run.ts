import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { ContentItem, ContentItemStatus, ContentMediaAsset, LanguageVariant } from "../../models/types.js";
import { ContentMediaStore } from "../../models/content-media.js";
import { runOutlinePhase } from "./outline.js";
import { runWritingPhase } from "./writing.js";
import { runAssemblyPhase } from "./assembly.js";
import { runImagePhase } from "./image.js";
import { runQualityPhase } from "./quality.js";
import { runTranslationPhase } from "./translation.js";

const log = createLogger("production");

/**
 * Run the full production pipeline for a single topic.
 *
 * Flow:
 *   Outline → Writing (parallel) → Assembly → Image → Quality → Translation (parallel)
 *
 * Creates a ContentItem + ContentVersion (V3 only — Article V2 removed).
 * Quality failures trigger a retry (max retries from project settings).
 * Image failures are non-fatal — the pipeline continues without a hero image.
 */
export async function runProductionPipeline(ctx: PipelineContext): Promise<ContentItem> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Production pipeline requires a topic");

  const maxRetries = project.pipeline.maxRetriesPerPhase;

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });
  log.info({ topic: topic.title, runId: ctx.run.id }, "starting production pipeline");

  // ── Phase 1: Outline ───────────────────────────────────────────
  const outline = await runOutlinePhase(ctx);

  // Extract metadata from outline
  const metaSection = outline.sections.find((s) => s.type === "meta");
  const metaFm = (metaSection?.frontmatter ?? {}) as Record<string, unknown>;
  const slug = getSlugFromOutline(outline, project.defaultLanguage);
  const translationKey = typeof metaFm.translationKey === "string" ? metaFm.translationKey : topic.id;
  const now = new Date().toISOString();

  // Use pre-created ContentItem from produce endpoint (via run.contentId)
  // Falls back to creating one if called directly (e.g. from strategy pipeline)
  let contentItem: ContentItem;
  const preCreated = ctx.run.contentId ? ctx.stores.content.get(ctx.run.contentId) : null;
  if (preCreated) {
    contentItem = preCreated;
    ctx.stores.content.update(contentItem.id, {
      status: "producing" as ContentItemStatus,
      description: typeof metaFm.description === "string" ? metaFm.description : undefined,
      tags: Array.isArray(metaFm.tags) ? metaFm.tags as string[] : undefined,
      keywords: topic.enrichment?.seo?.keywords
        ? [topic.enrichment.seo.keywords.primary, ...topic.enrichment.seo.keywords.secondary]
        : undefined,
      translationKey,
      updatedAt: now,
    });
  } else {
    contentItem = ctx.stores.content.create({
      customerId: ctx.customerId,
      projectId: project.id,
      type: "article" as ContentItem["type"],
      status: "producing" as ContentItemStatus,
      title: topic.title,
      description: typeof metaFm.description === "string" ? metaFm.description : undefined,
      category: topic.category,
      tags: Array.isArray(metaFm.tags) ? metaFm.tags as string[] : undefined,
      keywords: topic.enrichment?.seo?.keywords
        ? [topic.enrichment.seo.keywords.primary, ...topic.enrichment.seo.keywords.secondary]
        : undefined,
      flowId: topic.id,
      originFlowId: topic.id,
      topicId: topic.id,
      translationKey,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create initial ContentVersion for default language
  const languages: LanguageVariant[] = [{
    lang: project.defaultLanguage,
    slug,
    title: topic.title,
    description: typeof metaFm.description === "string" ? metaFm.description : "",
    contentPath: `content/${project.defaultLanguage}/${slug}.md`,
    wordCount: 0,
  }];

  const contentVersion = ctx.stores.content.createVersion(contentItem.id, {
    contentId: contentItem.id,
    languages,
    assets: [],
    pipelineRunId: ctx.run.id,
    createdAt: now,
    createdBy: "pipeline",
  });

  ctx.stores.content.update(contentItem.id, { currentVersionId: contentVersion.id });

  // Set up output directory
  const versionDir = ctx.stores.content.getVersionDir(contentItem.id, contentVersion.id);
  const defaultLangDir = path.join(versionDir, "content", project.defaultLanguage);
  fs.mkdirSync(defaultLangDir, { recursive: true });
  const articlePath = path.join(defaultLangDir, `${slug}.md`);

  // Add to flow outputs (skip if already added by produce endpoint)
  if (!preCreated) {
    ctx.stores.topics.addOutput(topic.id, contentItem.id);
  }

  // ── Phase 2: Writing (parallel) ────────────────────────────────
  await runWritingPhase(ctx, outline);

  // ── Phase 3: Assembly ──────────────────────────────────────────
  await runAssemblyPhase(ctx, outline, articlePath);

  // ── Phase 4: Image (non-fatal) ─────────────────────────────────
  let imagePath: string | undefined;
  try {
    const imageOutputDir = path.join(versionDir, "assets", project.defaultLanguage);
    fs.mkdirSync(imageOutputDir, { recursive: true });
    const imageFile = path.join(imageOutputDir, `${slug}-hero.png`);
    imagePath = await runImagePhase(ctx, articlePath, imageFile);
  } catch (error) {
    log.warn({ err: error }, "image generation failed — continuing without hero image");
  }

  // ── Phase 5: Quality (with retry) ──────────────────────────────
  let qualityPassed = false;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const quality = await runQualityPhase(ctx, articlePath);

    if (quality.overallPass) {
      qualityPassed = true;
      break;
    }

    if (attempt < maxRetries) {
      log.info({ attempt: attempt + 1, maxRetries }, "quality failed — retrying assembly");
      ctx.startPhase("quality");
      await runAssemblyPhase(ctx, outline, articlePath);
    }
  }

  if (!qualityPassed) {
    log.warn("quality checks failed after all retries — saved as draft");
  }

  // ── Phase 6: Translation (parallel) ────────────────────────────
  const translations = await runTranslationPhase(ctx, outline, articlePath, versionDir);

  // Update content version with translation languages
  if (translations.length > 0) {
    const updatedLanguages: LanguageVariant[] = [
      ...languages,
      ...translations.map((t) => ({
        lang: t.lang,
        slug: t.slug,
        title: topic.title,
        description: typeof metaFm.description === "string" ? metaFm.description : "",
        contentPath: `content/${t.lang}/${t.slug}.md`,
        wordCount: 0,
      })),
    ];
    ctx.stores.content.updateVersion(contentItem.id, contentVersion.id, {
      languages: updatedLanguages,
    });
  }

  // ── Done ───────────────────────────────────────────────────────
  const finalStatus: ContentItemStatus = qualityPassed ? "review" : "draft";
  ctx.stores.content.update(contentItem.id, {
    status: finalStatus,
    updatedAt: new Date().toISOString(),
  });

  // Track hero image in media store
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      const imgBuffer = fs.readFileSync(imagePath);
      const imgMeta = await sharp(imgBuffer).metadata();
      const assetId = crypto.randomUUID();
      const fileName = `${assetId}.png`;
      const seoFilename = `${slug}-hero`;

      const asset: ContentMediaAsset = {
        id: assetId,
        contentId: contentItem.id,
        type: "image",
        source: "generated",
        role: "hero",
        mimeType: "image/png",
        fileName,
        seoFilename,
        fileSize: imgBuffer.length,
        width: imgMeta.width,
        height: imgMeta.height,
        generationModel: project.pipeline.imagenModel ?? "imagen-4.0-fast-generate-001",
        createdAt: now,
      };

      const contentDir = ctx.stores.content.entityDir(contentItem.id);
      const mediaStore = new ContentMediaStore(contentDir);
      mediaStore.add(asset, imgBuffer);

      ctx.stores.content.update(contentItem.id, { heroImageId: assetId });
      log.info({ contentId: contentItem.id, assetId }, "hero image tracked");
    } catch (err) {
      log.warn({ err }, "failed to track hero image — non-fatal");
    }
  }

  // Update topic status
  ctx.stores.topics.update(topic.id, { status: "produced" });

  ctx.updateRun({ status: "completed", completedAt: new Date().toISOString() });
  log.info({
    runId: ctx.run.id,
    contentId: contentItem.id,
    status: finalStatus,
    languages: [project.defaultLanguage, ...translations.map((t) => t.lang)],
    cost: ctx.run.totalCostUsd,
    imagePath,
  }, "production pipeline completed");

  return ctx.stores.content.get(contentItem.id)!;
}

function getSlugFromOutline(outline: { sections: Array<{ type: string; frontmatter?: unknown; [key: string]: unknown }> }, defaultLang: string): string {
  const meta = outline.sections.find((s) => s.type === "meta");
  if (meta?.frontmatter) {
    const fm = meta.frontmatter as Record<string, unknown>;
    if (typeof fm.slug === "string") return fm.slug;
    if (typeof fm.translationKey === "string") return fm.translationKey;
  }
  return `article-${Date.now()}`;
}
