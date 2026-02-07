import { createLogger } from "../../utils/logger.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import type { PipelineContext } from "../context.js";
import { buildSeoCheckerPrompt } from "../prompts/seo-checker.js";
import { buildReviewerPrompt } from "../prompts/reviewer.js";
import { extractJson } from "../extract-json.js";

const log = createLogger("production:quality");

export interface QualityResult {
  seo: { score: number; pass: boolean; issues: Array<{ severity: string; message: string }> };
  review: { score: number; pass: boolean; issues: Array<{ severity: string; message: string }> };
  overallPass: boolean;
}

/**
 * Run the Quality phase.
 * SEO Checker and Content Reviewer run in parallel.
 */
export async function runQualityPhase(
  ctx: PipelineContext,
  articlePath: string,
): Promise<QualityResult> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Production pipeline requires a topic");

  log.info("starting quality phase");
  ctx.startPhase("quality");

  try {
    // Run SEO check and brand review in parallel
    const [seoResult, reviewResult] = await Promise.all([
      runSeoCheck(ctx, articlePath),
      runBrandReview(ctx, articlePath),
    ]);

    const seo = extractJson<{ score: number; pass: boolean; issues: Array<{ severity: string; message: string }> }>(seoResult);
    const review = extractJson<{ score: number; pass: boolean; issues: Array<{ severity: string; message: string }> }>(reviewResult);

    const result: QualityResult = {
      seo,
      review,
      overallPass: seo.pass && review.pass,
    };

    if (result.overallPass) {
      ctx.completePhase("quality");
      log.info({ seoScore: seo.score, reviewScore: review.score }, "quality checks passed");
    } else {
      ctx.failPhase("quality", `Quality failed — SEO: ${seo.score}/100 (${seo.pass ? "pass" : "fail"}), Review: ${review.score}/100 (${review.pass ? "pass" : "fail"})`);
      log.warn({ seoScore: seo.score, reviewScore: review.score }, "quality checks failed");
    }

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("quality", msg);
    throw error;
  }
}

async function runSeoCheck(ctx: PipelineContext, articlePath: string): Promise<string> {
  const config: AgentConfig = {
    name: "seo-checker",
    model: "haiku",
    maxTurns: 5,
    useMcpTools: true,
    tools: [
      "Read",
      "mcp__flowboost__flowboost_read_project_data",
      "mcp__flowboost__flowboost_validate_article",
    ],
  };

  const prompt = buildSeoCheckerPrompt(ctx.project, ctx.topic!, articlePath);
  const result = await runAgentTracked(ctx, "quality", prompt, config);
  return result.text;
}

async function runBrandReview(ctx: PipelineContext, articlePath: string): Promise<string> {
  const config: AgentConfig = {
    name: "content-reviewer",
    model: ctx.project.pipeline.defaultModel,
    maxTurns: 5,
    useMcpTools: true,
    tools: [
      "Read",
      "mcp__flowboost__flowboost_read_project_data",
    ],
  };

  const prompt = buildReviewerPrompt(ctx.project, articlePath);
  const result = await runAgentTracked(ctx, "quality", prompt, config);
  return result.text;
}
