import { createLogger } from "../../utils/logger.js";
import { PipelineContext } from "../../pipeline/context.js";
import { JobStore } from "../../models/job.js";
import { executeJob, loadMemoryContext } from "../executor.js";
import type { Job } from "../../models/types.js";

const log = createLogger("workflow:monitor");

/**
 * Run a background monitor agent.
 * Creates a Job, executes it, and the agent updates project memory via MCP tools.
 */
async function runMonitor(
  ctx: PipelineContext,
  jobs: JobStore,
  agentName: string,
  jobType: Job["type"],
  title: string,
  description: string,
  input: Record<string, unknown>,
): Promise<Job> {
  const now = () => new Date().toISOString();
  const memoryContext = loadMemoryContext(ctx.projectDir);

  const job = jobs.create({
    customerId: ctx.customerId,
    projectId: ctx.project.id,
    type: jobType,
    assigneeAgent: agentName,
    status: "queued",
    title,
    description,
    input,
    comments: [],
    createdAt: now(),
    runId: ctx.run.id,
  }) as Job;

  ctx.startPhase(agentName);
  jobs.transition(job.id, "in_progress");

  try {
    const result = await executeJob(ctx, job, { memoryContext });
    jobs.transition(job.id, "done", { summary: result.text.slice(0, 2000) });
    ctx.completePhase(agentName);
    log.info({ agent: agentName, jobId: job.id, costUsd: result.costUsd }, "monitor completed");
  } catch (err) {
    jobs.transition(job.id, "failed");
    ctx.failPhase(agentName, String(err));
    log.error({ agent: agentName, err }, "monitor failed");
  }

  return jobs.get(job.id) ?? job;
}

/**
 * Run Competitor Monitor — scans competitor blogs and updates memory.
 */
export async function runCompetitorMonitor(ctx: PipelineContext, jobs: JobStore): Promise<Job> {
  const competitors = ctx.project.competitors ?? [];
  return runMonitor(
    ctx, jobs,
    "monitor-competitors",
    "monitor_competitors",
    "Competitor Scan",
    `Scan ${competitors.length} competitors for new content`,
    {
      competitors: competitors.map((c) => ({ domain: c.domain, name: c.name })),
      projectDescription: ctx.project.description,
    },
  );
}

/**
 * Run Trend Scanner — searches for trending topics and updates memory.
 */
export async function runTrendScanner(ctx: PipelineContext, jobs: JobStore): Promise<Job> {
  return runMonitor(
    ctx, jobs,
    "monitor-trends",
    "monitor_trends",
    "Trend Scan",
    `Search for trending topics in the project niche`,
    {
      projectDescription: ctx.project.description,
      categories: ctx.project.categories?.map((c) => c.labels) ?? [],
      keywords: ctx.project.keywords ?? {},
    },
  );
}

/**
 * Run Content Watcher — analyzes content index for staleness and gaps.
 */
export async function runContentWatcher(ctx: PipelineContext, jobs: JobStore): Promise<Job> {
  return runMonitor(
    ctx, jobs,
    "monitor-content",
    "monitor_content",
    "Content Watch",
    `Analyze content index for stale content, gaps, and freshness issues`,
    {
      projectDescription: ctx.project.description,
      defaultLanguage: ctx.project.defaultLanguage,
      languages: ctx.project.languages?.filter((l) => l.enabled).map((l) => l.code) ?? [],
    },
  );
}
