import { createLogger } from "../../utils/logger.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import type { PipelineContext } from "../context.js";
import { buildImageGeneratorPrompt } from "../prompts/image-generator.js";

const log = createLogger("production:image");

/**
 * Run the Image Generation phase.
 * Analyzes the article and generates a hero image via Imagen API.
 * Returns the path to the generated image.
 */
export async function runImagePhase(
  ctx: PipelineContext,
  articlePath: string,
  outputPath: string,
): Promise<string> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Production pipeline requires a topic");

  const model = project.pipeline.defaultModel;

  log.info({ topic: topic.title }, "starting image phase");
  ctx.startPhase("image");

  try {
    const config: AgentConfig = {
      name: "image-generator",
      model,
      maxTurns: 5,
      useMcpTools: true,
      tools: [
        "Read",
        "mcp__flowboost__flowboost_generate_image",
      ],
    };

    const prompt = buildImageGeneratorPrompt(project, topic, articlePath, outputPath);
    await runAgentTracked(ctx, "image", prompt, config);

    ctx.completePhase("image");
    log.info({ outputPath }, "image generation complete");

    return outputPath;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("image", msg);
    throw error;
  }
}
