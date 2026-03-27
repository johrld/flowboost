import { createLogger } from "../../utils/logger.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import type { PipelineContext } from "../context.js";
import { buildEnricherPrompt } from "../prompts/enricher.js";
import { extractJson } from "../extract-json.js";

/** Shape returned by the enricher agent (flat, pre-structured) */
interface EnricherOutput {
  title?: string;
  category?: string;
  keywords?: { primary: string; secondary: string[]; longTail: string[] };
  searchIntent?: "informational" | "how-to" | "transactional" | "navigational";
  competitorInsights?: string;
  suggestedAngle?: string;
  estimatedSections?: number;
  reasoning?: string;
}

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

    const briefingContext = ctx.buildFullFlowContext();
    const prompt = buildEnricherPrompt(project, topic, existingTopics, briefingContext);
    const result = await runAgentTracked(ctx, "enrich", prompt, config);
    const enriched = extractJson<EnricherOutput>(result.text);

    // Build the seo block only if we have keyword data
    const seo = (enriched.keywords && enriched.searchIntent && enriched.competitorInsights)
      ? {
          keywords: enriched.keywords!,
          searchIntent: enriched.searchIntent!,
          competitorInsights: enriched.competitorInsights!,
          suggestedSections: enriched.estimatedSections,
        }
      : undefined;

    // Write enrichment data to the new structured format
    ctx.stores.topics.update(topicId, {
      ...(enriched.title ? { title: enriched.title } : {}),
      ...(enriched.category ? { category: enriched.category } : {}),
      enrichment: {
        ...(seo ? { seo } : {}),
        reasoning: enriched.reasoning,
        enrichedAt: new Date().toISOString(),
        enrichedBy: "agent",
      },
      direction: enriched.suggestedAngle ?? topic.direction,
      source: topic.source,
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
