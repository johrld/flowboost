import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import { runAgentTracked, type AgentConfig } from "../engine.js";
import type { PipelineContext } from "../context.js";
import { buildOutlineArchitectPrompt } from "../prompts/outline-architect.js";
import { extractJson } from "../extract-json.js";

const log = createLogger("production:outline");

export interface OutlineSection {
  id: string;
  type: "meta" | "introduction" | "h2_section" | "conclusion" | "faq";
  outputFile: string;
  [key: string]: unknown;
}

export interface Outline {
  topic: {
    title: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    longTailKeywords: string[];
    suggestedAngle: string;
  };
  sections: OutlineSection[];
  totalTargetWords: number;
  internalLinks: Array<{ anchor: string; href: string; placedInSection: string }>;
}

/**
 * Run the Outline Architect phase.
 * Takes a topic brief, produces a detailed section-level outline.
 */
export async function runOutlinePhase(ctx: PipelineContext): Promise<Outline> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Production pipeline requires a topic");

  const model = project.pipeline.defaultModel;
  const scratchpadDir = ctx.scratchpadDir;

  // Ensure scratchpad exists
  fs.mkdirSync(scratchpadDir, { recursive: true });

  log.info({ topic: topic.title }, "starting outline phase");
  ctx.startPhase("outline");

  try {
    const config: AgentConfig = {
      name: "outline-architect",
      model,
      maxTurns: 10,
      useMcpTools: true,
      tools: ["Read", "Write", "mcp__flowboost__flowboost_read_project_data"],
    };

    const prompt = buildOutlineArchitectPrompt(project, topic, scratchpadDir);
    const result = await runAgentTracked(ctx, "outline", prompt, config);

    // Try reading from file first (agent may have written it), fallback to parsing output
    const outlinePath = path.join(scratchpadDir, "outline.json");
    let outline: Outline;

    if (fs.existsSync(outlinePath)) {
      outline = JSON.parse(fs.readFileSync(outlinePath, "utf-8")) as Outline;
    } else {
      outline = extractJson<Outline>(result.text);
      // Save it for other phases
      fs.writeFileSync(outlinePath, JSON.stringify(outline, null, 2));
    }

    ctx.completePhase("outline");
    log.info({ sections: outline.sections.length, targetWords: outline.totalTargetWords }, "outline complete");

    return outline;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.failPhase("outline", msg);
    throw error;
  }
}
