import { createLogger } from "../../utils/logger.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import type { PipelineContext } from "../context.js";
import type { Outline } from "./outline.js";
import { buildContentEditorPrompt } from "../prompts/content-editor.js";

const log = createLogger("production:assembly");

/**
 * Run the Assembly phase.
 * Content Editor assembles sections, adds transitions, validates the result.
 * Returns the path to the assembled article.
 */
export async function runAssemblyPhase(
  ctx: PipelineContext,
  outline: Outline,
  outputPath: string,
): Promise<string> {
  const { project } = ctx;
  const model = project.pipeline.defaultModel;
  const scratchpadDir = ctx.scratchpadDir;

  log.info("starting assembly phase");
  ctx.startPhase("assembly");

  try {
    const config: AgentConfig = {
      name: "content-editor",
      model,
      maxTurns: 12,
      useMcpTools: true,
      tools: [
        "Read",
        "Write",
        "mcp__flowboost__flowboost_read_project_data",
        "mcp__flowboost__flowboost_assemble_article",
        "mcp__flowboost__flowboost_validate_article",
      ],
    };

    const prompt = buildContentEditorPrompt(project, scratchpadDir, outputPath, {
      title: outline.topic.title,
      primaryKeyword: outline.topic.primaryKeyword,
      totalTargetWords: outline.totalTargetWords,
      sectionCount: outline.sections.length,
    });

    await runAgentTracked(ctx, "assembly", prompt, config);

    ctx.completePhase("assembly");
    log.info({ outputPath }, "assembly complete");

    return outputPath;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("assembly", msg);
    throw error;
  }
}
