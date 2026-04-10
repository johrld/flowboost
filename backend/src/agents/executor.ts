import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../utils/logger.js";
import { getAgent } from "./registry.js";
import { runAgent, runSimpleAgent, type AgentRunResult } from "../pipeline/engine.js";
import type { PipelineContext } from "../pipeline/context.js";
import type { Job } from "../models/types.js";
import { MemoryStore } from "../models/memory.js";

const log = createLogger("agent-executor");

/** Directory where skill markdown files live */
const SKILLS_DIR = path.resolve(import.meta.dirname, "skills");

/**
 * Load skill files for an agent and combine into a single system prompt section.
 */
export function loadSkills(skillNames: string[]): string {
  const sections: string[] = [];

  for (const name of skillNames) {
    const filePath = path.join(SKILLS_DIR, `${name}.md`);
    if (!fs.existsSync(filePath)) {
      log.warn({ skill: name }, "skill file not found, skipping");
      continue;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    sections.push(content);
  }

  return sections.join("\n\n---\n\n");
}

/**
 * Build the full prompt for an agent, combining:
 * 1. Skill instructions
 * 2. Job context (what to do)
 * 3. Memory context (what the agent knows)
 * 4. Any additional context
 */
export function buildAgentPrompt(opts: {
  agentName: string;
  job: Job;
  skillContent: string;
  memoryContext?: string;
  additionalContext?: string;
}): string {
  const parts: string[] = [];

  // Skills as system context
  if (opts.skillContent) {
    parts.push(opts.skillContent);
  }

  // Memory context
  if (opts.memoryContext) {
    parts.push(`## Project Memory\n\n${opts.memoryContext}`);
  }

  // Additional context (e.g., article content, research results)
  if (opts.additionalContext) {
    parts.push(opts.additionalContext);
  }

  // The actual task
  parts.push(`## Your Task\n\n**Job:** ${opts.job.title}\n\n${opts.job.description ?? ""}`);

  if (Object.keys(opts.job.input).length > 0) {
    parts.push(`## Input\n\n\`\`\`json\n${JSON.stringify(opts.job.input, null, 2)}\n\`\`\``);
  }

  // Previous comments (agent-to-agent communication)
  if (opts.job.comments?.length > 0) {
    const commentStr = opts.job.comments
      .map((c) => `**${c.agentName}** (${c.createdAt}):\n${c.content}`)
      .join("\n\n");
    parts.push(`## Discussion\n\n${commentStr}`);
  }

  parts.push(
    "## Output Format\n\n" +
    "Respond with your result. If you need to return structured data, wrap it in a JSON code block:\n" +
    "```json\n{ ... }\n```",
  );

  return parts.join("\n\n---\n\n");
}

/**
 * Execute a job using the appropriate agent.
 *
 * This is the main entry point for running any agent in the v2 system.
 * It loads skills, builds the prompt, runs the agent, and returns the result.
 */
export async function executeJob(
  ctx: PipelineContext,
  job: Job,
  opts?: {
    memoryContext?: string;
    additionalContext?: string;
  },
): Promise<AgentRunResult> {
  const agentDef = getAgent(job.assigneeAgent);
  if (!agentDef) {
    throw new Error(`Unknown agent: ${job.assigneeAgent}`);
  }

  log.info({ agent: agentDef.name, job: job.id, type: job.type }, "executing job");

  // Load skills
  const skillContent = loadSkills(agentDef.skills);

  // Build prompt
  const prompt = buildAgentPrompt({
    agentName: agentDef.name,
    job,
    skillContent,
    memoryContext: opts?.memoryContext,
    additionalContext: opts?.additionalContext,
  });

  // Run agent
  const result = await runAgent(ctx, prompt, {
    name: agentDef.name,
    model: agentDef.model,
    maxTurns: agentDef.maxTurns,
    tools: agentDef.tools,
    useMcpTools: agentDef.useMcpTools,
  });

  log.info(
    { agent: agentDef.name, job: job.id, costUsd: result.costUsd, durationMs: result.durationMs },
    "job execution completed",
  );

  return result;
}

/**
 * Execute a simple agent call (no pipeline context needed).
 * Used for CMO chat and lightweight tasks.
 */
export async function executeSimple(
  agentName: string,
  prompt: string,
  opts?: { systemPrompt?: string },
): Promise<AgentRunResult> {
  const agentDef = getAgent(agentName);
  if (!agentDef) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  // Load skills and prepend to system prompt
  const skillContent = loadSkills(agentDef.skills);
  const systemPrompt = [skillContent, opts?.systemPrompt].filter(Boolean).join("\n\n---\n\n");

  return runSimpleAgent(prompt, {
    model: agentDef.model,
    maxTurns: agentDef.maxTurns,
    systemPrompt: systemPrompt || undefined,
    allowedTools: agentDef.tools.length > 0 ? agentDef.tools : undefined,
  });
}

/**
 * Load project memory as formatted context string for prompt injection.
 */
export function loadMemoryContext(projectDir: string): string {
  const memory = new MemoryStore(projectDir);
  const all = memory.getAll();
  if (Object.keys(all).length === 0) return "";

  const sections: string[] = [];
  for (const [key, value] of Object.entries(all)) {
    const label = key.replace(/\./g, " / ").replace(/-/g, " ");
    sections.push(`### ${label}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``);
  }
  return sections.join("\n\n");
}
