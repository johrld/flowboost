import { createLogger } from "../../utils/logger.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import type { PipelineContext } from "../context.js";
import type { Topic } from "../../models/types.js";
import { buildEnricherPrompt } from "../prompts/enricher.js";
import { extractJson } from "../extract-json.js";

const log = createLogger("enrich");

/**
 * Lightweight enrichment pipeline: runs a single agent to enrich
 * a user-submitted topic with SEO data (keywords, competitors, angle).
 */
export async function runEnrichPipeline(
  ctx: PipelineContext,
  topicId: string,
): Promise<void> {
  const { project } = ctx;
  const model = project.pipeline.defaultModel;

  ctx.updateRun({ status: "running", startedAt: new Date().toISOString() });

  const topic = ctx.stores.topics.get(topicId);
  if (!topic) {
    ctx.updateRun({ status: "failed", error: "Topic not found", completedAt: new Date().toISOString() });
    throw new Error(`Topic ${topicId} not found`);
  }

  const existingTopics = ctx.stores.topics.list();

  log.info({ topicId, title: topic.title }, "starting enrichment");
  ctx.startPhase("enrich");

  try {
    const config: AgentConfig = {
      name: "topic-enricher",
      model,
      maxTurns: 15,
      useMcpTools: true,
      tools: ["WebSearch", "WebFetch", "Read", "mcp__flowboost__flowboost_read_project_data", "mcp__flowboost__flowboost_read_content_index"],
    };

    const briefingContext = ctx.buildFullBriefingContext({ includeResearch: false });
    const prompt = buildEnricherPrompt(project, topic, existingTopics, briefingContext);
    const result = await runAgentTracked(ctx, "enrich", prompt, config);
    const enriched = extractJson<Partial<Topic>>(result.text);

    // Merge enrichment data into existing topic, preserving source
    ctx.stores.topics.update(topicId, {
      ...enriched,
      enriched: true,
      source: topic.source, // Keep original source
    });

    ctx.completePhase("enrich");
    log.info({ topicId }, "enrichment complete");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("enrich", msg);
    ctx.updateRun({ status: "failed", error: msg, completedAt: new Date().toISOString() });
    throw error;
  }

  ctx.updateRun({ status: "completed", completedAt: new Date().toISOString() });
  log.info({ runId: ctx.run.id, cost: ctx.run.totalCostUsd }, "enrich pipeline completed");
}
