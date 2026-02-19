import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { Article, ArticleVersion, ContentItemStatus, LanguageVariant } from "../../models/types.js";
import { runOutlinePhase } from "./outline.js";
import { runWritingPhase } from "./writing.js";
import { runAssemblyPhase } from "./assembly.js";
import { runImagePhase } from "./image.js";
import { runQualityPhase } from "./quality.js";
import { runTranslationPhase } from "./translation.js";

const log = createLogger("production");

/**
 * Run the full production pipeline for a single approved topic.
 *
 * Flow:
 *   Outline → Writing (parallel) → Assembly → Image → Quality → Translation (parallel)
 *
 * Quality failures trigger a retry (max retries from project settings).
 * Image failures are non-fatal — the pipeline continues without a hero image.
 */
export async function runProductionPipeline(ctx: PipelineContext): Promise<Article> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Production pipeline requires a topic");

  const maxRetries = project.pipeline.maxRetriesPerPhase;

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });
  log.info({ topic: topic.title, runId: ctx.run.id }, "starting production pipeline");

  // ── Phase 1: Outline ───────────────────────────────────────────
  const outline = await runOutlinePhase(ctx);

  // Determine output paths
  const article = ctx.stores.articles.create({
    customerId: ctx.customerId,
    projectId: project.id,
    topicId: topic.id,
    translationKey: outline.sections.find((s) => s.type === "meta")
      ?.frontmatter
      ? ((outline.sections.find((s) => s.type === "meta")!.frontmatter as Record<string, unknown>).translationKey as string)
      : topic.id,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const slug = getSlugFromOutline(outline, project.defaultLanguage);
  const version = ctx.stores.articles.createVersion(article.id, {
    articleId: article.id,
    lang: project.defaultLanguage,
    slug,
    wordCount: 0,
    contentPath: `content/${project.defaultLanguage}/${slug}.md`,
    createdAt: new Date().toISOString(),
  });

  const versionDir = ctx.stores.articles.getVersionDir(article.id, version.id);
  const defaultLangDir = path.join(versionDir, "content", project.defaultLanguage);
  fs.mkdirSync(defaultLangDir, { recursive: true });
  const articlePath = path.join(defaultLangDir, `${version.slug}.md`);

  // ── Phase 2: Writing (parallel) ────────────────────────────────
  await runWritingPhase(ctx, outline);

  // ── Phase 3: Assembly ──────────────────────────────────────────
  await runAssemblyPhase(ctx, outline, articlePath);

  // ── Phase 4: Image (non-fatal) ─────────────────────────────────
  let imagePath: string | undefined;
  try {
    const imageOutputDir = path.join(versionDir, "assets", project.defaultLanguage);
    fs.mkdirSync(imageOutputDir, { recursive: true });
    const imageFile = path.join(imageOutputDir, `${version.slug}-hero.png`);
    imagePath = await runImagePhase(ctx, articlePath, imageFile);
  } catch (error) {
    log.warn({ err: error }, "image generation failed — continuing without hero image");
    // Don't fail the pipeline for image issues
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
      // Re-run assembly with quality feedback embedded
      // Reset quality phase status for next attempt
      ctx.startPhase("quality");
      await runAssemblyPhase(ctx, outline, articlePath);
    }
  }

  if (!qualityPassed) {
    log.warn("quality checks failed after all retries — article saved as draft");
  }

  // ── Phase 6: Translation (parallel) ────────────────────────────
  const translations = await runTranslationPhase(ctx, outline, articlePath, versionDir);

  // Create version records for translations
  for (const t of translations) {
    ctx.stores.articles.createVersion(article.id, {
      articleId: article.id,
      lang: t.lang,
      slug: t.slug,
      wordCount: 0,
      contentPath: `content/${t.lang}/${t.slug}.md`,
      createdAt: new Date().toISOString(),
    });
  }

  // ── Done ───────────────────────────────────────────────────────
  // Update article status (V2 — kept for backward compat)
  const finalStatus = qualityPassed ? "review" : "draft";
  ctx.stores.articles.update(article.id, {
    status: finalStatus,
    updatedAt: new Date().toISOString(),
  });

  // ── Create ContentItem + ContentVersion (V3) ─────────────────
  const contentStatus: ContentItemStatus = qualityPassed ? "review" : "draft";
  const now = new Date().toISOString();

  // Extract metadata from outline
  const metaSection = outline.sections.find((s) => s.type === "meta");
  const metaFm = (metaSection?.frontmatter ?? {}) as Record<string, unknown>;

  const contentItem = ctx.stores.content.create({
    customerId: ctx.customerId,
    projectId: project.id,
    type: "article",
    status: contentStatus,
    title: topic.title,
    description: typeof metaFm.description === "string" ? metaFm.description : undefined,
    category: topic.category,
    tags: Array.isArray(metaFm.tags) ? metaFm.tags as string[] : undefined,
    keywords: topic.keywords
      ? [topic.keywords.primary, ...topic.keywords.secondary]
      : undefined,
    topicId: topic.id,
    translationKey: article.translationKey,
    createdAt: now,
    updatedAt: now,
  });

  // Build language variants from article versions
  const allArticleVersions = ctx.stores.articles.getVersions(article.id);
  const languages: LanguageVariant[] = allArticleVersions.map((av) => ({
    lang: av.lang,
    slug: av.slug,
    title: topic.title, // Will be refined per-language in future
    description: typeof metaFm.description === "string" ? metaFm.description : "",
    contentPath: av.contentPath,
    wordCount: av.wordCount,
  }));

  const contentVersion = ctx.stores.content.createVersion(contentItem.id, {
    contentId: contentItem.id,
    languages,
    assets: [],
    text: {
      wordCount: allArticleVersions.reduce((sum, v) => sum + (v.wordCount || 0), 0),
      headingCount: 0,
      hasFaq: !!metaFm.faq,
      hasAnswerCapsule: true,
    },
    pipelineRunId: ctx.run.id,
    createdAt: now,
    createdBy: "pipeline",
  });

  // Update ContentItem with version reference
  ctx.stores.content.update(contentItem.id, {
    currentVersionId: contentVersion.id,
  });

  // Update topic status in TopicStore
  ctx.stores.topics.update(topic.id, {
    status: "produced",
    articleId: article.id,
  });

  ctx.updateRun({ status: "completed", completedAt: new Date().toISOString() });
  log.info({
    runId: ctx.run.id,
    articleId: article.id,
    contentId: contentItem.id,
    status: finalStatus,
    languages: [project.defaultLanguage, ...translations.map((t) => t.lang)],
    cost: ctx.run.totalCostUsd,
    imagePath,
  }, "production pipeline completed");

  return ctx.stores.articles.get(article.id)!;
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
