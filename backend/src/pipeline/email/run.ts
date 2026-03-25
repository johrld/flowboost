import { createLogger } from "../../utils/logger.js";
import type { PipelineContext } from "../context.js";
import type { ContentItemStatus, NewsletterVersionMeta } from "../../models/types.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import { buildNewsletterWriterPrompt } from "../prompts/newsletter-writer.js";
import { extractJson } from "../extract-json.js";

const log = createLogger("email-production");

interface NewsletterOutput {
  subject: string;
  previewText: string;
  sections: Array<{ heading: string; body: string }>;
  cta?: { text: string; buttonLabel: string; url: string };
}

/**
 * Run the newsletter production pipeline.
 *
 * Flow: Generate → Quality Check
 *
 * Similar to social pipeline — a single agent call produces
 * the complete newsletter structure.
 */
export async function runEmailPipeline(ctx: PipelineContext): Promise<void> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Email pipeline requires a topic");

  const model = project.pipeline.defaultModel;

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });
  log.info({ topic: topic.title, runId: ctx.run.id }, "starting email pipeline");

  // ── Phase 1: Generate ─────────────────────────────────────
  ctx.startPhase("generate");

  let output: NewsletterOutput;

  try {
    const briefingInputs = (topic.inputs ?? [])
      .filter((i) => i.type === "text" || i.type === "transcript")
      .map((i) => i.content);

    const prompt = buildNewsletterWriterPrompt(project, topic, {
      inputs: briefingInputs,
      researchAngle: topic.suggestedAngle,
    });

    const config: AgentConfig = {
      name: "newsletter-writer",
      model,
      maxTurns: 3,
      useMcpTools: true,
      tools: ["Read", "mcp__flowboost__flowboost_read_project_data"],
    };

    const result = await runAgentTracked(ctx, "generate", prompt, config);
    output = extractJson<NewsletterOutput>(result.text);

    ctx.completePhase("generate");
    log.info({
      subject: output.subject,
      sections: output.sections.length,
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
    const totalWords = output.sections.reduce(
      (sum, s) => sum + s.body.split(/\s+/).length, 0,
    );

    const newsletterMeta: NewsletterVersionMeta = {
      subject: output.subject,
      previewText: output.previewText,
      wordCount: totalWords,
      sectionCount: output.sections.length,
    };

    const version = ctx.stores.content.createVersion(contentItem.id, {
      contentId: contentItem.id,
      languages: [{
        lang: project.defaultLanguage,
        slug: topic.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
        title: output.subject,
        description: output.previewText,
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
