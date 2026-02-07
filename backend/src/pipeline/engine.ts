import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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
  return path.resolve(import.meta.dirname, "../tools/mcp-stdio-server.ts");
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
 * Run a single agent via Claude Code CLI.
 * Uses `claude -p` (print mode) with --output-format stream-json for live events.
 * MCP tools are provided via a dynamic config file.
 */
export async function runAgent(
  ctx: PipelineContext,
  prompt: string,
  config: AgentConfig,
  onEvent?: (event: AgentEvent) => void,
): Promise<AgentRunResult> {
  const startTime = Date.now();
  log.info({ agent: config.name, model: config.model ?? "sonnet" }, "starting agent");

  // Create MCP config file if custom tools are needed
  let mcpConfigPath: string | undefined;
  if (config.useMcpTools !== false) {
    fs.mkdirSync(ctx.scratchpadDir, { recursive: true });
    mcpConfigPath = path.join(ctx.scratchpadDir, `mcp-${config.name}-${Date.now()}.json`);
    fs.writeFileSync(mcpConfigPath, JSON.stringify({
      mcpServers: {
        flowboost: {
          command: "npx",
          args: ["tsx", getMcpServerPath()],
          env: {
            FLOWBOOST_DATA_DIR: ctx.dataDir,
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
          },
        },
      },
    }));
  }

  // Build CLI arguments
  const args = [
    "-p",                                    // print mode
    "--verbose",                             // required for stream-json
    "--output-format", "stream-json",       // streaming JSON events
    "--model", config.model ?? "sonnet",
  ];

  if (config.maxTurns) {
    args.push("--max-turns", String(config.maxTurns));
  }

  if (config.tools?.length) {
    args.push("--allowedTools", config.tools.join(","));
  }

  if (mcpConfigPath) {
    args.push("--mcp-config", mcpConfigPath);
  }

  log.debug({ agent: config.name, args: args.join(" ") }, "spawning claude CLI");

  try {
    const result = await spawnClaude(args, prompt, onEvent);
    const durationMs = Date.now() - startTime;

    log.info({ agent: config.name, durationMs }, "agent completed");
    return { ...result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error({ agent: config.name, err: error, durationMs }, "agent failed");
    throw error;
  } finally {
    if (mcpConfigPath && fs.existsSync(mcpConfigPath)) {
      fs.unlinkSync(mcpConfigPath);
    }
  }
}

/**
 * Spawn claude CLI process, parse stream-json events, collect result.
 */
function spawnClaude(
  args: string[],
  prompt: string,
  onEvent?: (event: AgentEvent) => void,
): Promise<AgentRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    const events: AgentEvent[] = [];
    let resultText = "";
    let costUsd = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let sessionId = "";
    let stderr = "";

    // Parse stream-json: each line is a JSON event
    let buffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          processStreamEvent(msg, events, onEvent);

          // Capture result
          if (msg.type === "result") {
            resultText = msg.result ?? resultText;
            costUsd = msg.cost_usd ?? 0;
            inputTokens = msg.input_tokens ?? 0;
            outputTokens = msg.output_tokens ?? 0;
            sessionId = msg.session_id ?? "";
          }
        } catch { /* ignore parse errors for incomplete lines */ }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    child.stdin.write(prompt);
    child.stdin.end();

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
    });

    child.on("close", (code) => {
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer);
          processStreamEvent(msg, events, onEvent);
          if (msg.type === "result") {
            resultText = msg.result ?? resultText;
            costUsd = msg.cost_usd ?? 0;
            inputTokens = msg.input_tokens ?? 0;
            outputTokens = msg.output_tokens ?? 0;
            sessionId = msg.session_id ?? "";
          }
        } catch { /* ignore */ }
      }

      if (code !== 0 && !resultText) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 500)}`));
        return;
      }

      resolve({
        text: resultText,
        costUsd,
        tokens: { input: inputTokens, output: outputTokens },
        sessionId,
        durationMs: 0,
        events: events.slice(-MAX_EVENTS),
      });
    });
  });
}

/**
 * Process a single stream-json event, extract tool calls and text.
 */
function processStreamEvent(
  msg: Record<string, unknown>,
  events: AgentEvent[],
  onEvent?: (event: AgentEvent) => void,
): void {
  if (msg.type === "assistant") {
    const message = msg.message as { content?: Array<Record<string, unknown>> } | undefined;
    for (const block of message?.content ?? []) {
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
