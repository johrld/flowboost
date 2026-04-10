import { createLogger } from "../../utils/logger.js";
import { PipelineContext } from "../../pipeline/context.js";
import { JobStore } from "../../models/job.js";
import { MemoryStore } from "../../models/memory.js";
import { executeJob, loadMemoryContext } from "../executor.js";
import { extractJson } from "../../pipeline/extract-json.js";
import type { Job, ContentItem, ContentItemStatus } from "../../models/types.js";

const log = createLogger("workflow:article");

/**
 * Article Production Workflow (Job-based).
 *
 * Orchestrates: Research → Outline → Parallel Section Writers → Content Editor → Quality Checks
 *
 * Each step creates a Job, executes it, and uses the output to feed the next step.
 * This replaces the old production pipeline for articles.
 */
export async function runArticleWorkflow(
  ctx: PipelineContext,
  jobs: JobStore,
  opts?: { skipResearch?: boolean },
): Promise<ContentItem> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Article workflow requires a topic");

  const memoryContext = loadMemoryContext(ctx.projectDir);
  const flowContext = ctx.buildFullFlowContext({ includeChat: true });
  const now = () => new Date().toISOString();

  log.info({ topic: topic.title, runId: ctx.run.id }, "starting article workflow");
  ctx.updateRun({ status: "running", startedAt: now() });

  // ── Step 1: Research ──────────────────────────────────────
  let researchOutput: Record<string, unknown> = {};

  if (!opts?.skipResearch) {
    ctx.startPhase("research");
    const researchJob = jobs.create({
      customerId: ctx.customerId,
      projectId: project.id,
      type: "research",
      flowId: topic.id,
      assigneeAgent: "research",
      status: "queued",
      title: `Research: ${topic.title}`,
      description: `Research keywords, competitors, and sources for "${topic.title}"`,
      input: {
        topicTitle: topic.title,
        category: topic.category,
        briefing: topic.briefing ?? "",
        existingKeywords: topic.enrichment?.seo?.keywords ?? {},
      },
      comments: [],
      createdAt: now(),
      runId: ctx.run.id,
    }) as Job;

    jobs.transition(researchJob.id, "in_progress");
    try {
      const result = await executeJob(ctx, researchJob, { memoryContext, additionalContext: flowContext });
      researchOutput = extractJson(result.text) ?? {};
      jobs.transition(researchJob.id, "done", researchOutput);
      ctx.completePhase("research");
    } catch (err) {
      jobs.transition(researchJob.id, "failed");
      ctx.failPhase("research", String(err));
      log.warn({ err }, "research failed, continuing without it");
    }
  }

  // ── Step 2: Outline ───────────────────────────────────────
  ctx.startPhase("outline");
  const outlineJob = jobs.create({
    customerId: ctx.customerId,
    projectId: project.id,
    type: "write_article",
    flowId: topic.id,
    assigneeAgent: "outline-architect",
    status: "queued",
    title: `Outline: ${topic.title}`,
    description: `Create article outline for "${topic.title}"`,
    input: {
      topicTitle: topic.title,
      briefing: topic.briefing ?? "",
      research: researchOutput,
      category: topic.category,
    },
    comments: [],
    createdAt: now(),
    runId: ctx.run.id,
  }) as Job;

  jobs.transition(outlineJob.id, "in_progress");
  let outline: Record<string, unknown>;
  try {
    const result = await executeJob(ctx, outlineJob, { memoryContext, additionalContext: flowContext });
    outline = extractJson(result.text) ?? { sections: [] };
    jobs.transition(outlineJob.id, "done", outline);
    ctx.completePhase("outline");
  } catch (err) {
    jobs.transition(outlineJob.id, "failed");
    ctx.failPhase("outline", String(err));
    throw new Error(`Outline failed: ${err}`);
  }

  // ── Step 3: Parallel Section Writing ──────────────────────
  ctx.startPhase("writing");
  const sections = (outline.sections ?? []) as Array<{ id: string; title?: string; type: string; targetWords?: number; instructions?: string }>;
  const sectionOutputs: Record<string, string> = {};

  const writerJobs = sections.map((section) => {
    const job = jobs.create({
      customerId: ctx.customerId,
      projectId: project.id,
      type: "write_section",
      flowId: topic.id,
      parentJobId: outlineJob.id,
      assigneeAgent: "section-writer",
      status: "queued",
      title: `Write: ${section.title ?? section.id}`,
      description: section.instructions ?? `Write section "${section.title ?? section.id}"`,
      input: {
        sectionId: section.id,
        sectionTitle: section.title,
        sectionType: section.type,
        targetWords: section.targetWords ?? 300,
        instructions: section.instructions ?? "",
        outlineSummary: JSON.stringify(outline),
      },
      comments: [],
      createdAt: now(),
      runId: ctx.run.id,
    }) as Job;
    return job;
  });

  // Execute all section writers in parallel
  const writerResults = await Promise.allSettled(
    writerJobs.map(async (job) => {
      jobs.transition(job.id, "in_progress");
      try {
        const result = await executeJob(ctx, job, { additionalContext: flowContext });
        sectionOutputs[job.input.sectionId as string] = result.text;
        jobs.transition(job.id, "done", { markdown: result.text });
        return result;
      } catch (err) {
        jobs.transition(job.id, "failed");
        throw err;
      }
    }),
  );

  const failedWriters = writerResults.filter((r) => r.status === "rejected");
  if (failedWriters.length === writerResults.length) {
    ctx.failPhase("writing", "All section writers failed");
    throw new Error("All section writers failed");
  }
  ctx.completePhase("writing");

  // ── Step 4: Assembly ──────────────────────────────────────
  ctx.startPhase("assembly");
  const assemblyJob = jobs.create({
    customerId: ctx.customerId,
    projectId: project.id,
    type: "edit_article",
    flowId: topic.id,
    assigneeAgent: "content-editor",
    status: "queued",
    title: `Assemble: ${topic.title}`,
    description: `Assemble sections into complete article for "${topic.title}"`,
    input: {
      outline: JSON.stringify(outline),
      sections: sectionOutputs,
      topicTitle: topic.title,
      category: topic.category,
    },
    comments: [],
    createdAt: now(),
    runId: ctx.run.id,
  }) as Job;

  jobs.transition(assemblyJob.id, "in_progress");
  let assembledArticle: string;
  try {
    const result = await executeJob(ctx, assemblyJob, { additionalContext: flowContext });
    assembledArticle = result.text;
    jobs.transition(assemblyJob.id, "done", { markdown: assembledArticle });
    ctx.completePhase("assembly");
  } catch (err) {
    jobs.transition(assemblyJob.id, "failed");
    ctx.failPhase("assembly", String(err));
    throw new Error(`Assembly failed: ${err}`);
  }

  // ── Step 5: Quality Checks (parallel) ─────────────────────
  ctx.startPhase("quality");
  const qualityAgents = ["quality-seo"];

  // Add health-specific checks if enabled
  if (project.pipeline.healthContentChecks) {
    qualityAgents.push("quality-citations", "quality-eeat", "quality-health");
  }

  const qualityJobs = qualityAgents.map((agent) => {
    const job = jobs.create({
      customerId: ctx.customerId,
      projectId: project.id,
      type: "quality_check",
      flowId: topic.id,
      assigneeAgent: agent,
      status: "queued",
      title: `Quality: ${agent.replace("quality-", "")} check`,
      description: `Run ${agent} check on assembled article`,
      input: { article: assembledArticle },
      comments: [],
      createdAt: now(),
      runId: ctx.run.id,
    }) as Job;
    return job;
  });

  const qualityResults = await Promise.allSettled(
    qualityJobs.map(async (job) => {
      jobs.transition(job.id, "in_progress");
      try {
        const result = await executeJob(ctx, job, { memoryContext });
        const parsed = extractJson(result.text) ?? { score: 0, pass: false, issues: [] } as Record<string, unknown>;
        jobs.transition(job.id, "done", parsed as Record<string, unknown>);
        return parsed as { score: number; pass: boolean; issues: Array<{ severity: string; message: string }> };
      } catch (err) {
        jobs.transition(job.id, "failed");
        return { score: 0, pass: false, issues: [{ severity: "error", message: String(err) }] };
      }
    }),
  );

  const qualityPassed = qualityResults.every((r) =>
    r.status === "fulfilled" && r.value.pass,
  );
  ctx.completePhase("quality");

  // ── Create/Update Content Item ────────────────────────────
  const contentNow = now();
  let contentItem: ContentItem;
  const preCreated = ctx.run.contentId ? ctx.stores.content.get(ctx.run.contentId) : null;

  if (preCreated) {
    contentItem = preCreated;
    ctx.stores.content.update(contentItem.id, {
      status: (qualityPassed ? "draft" : "review") as ContentItemStatus,
      updatedAt: contentNow,
    });
  } else {
    contentItem = ctx.stores.content.create({
      customerId: ctx.customerId,
      projectId: project.id,
      type: "article" as ContentItem["type"],
      status: (qualityPassed ? "draft" : "review") as ContentItemStatus,
      title: topic.title,
      category: topic.category,
      flowId: topic.id,
      originFlowId: topic.id,
      topicId: topic.id,
      createdAt: contentNow,
      updatedAt: contentNow,
    }) as ContentItem;
  }

  // Save article as version file
  ctx.stores.content.writeTextFile(contentItem.id, "v1.md", assembledArticle);

  // Update run
  ctx.updateRun({
    status: "completed",
    completedAt: contentNow,
    contentId: contentItem.id,
  });

  log.info(
    { contentId: contentItem.id, qualityPassed, topic: topic.title },
    "article workflow completed",
  );

  return contentItem;
}
