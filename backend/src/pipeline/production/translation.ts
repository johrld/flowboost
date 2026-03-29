import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import type { PipelineContext } from "../context.js";
import type { Outline } from "./outline.js";
import { buildTranslatorPrompt } from "../prompts/translator.js";

const log = createLogger("production:translation");

export interface TranslationResult {
  lang: string;
  slug: string;
  outputPath: string;
}

/**
 * Run the Translation phase.
 * Translates the default-language article to all other enabled languages in parallel.
 */
export async function runTranslationPhase(
  ctx: PipelineContext,
  outline: Outline,
  sourceArticlePath: string,
  versionDir: string,
): Promise<TranslationResult[]> {
  const { project } = ctx;
  const model = project.pipeline.defaultModel;

  // Get translation slugs from the meta section of the outline
  const metaSection = outline.sections.find((s) => s.type === "meta");
  const translations = (metaSection?.frontmatter as Record<string, unknown>)?.translations as Record<string, string> | undefined;

  // Check content type localization mode — skip translation for single-language types
  const contentId = ctx.run.contentId;
  if (contentId) {
    try {
      const { ContentTypeStore } = await import("../../models/content-type.js");
      const ctStore = new ContentTypeStore(ctx.projectDir);
      const item = ctx.stores.content.get(contentId);
      const ctId = item?.type === "social_post" ? `${item.category ?? "linkedin"}-post`
        : item?.type === "newsletter" ? "newsletter" : "blog-post";
      const contentType = ctStore.get(ctId);
      if (contentType?.localization?.mode === "single" || contentType?.localization?.translateOnGenerate === false) {
        log.info({ contentTypeId: ctId }, "single-language content type — skipping translation");
        ctx.startPhase("translation");
        ctx.completePhase("translation");
        return [];
      }
    } catch { /* ignore — fall through to default behavior */ }
  }

  // Filter to enabled non-default languages
  const targetLanguages = project.languages
    .filter((l) => l.enabled && l.code !== project.defaultLanguage);

  if (targetLanguages.length === 0) {
    log.info("no target languages — skipping translation");
    ctx.startPhase("translation");
    ctx.completePhase("translation");
    return [];
  }

  log.info({ languages: targetLanguages.map((l) => l.code) }, "starting translation phase");
  ctx.startPhase("translation");

  try {
    // Run all translations in parallel
    const promises = targetLanguages.map((lang) => {
      const slug = translations?.[lang.code] ?? path.basename(sourceArticlePath, ".md");
      const outputPath = path.join(versionDir, "content", lang.code, `${slug}.md`);

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      return translateToLanguage(ctx, sourceArticlePath, lang.code, slug, outputPath, model);
    });

    const results = await Promise.allSettled(promises);

    // Collect successes
    const translations_done: TranslationResult[] = [];
    const failures: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const lang = targetLanguages[i];
      if (result.status === "fulfilled") {
        translations_done.push(result.value);
      } else {
        failures.push(`${lang.code}: ${result.reason?.message ?? "Unknown error"}`);
      }
    }

    if (failures.length > 0) {
      log.warn({ failures }, "some translations failed");
      // Partial success is still acceptable — don't fail the whole phase
      if (translations_done.length === 0) {
        throw new Error(`All translations failed: ${failures.join("; ")}`);
      }
    }

    ctx.completePhase("translation");
    log.info({ translated: translations_done.map((t) => t.lang) }, "translation phase complete");

    return translations_done;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("translation", msg);
    throw error;
  }
}

async function translateToLanguage(
  ctx: PipelineContext,
  sourceArticlePath: string,
  targetLang: string,
  targetSlug: string,
  outputPath: string,
  model: string,
): Promise<TranslationResult> {
  log.info({ targetLang, targetSlug }, "translating article");

  const config: AgentConfig = {
    name: `translator:${targetLang}`,
    model,
    maxTurns: 10,
    useMcpTools: true,
    tools: [
      "Read",
      "Write",
      "mcp__flowboost__flowboost_read_project_data",
      "mcp__flowboost__flowboost_validate_article",
    ],
  };

  const prompt = buildTranslatorPrompt(ctx.project, sourceArticlePath, targetLang, targetSlug, outputPath);
  await runAgentTracked(ctx, "translation", prompt, config);

  return { lang: targetLang, slug: targetSlug, outputPath };
}
