import fs from "node:fs";
import { createLogger } from "../../utils/logger.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import type { PipelineContext } from "../context.js";
import type { Outline, OutlineSection } from "./outline.js";
import { buildSectionWriterPrompt } from "../prompts/section-writer.js";

const log = createLogger("production:writing");

/**
 * Run the Writing phase.
 * Spawns N section writers in parallel — one per section in the outline.
 */
export async function runWritingPhase(ctx: PipelineContext, outline: Outline): Promise<void> {
  const { project } = ctx;
  const model = project.pipeline.defaultModel;
  const scratchpadDir = ctx.scratchpadDir;

  log.info({ sectionCount: outline.sections.length }, "starting writing phase");
  ctx.startPhase("writing");

  const outlineContext = {
    title: outline.topic.title,
    primaryKeyword: outline.topic.primaryKeyword,
    secondaryKeywords: outline.topic.secondaryKeywords,
    suggestedAngle: outline.topic.suggestedAngle ?? "",
  };

  try {
    // Run all section writers in parallel
    const promises = outline.sections.map((section) =>
      writeSingleSection(ctx, section, outlineContext, scratchpadDir, model),
    );

    const results = await Promise.allSettled(promises);

    // Check for failures
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      const errors = failures
        .map((f) => (f as PromiseRejectedResult).reason?.message ?? "Unknown error")
        .join("; ");
      throw new Error(`${failures.length}/${outline.sections.length} sections failed: ${errors}`);
    }

    // Verify all output files exist
    for (const section of outline.sections) {
      const filePath = `${scratchpadDir}/${section.outputFile}`;
      if (!fs.existsSync(filePath)) {
        throw new Error(`Section file missing after writing: ${section.outputFile}`);
      }
    }

    ctx.completePhase("writing");
    log.info({ sectionCount: outline.sections.length }, "all sections written");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("writing", msg);
    throw error;
  }
}

async function writeSingleSection(
  ctx: PipelineContext,
  section: OutlineSection,
  outlineContext: { title: string; primaryKeyword: string; secondaryKeywords: string[]; suggestedAngle: string },
  scratchpadDir: string,
  model: string,
): Promise<void> {
  log.info({ sectionId: section.id, type: section.type }, "writing section");

  const config: AgentConfig = {
    name: `section-writer:${section.id}`,
    model,
    maxTurns: 8,
    useMcpTools: true,
    tools: [
      "Read",
      "Write",
      "mcp__flowboost__flowboost_read_project_data",
      "mcp__flowboost__flowboost_validate_section",
    ],
  };

  const prompt = buildSectionWriterPrompt(ctx.project, section, outlineContext, scratchpadDir);
  await runAgentTracked(ctx, "writing", prompt, config);

  log.info({ sectionId: section.id, file: section.outputFile }, "section complete");
}
