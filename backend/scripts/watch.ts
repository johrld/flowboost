#!/usr/bin/env npx tsx
/**
 * Live terminal watcher for FlowBoost pipeline runs.
 *
 * Usage:
 *   npx tsx scripts/watch.ts <run-id>
 *   npx tsx scripts/watch.ts <run-id> --port 6000
 *
 * Polls GET /pipeline/runs/:id every second and renders
 * a colored terminal view with phase status, agent activity,
 * and live tool call events.
 */

const POLL_INTERVAL = 1000;
const BASE_URL = process.env.FLOWBOOST_URL ?? "http://localhost:6000";

// ── ANSI Colors ──────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgRed: "\x1b[41m",
  bgBlue: "\x1b[44m",
};

// ── Types (mirror from API) ──────────────────────────────────────

interface AgentEvent {
  type: "tool_call" | "text" | "error";
  timestamp: string;
  tool?: string;
  input?: string;
  text?: string;
}

interface AgentCall {
  agent: string;
  model: string;
  status: "running" | "completed" | "failed";
  costUsd: number;
  tokens: { input: number; output: number };
  durationMs: number;
  result?: string;
  error?: string;
  events?: AgentEvent[];
}

interface PipelinePhase {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  agentCalls: AgentCall[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface PipelineRun {
  id: string;
  projectId: string;
  type: "strategy" | "production";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  topicId?: string;
  phases: PipelinePhase[];
  totalCostUsd: number;
  totalTokens: { input: number; output: number };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ── Spinner ──────────────────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerIdx = 0;
function spinner(): string {
  const frame = SPINNER_FRAMES[spinnerIdx % SPINNER_FRAMES.length];
  spinnerIdx++;
  return `${c.cyan}${frame}${c.reset}`;
}

// ── Status Icons ─────────────────────────────────────────────────

function statusIcon(status: string): string {
  switch (status) {
    case "completed": return `${c.green}✔${c.reset}`;
    case "running":   return spinner();
    case "failed":    return `${c.red}✘${c.reset}`;
    case "skipped":   return `${c.gray}⊘${c.reset}`;
    case "pending":   return `${c.dim}○${c.reset}`;
    default:          return `${c.dim}?${c.reset}`;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "completed": return c.green;
    case "running":   return c.yellow;
    case "failed":    return c.red;
    case "pending":   return c.dim;
    default:          return c.reset;
  }
}

// ── Formatting ───────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  return `$${usd.toFixed(2)}`;
}

function formatTokens(tokens: { input: number; output: number }): string {
  const total = tokens.input + tokens.output;
  if (total === 0) return "";
  return `${c.dim}(${(total / 1000).toFixed(1)}k tok)${c.reset}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ── Render ────────────────────────────────────────────────────────

function render(run: PipelineRun): string {
  const lines: string[] = [];

  // Header
  const pipelineLabel = run.type === "strategy" ? "Strategy" : "Production";
  const headerStatus = run.status === "running"
    ? `${c.bgYellow}${c.bold} RUNNING ${c.reset}`
    : run.status === "completed"
      ? `${c.bgGreen}${c.bold} DONE ${c.reset}`
      : run.status === "failed"
        ? `${c.bgRed}${c.bold} FAILED ${c.reset}`
        : `${c.dim}${run.status.toUpperCase()}${c.reset}`;

  lines.push("");
  lines.push(`  ${c.bold}FlowBoost${c.reset} ${c.dim}│${c.reset} ${pipelineLabel} Pipeline ${headerStatus}  ${c.dim}${run.id.slice(0, 8)}${c.reset}`);
  lines.push(`  ${c.dim}${"─".repeat(60)}${c.reset}`);

  // Phases
  for (const phase of run.phases) {
    const icon = statusIcon(phase.status);
    const color = statusColor(phase.status);
    const phaseName = phase.name.charAt(0).toUpperCase() + phase.name.slice(1);

    let duration = "";
    if (phase.startedAt) {
      const start = new Date(phase.startedAt).getTime();
      const end = phase.completedAt ? new Date(phase.completedAt).getTime() : Date.now();
      duration = ` ${c.dim}${formatDuration(end - start)}${c.reset}`;
    }

    lines.push(`  ${icon} ${color}${c.bold}${phaseName}${c.reset}${duration}`);

    // Agent calls within this phase
    for (const agent of phase.agentCalls) {
      const agentIcon = statusIcon(agent.status);
      const agentDur = agent.durationMs > 0 ? ` ${c.dim}${formatDuration(agent.durationMs)}${c.reset}` : "";
      const cost = agent.costUsd > 0 ? ` ${c.dim}${formatCost(agent.costUsd)}${c.reset}` : "";
      const tokens = formatTokens(agent.tokens);

      lines.push(`    ${agentIcon} ${c.cyan}${agent.agent}${c.reset} ${c.dim}(${agent.model})${c.reset}${agentDur}${cost} ${tokens}`);

      // Show recent events for running agents
      if (agent.status === "running" && agent.events?.length) {
        const recentEvents = agent.events.slice(-3);
        for (const event of recentEvents) {
          if (event.type === "tool_call" && event.tool) {
            const toolName = event.tool.replace("mcp__flowboost__flowboost_", "fb:");
            const input = event.input ? ` ${c.dim}${truncate(event.input, 50)}${c.reset}` : "";
            lines.push(`      ${c.magenta}→${c.reset} ${c.white}${toolName}${c.reset}${input}`);
          } else if (event.type === "error" && event.text) {
            lines.push(`      ${c.red}⚠ ${truncate(event.text, 60)}${c.reset}`);
          }
        }
      }

      // Show error for failed agents
      if (agent.status === "failed" && agent.error) {
        lines.push(`      ${c.red}Error: ${truncate(agent.error, 60)}${c.reset}`);
      }

      // Show result preview for completed agents
      if (agent.status === "completed" && agent.result) {
        lines.push(`      ${c.dim}${truncate(agent.result, 60)}${c.reset}`);
      }
    }

    // Phase error
    if (phase.error) {
      lines.push(`    ${c.red}Error: ${truncate(phase.error, 60)}${c.reset}`);
    }
  }

  // Footer with totals
  lines.push(`  ${c.dim}${"─".repeat(60)}${c.reset}`);

  let elapsed = "";
  if (run.startedAt) {
    const start = new Date(run.startedAt).getTime();
    const end = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
    elapsed = formatDuration(end - start);
  }

  const totalTokens = run.totalTokens.input + run.totalTokens.output;
  lines.push(`  ${c.dim}Elapsed: ${elapsed || "—"}  │  Cost: ${formatCost(run.totalCostUsd)}  │  Tokens: ${totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k` : "—"}${c.reset}`);
  lines.push("");

  return lines.join("\n");
}

// ── Main Loop ─────────────────────────────────────────────────────

async function main() {
  const runId = process.argv[2];
  if (!runId) {
    console.error("Usage: npx tsx scripts/watch.ts <run-id>");
    process.exit(1);
  }

  const portFlag = process.argv.indexOf("--port");
  const port = portFlag !== -1 ? process.argv[portFlag + 1] : undefined;
  const baseUrl = port ? `http://localhost:${port}` : BASE_URL;
  const url = `${baseUrl}/pipeline/runs/${runId}`;

  console.log(`${c.dim}Watching ${url}${c.reset}\n`);

  let lastStatus = "";

  while (true) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          console.error(`${c.red}Run not found: ${runId}${c.reset}`);
          process.exit(1);
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const run = (await res.json()) as PipelineRun;

      // Clear screen and render
      process.stdout.write("\x1b[2J\x1b[H");
      process.stdout.write(render(run));

      // Exit when terminal state reached
      if (["completed", "failed", "cancelled"].includes(run.status)) {
        if (run.status !== lastStatus) {
          const icon = run.status === "completed" ? `${c.green}✔` : `${c.red}✘`;
          console.log(`  ${icon} Pipeline ${run.status}${c.reset}\n`);
        }
        process.exit(run.status === "completed" ? 0 : 1);
      }

      lastStatus = run.status;
    } catch (error) {
      // Server might not be ready yet, just retry
      const msg = error instanceof Error ? error.message : String(error);
      process.stdout.write(`\r${c.dim}Waiting for server... ${msg}${c.reset}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

main();
