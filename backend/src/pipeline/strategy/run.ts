import { createLogger } from "../../utils/logger.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import type { PipelineContext } from "../context.js";
import type { ContentPlan, Topic } from "../../models/types.js";
import { buildAuditorPrompt } from "../prompts/auditor.js";
import { buildResearcherPrompt } from "../prompts/researcher.js";
import { buildStrategistPrompt } from "../prompts/strategist.js";
import { extractJson } from "../extract-json.js";
import { ContentIndexStore } from "../../models/content-index.js";
import { SyncService } from "../../services/sync.js";
import { createSiteConnector } from "../../connectors/site/factory.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";

const log = createLogger("strategy");

/**
 * Run the full strategy pipeline: Auditor → Researcher → Strategist.
 * Each agent runs sequentially, passing structured data to the next.
 */
export async function runStrategyPipeline(ctx: PipelineContext): Promise<ContentPlan> {
  const { project } = ctx;
  const model = project.pipeline.defaultModel;

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });

  // Sync Content Index via GitHub API (no repo clone needed)
  try {
    const indexStore = new ContentIndexStore(ctx.dataDir);
    const syncService = new SyncService(indexStore, parseFrontmatter);
    const connector = createSiteConnector(project);
    const reader = connector.createReader();
    const syncResult = await syncService.fullSync(ctx.customerId, project.id, reader);
    log.info(syncResult, "content index synced before audit");
  } catch (err) {
    log.warn({ err }, "content index sync failed — audit will use stale data");
  }

  // ── Phase 1: Audit ─────────────────────────────────────────────
  log.info("starting audit phase");
  ctx.startPhase("audit");

  let auditResult: {
    totalArticles: number;
    byCategory: Record<string, number>;
    byLanguage: Record<string, number>;
    existingArticles: Array<{ title: string; keywords: string[] }>;
    categoryGaps: string[];
    recommendations: string[];
  };

  try {
    const auditorConfig: AgentConfig = {
      name: "content-auditor",
      model,
      maxTurns: 10,
      useMcpTools: true,
      tools: [
        "mcp__flowboost__flowboost_read_project_data",
        "mcp__flowboost__flowboost_read_content_index",
      ],
    };

    const prompt = buildAuditorPrompt(project);
    const result = await runAgentTracked(ctx, "audit", prompt, auditorConfig);
    auditResult = extractJson(result.text);
    ctx.completePhase("audit");
    log.info({ totalArticles: auditResult.totalArticles, gaps: auditResult.categoryGaps }, "audit complete");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("audit", msg);
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw error;
  }

  // ── Phase 2: Research ──────────────────────────────────────────
  log.info("starting research phase");
  ctx.startPhase("research");

  let researchResult: {
    topics: Array<{
      title: string;
      category: string;
      keywords: { primary: string; secondary: string[]; longTail: string[] };
      searchIntent: string;
      competitorInsights: string;
      suggestedAngle: string;
      estimatedSections: number;
      reasoning: string;
    }>;
  };

  try {
    const researcherConfig: AgentConfig = {
      name: "topic-researcher",
      model,
      maxTurns: 30,
      useMcpTools: true,
      tools: ["WebSearch", "WebFetch", "Read", "mcp__flowboost__flowboost_read_project_data"],
    };

    const prompt = buildResearcherPrompt(project, {
      categoryGaps: auditResult.categoryGaps,
      existingArticles: auditResult.existingArticles,
      recommendations: auditResult.recommendations,
    });
    const result = await runAgentTracked(ctx, "research", prompt, researcherConfig);
    researchResult = extractJson(result.text);
    ctx.completePhase("research");
    log.info({ topicCount: researchResult.topics.length }, "research complete");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("research", msg);
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw error;
  }

  // ── Phase 3: Strategy ──────────────────────────────────────────
  log.info("starting strategy phase");
  ctx.startPhase("strategy");

  let contentPlan: ContentPlan;

  try {
    const strategistConfig: AgentConfig = {
      name: "content-strategist",
      model,
      maxTurns: 10,
      useMcpTools: true,
      tools: ["Read", "Write", "mcp__flowboost__flowboost_read_project_data"],
    };

    const prompt = buildStrategistPrompt(project, {
      totalArticles: auditResult.totalArticles,
      byCategory: auditResult.byCategory,
      byLanguage: auditResult.byLanguage,
      categoryGaps: auditResult.categoryGaps,
      recommendations: auditResult.recommendations,
    }, researchResult);

    const result = await runAgentTracked(ctx, "strategy", prompt, strategistConfig);
    const strategyOutput = extractJson<ContentPlan & { topics?: Topic[] }>(result.text);

    // Extract topics and save individually to TopicStore
    const topics = strategyOutput.topics ?? [];
    const now = new Date().toISOString();
    for (const topic of topics) {
      if (!topic.id) topic.id = crypto.randomUUID();
      if (!topic.status) topic.status = "proposed";
      topic.createdAt = now;
      topic.runId = ctx.run.id;
      ctx.stores.topics.update(topic.id, topic) ?? ctx.stores.topics.create(topic as Omit<Topic, "id"> & { id: string });
    }

    // Save content plan (audit data only, no topics)
    contentPlan = {
      projectId: project.id,
      createdAt: strategyOutput.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runId: ctx.run.id,
      audit: strategyOutput.audit ?? {
        totalArticles: auditResult.totalArticles,
        byCategory: auditResult.byCategory,
        byLanguage: auditResult.byLanguage,
        gaps: auditResult.categoryGaps,
      },
    };
    ctx.stores.projects.saveContentPlan(project.id, contentPlan);

    ctx.completePhase("strategy");
    log.info({ topicCount: topics.length }, "strategy complete — topics + content plan saved");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("strategy", msg);
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw error;
  }

  // ── Done ───────────────────────────────────────────────────────
  ctx.updateRun({ status: "completed", completedAt: new Date().toISOString() });
  log.info({ runId: ctx.run.id, cost: ctx.run.totalCostUsd }, "strategy pipeline completed");

  return contentPlan;
}
