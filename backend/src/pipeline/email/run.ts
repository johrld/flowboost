import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { ContentItemStatus, NewsletterVersionMeta } from "../../models/types.js";
import { ContentTypeStore } from "../../models/content-type.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import { buildContentWriterPrompt } from "../prompts/content-writer.js";
import { extractJson } from "../extract-json.js";

const log = createLogger("email-production");

interface NewsletterOutput {
  subject: string;
  preview?: string;
  previewText?: string;
  body?: string;
  sections?: Array<{ heading: string; body: string }>;
  cta?: { text: string; buttonLabel: string; url: string };
}

/**
 * Run the newsletter production pipeline.
 *
 * Flow: Generate → Quality Check
 *
 * Uses the generic content writer prompt builder driven by
 * the newsletter content type.
 */
export async function runEmailPipeline(ctx: PipelineContext): Promise<void> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Email pipeline requires a topic");

  const model = project.pipeline.defaultModel;

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });
  log.info({ topic: topic.title, runId: ctx.run.id }, "starting email pipeline");

  // ── Load content type ────────────────────────────────────
  const ctStore = new ContentTypeStore(ctx.projectDir);
  const contentType = ctStore.get("newsletter");
  if (!contentType) {
    const msg = "Content type not found: newsletter";
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw new Error(msg);
  }

  // ── Phase 1: Generate ─────────────────────────────────────
  ctx.startPhase("generate");

  let output: NewsletterOutput;

  try {
    const briefingContext = ctx.buildFullFlowContext();
    const prompt = buildContentWriterPrompt(contentType, project, topic, briefingContext);

    const config: AgentConfig = {
      name: "newsletter-writer",
      model,
      maxTurns: 5,
      useMcpTools: true,
      tools: ["Read", "mcp__flowboost__flowboost_read_project_data"],
    };

    const result = await runAgentTracked(ctx, "generate", prompt, config);
    output = extractJson<NewsletterOutput>(result.text);

    ctx.completePhase("generate");
    log.info({
      subject: output.subject,
      sections: output.sections?.length ?? 0,
    }, "newsletter generated");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("generate", msg);
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw error;
  }

  // ── Create ContentVersion ─────────────────────────────────
  const now = new Date().toISOString();
  const outputIds = topic.outputIds ?? [];
  const contentItems = outputIds
    .map((id) => ctx.stores.content.get(id))
    .filter((item) => item !== null);

  const contentItem = contentItems.find((item) =>
    item!.type === "newsletter" && item!.status === "planned",
  );

  if (contentItem) {
    const previewText = output.preview ?? output.previewText ?? "";
    const totalWords = output.sections
      ? output.sections.reduce((sum, s) => sum + s.body.split(/\s+/).length, 0)
      : output.body ? output.body.split(/\s+/).length : 0;

    const newsletterMeta: NewsletterVersionMeta = {
      subject: output.subject,
      previewText,
      wordCount: totalWords,
      sectionCount: output.sections?.length ?? 1,
    };

    const version = ctx.stores.content.createVersion(contentItem.id, {
      contentId: contentItem.id,
      languages: [{
        lang: project.defaultLanguage,
        slug: topic.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
        title: output.subject,
        description: previewText,
        contentPath: "",
        wordCount: totalWords,
      }],
      assets: [],
      newsletter: newsletterMeta,
      pipelineRunId: ctx.run.id,
      createdAt: now,
      createdBy: "pipeline",
    });

    // Save newsletter content as JSON
    const versionDir = ctx.stores.content.getVersionDir(contentItem.id, version.id);
    const fs = await import("node:fs");
    const path = await import("node:path");
    const contentDir = path.join(versionDir, "content", project.defaultLanguage);
    fs.mkdirSync(contentDir, { recursive: true });
    fs.writeFileSync(
      path.join(contentDir, "newsletter.json"),
      JSON.stringify(output, null, 2),
      "utf-8",
    );

    const status: ContentItemStatus = "draft";
    ctx.stores.content.update(contentItem.id, {
      status,
      currentVersionId: version.id,
      updatedAt: now,
    });

    log.info({ contentId: contentItem.id, status }, "newsletter content version created");
  }

  // ── Done ──────────────────────────────────────────────────
  ctx.updateRun({ status: "completed", completedAt: new Date().toISOString() });
  log.info({ runId: ctx.run.id, cost: ctx.run.totalCostUsd }, "email pipeline completed");
}
