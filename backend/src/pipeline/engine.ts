import fs from "node:fs";
import path from "node:path";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { createLogger } from "../utils/logger.js";
import type { PipelineContext } from "./context.js";
import type { AgentCall, AgentEvent } from "../models/types.js";

const log = createLogger("engine");

const MAX_EVENTS = 30; // Keep last N events per agent call

export interface AgentConfig {
  name: string;
  model?: string;
  tools?: string[];
  maxTurns?: number;
  useMcpTools?: boolean;
}

export interface AgentRunResult {
  text: string;
  costUsd: number;
  tokens: { input: number; output: number };
  durationMs: number;
  sessionId: string;
  events: AgentEvent[];
}

/**
 * Resolve the absolute path to the MCP stdio server script.
 */
function getMcpServerPath(): string {
  // In compiled dist/, the file is .js; in dev with tsx, it's .ts
  const jsPath = path.resolve(import.meta.dirname, "../tools/mcp-stdio-server.js");
  const tsPath = path.resolve(import.meta.dirname, "../tools/mcp-stdio-server.ts");
  return fs.existsSync(jsPath) ? jsPath : tsPath;
}

/**
 * Summarize tool input for display (truncated, human-readable).
 */
function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  if (name === "Read" && input.file_path) return String(input.file_path).split("/").slice(-2).join("/");
  if (name === "Write" && input.file_path) return String(input.file_path).split("/").slice(-2).join("/");
  if (name === "Edit" && input.file_path) return String(input.file_path).split("/").slice(-2).join("/");
  if (name === "Glob" && input.pattern) return String(input.pattern);
  if (name === "Grep" && input.pattern) return String(input.pattern).slice(0, 60);
  if (name === "Bash" && input.description) return String(input.description).slice(0, 60);
  if (name === "Bash" && input.command) return String(input.command).slice(0, 60);
  if (name === "WebSearch" && input.query) return String(input.query).slice(0, 60);
  if (name === "WebFetch" && input.url) return String(input.url).slice(0, 60);
  if (name.startsWith("mcp__flowboost__")) {
    const shortName = name.replace("mcp__flowboost__flowboost_", "");
    if (input.path) return `${shortName}: ${String(input.path).split("/").slice(-2).join("/")}`;
    if (input.resource) return `${shortName}: ${input.resource}`;
    if (input.prompt) return `${shortName}: ${String(input.prompt).slice(0, 50)}`;
    return shortName;
  }
  return JSON.stringify(input).slice(0, 80);
}

/**
 * Extract tool call events from an SDK assistant message.
 */
function extractToolEvents(
  message: SDKMessage,
  events: AgentEvent[],
  onEvent?: (event: AgentEvent) => void,
): void {
  if (message.type !== "assistant") return;
  const content = message.message?.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block.type === "tool_use") {
      const event: AgentEvent = {
        type: "tool_call",
        timestamp: new Date().toISOString(),
        tool: String(block.name ?? "unknown"),
        input: summarizeToolInput(
          String(block.name ?? ""),
          (block.input as Record<string, unknown>) ?? {},
        ),
      };
      events.push(event);
      onEvent?.(event);
    }
  }
}

/**
 * Run a single agent via Claude Agent SDK.
 * Uses the `query()` function with native TypeScript async generator.
 * MCP tools are provided via stdio server config.
 */
export async function runAgent(
  ctx: PipelineContext,
  prompt: string,
  config: AgentConfig,
  onEvent?: (event: AgentEvent) => void,
): Promise<AgentRunResult> {
  const startTime = Date.now();
  const model = config.model ?? "sonnet";
  log.info({ agent: config.name, model }, "starting agent");

  // Build MCP server config (same stdio server, passed directly — no temp files)
  const mcpServers = config.useMcpTools !== false ? {
    flowboost: {
      command: "node",
      args: [getMcpServerPath()],
      env: {
        FLOWBOOST_DATA_DIR: ctx.dataDir,
        FLOWBOOST_CUSTOMER_DIR: ctx.customerDir,
        FLOWBOOST_PROJECT_DIR: ctx.projectDir,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
      },
    },
  } : undefined;

  const events: AgentEvent[] = [];
  let resultText = "";
  let assistantText = "";
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let sessionId = "";

  log.debug({ agent: config.name, model, maxTurns: config.maxTurns }, "running SDK query");

  try {
    for await (const message of query({
      prompt,
      options: {
        model,
        maxTurns: config.maxTurns,
        allowedTools: config.tools,
        mcpServers,
        permissionMode: "acceptEdits",
      },
    })) {
      // Extract tool calls from assistant messages
      extractToolEvents(message, events, onEvent);

      // Collect text from assistant messages as fallback
      if (message.type === "assistant") {
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && typeof block.text === "string") {
              assistantText += block.text;
            }
          }
        }
      }

      // Capture final result with cost/tokens
      if (message.type === "result") {
        if (message.subtype === "success") {
          resultText = message.result ?? "";
        }
        costUsd = message.total_cost_usd ?? 0;
        inputTokens = message.usage?.input_tokens ?? 0;
        outputTokens = message.usage?.output_tokens ?? 0;
        sessionId = message.session_id ?? "";
      }
    }

    const finalText = resultText || assistantText;
    const durationMs = Date.now() - startTime;

    log.info({ agent: config.name, durationMs, costUsd }, "agent completed");

    return {
      text: finalText,
      costUsd,
      tokens: { input: inputTokens, output: outputTokens },
      durationMs,
      sessionId,
      events: events.slice(-MAX_EVENTS),
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error({ agent: config.name, err: error, durationMs }, "agent failed");
    throw error;
  }
}

/**
 * Run a lightweight agent via Claude Agent SDK without MCP tools or pipeline tracking.
 * Suitable for chat, enrichment, and other simple prompt→response tasks.
 */
export async function runSimpleAgent(
  prompt: string,
  options?: { model?: string; maxTurns?: number; systemPrompt?: string; allowedTools?: string[] },
): Promise<AgentRunResult> {
  const startTime = Date.now();
  const model = options?.model ?? "haiku";

  log.info({ model }, "starting simple agent");

  try {
    let resultText = "";
    let assistantText = "";
    let costUsd = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let sessionId = "";

    for await (const message of query({
      prompt,
      options: {
        model,
        maxTurns: options?.maxTurns ?? 1,
        systemPrompt: options?.systemPrompt,
        allowedTools: options?.allowedTools,
        permissionMode: "acceptEdits",
      },
    })) {
      // Collect text from assistant messages as fallback
      if (message.type === "assistant") {
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && typeof block.text === "string") {
              assistantText += block.text;
            }
          }
        }
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          resultText = message.result ?? "";
        }
        costUsd = message.total_cost_usd ?? 0;
        inputTokens = message.usage?.input_tokens ?? 0;
        outputTokens = message.usage?.output_tokens ?? 0;
        sessionId = message.session_id ?? "";
      }
    }

    const finalText = resultText || assistantText;
    const durationMs = Date.now() - startTime;
    log.info({ model, durationMs }, "simple agent completed");

    return {
      text: finalText,
      costUsd,
      tokens: { input: inputTokens, output: outputTokens },
      durationMs,
      sessionId,
      events: [],
    };
  } catch (error) {
    log.error({ err: error }, "simple agent failed");
    throw error;
  }
}

/**
 * Run an agent and record it as an AgentCall on the pipeline run.
 * Streams events to the run data for live monitoring.
 */
export async function runAgentTracked(
  ctx: PipelineContext,
  phaseName: string,
  prompt: string,
  config: AgentConfig,
): Promise<AgentRunResult> {
  const agentCall: AgentCall = {
    agent: config.name,
    model: config.model ?? "sonnet",
    status: "running",
    costUsd: 0,
    tokens: { input: 0, output: 0 },
    durationMs: 0,
    events: [],
  };

  ctx.stores.pipelineRuns.addAgentCall(ctx.run.id, phaseName, agentCall);

  // Persist events in real-time as they arrive
  const onEvent = (event: AgentEvent) => {
    agentCall.events = agentCall.events ?? [];
    agentCall.events.push(event);
    // Keep only last N events
    if (agentCall.events.length > MAX_EVENTS) {
      agentCall.events = agentCall.events.slice(-MAX_EVENTS);
    }
    // Persist to disk for live polling
    const run = ctx.stores.pipelineRuns.get(ctx.run.id);
    if (run) {
      const phase = run.phases.find((p) => p.name === phaseName);
      if (phase && phase.agentCalls.length > 0) {
        phase.agentCalls[phase.agentCalls.length - 1] = agentCall;
        ctx.stores.pipelineRuns.updatePhase(ctx.run.id, phaseName, phase);
      }
    }
  };

  try {
    const result = await runAgent(ctx, prompt, config, onEvent);

    agentCall.status = "completed";
    agentCall.costUsd = result.costUsd;
    agentCall.tokens = result.tokens;
    agentCall.durationMs = result.durationMs;
    agentCall.result = result.text.slice(0, 500);
    agentCall.events = result.events;

    const run = ctx.stores.pipelineRuns.get(ctx.run.id);
    if (run) {
      const phase = run.phases.find((p) => p.name === phaseName);
      if (phase && phase.agentCalls.length > 0) {
        phase.agentCalls[phase.agentCalls.length - 1] = agentCall;
        ctx.stores.pipelineRuns.updatePhase(ctx.run.id, phaseName, phase);
      }
    }

    return result;
  } catch (error) {
    agentCall.status = "failed";
    agentCall.durationMs = 0;
    agentCall.error = error instanceof Error ? error.message : String(error);

    const run = ctx.stores.pipelineRuns.get(ctx.run.id);
    if (run) {
      const phase = run.phases.find((p) => p.name === phaseName);
      if (phase && phase.agentCalls.length > 0) {
        phase.agentCalls[phase.agentCalls.length - 1] = agentCall;
        ctx.stores.pipelineRuns.updatePhase(ctx.run.id, phaseName, phase);
      }
    }

    throw error;
  }
}
