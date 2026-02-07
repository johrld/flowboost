#!/usr/bin/env npx tsx
/**
 * FlowBoost Pipeline CLI — start a pipeline and watch it live.
 *
 * Usage:
 *   npx tsx scripts/pipeline.ts strategy              # Run strategy pipeline
 *   npx tsx scripts/pipeline.ts produce [topicId]     # Run production (auto-picks first approved topic if omitted)
 *   npx tsx scripts/pipeline.ts topics                # List topics from content plan
 *   npx tsx scripts/pipeline.ts approve <topicId>     # Approve a topic
 *   npx tsx scripts/pipeline.ts approve --all         # Approve all proposed topics
 */

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
};

// ── Types ────────────────────────────────────────────────────────

interface Project { id: string; name: string }
interface Topic {
  id: string;
  status: string;
  title: string;
  category: string;
  priority: number;
  keywords: { primary: string };
}
interface ContentPlan { topics: Topic[] }

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

// ── API Helpers ──────────────────────────────────────────────────

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

async function getProject(): Promise<Project> {
  const projects = await api<Project[]>("GET", "/projects");
  if (projects.length === 0) throw new Error("No projects found");
  if (projects.length === 1) return projects[0];
  // If multiple, pick the first — could add --project flag later
  console.log(`${c.dim}Multiple projects found, using: ${projects[0].name}${c.reset}`);
  return projects[0];
}

// ── Spinner + Rendering ─────────────────────────────────────────

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let si = 0;
function spin(): string { return `${c.cyan}${SPINNER[si++ % SPINNER.length]}${c.reset}`; }

function icon(status: string): string {
  switch (status) {
    case "completed": return `${c.green}✔${c.reset}`;
    case "running":   return spin();
    case "failed":    return `${c.red}✘${c.reset}`;
    case "skipped":   return `${c.gray}⊘${c.reset}`;
    case "pending":   return `${c.dim}○${c.reset}`;
    default:          return `${c.dim}?${c.reset}`;
  }
}

function sColor(status: string): string {
  switch (status) {
    case "completed": return c.green;
    case "running":   return c.yellow;
    case "failed":    return c.red;
    default:          return c.dim;
  }
}

function dur(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ── Scrolling Log Watch ──────────────────────────────────────────

/**
 * Tracks what we've already printed so we only append new lines.
 */
interface WatchState {
  // Per-phase: which status we last printed
  phaseStatus: Record<string, string>;
  // Per-agent: which status we last printed
  agentStatus: Record<string, string>;
  // Per-agent: how many events we've already printed
  agentEventCount: Record<string, number>;
  // Whether we printed the final summary
  donePrinted: boolean;
}

function agentKey(phaseName: string, idx: number): string {
  return `${phaseName}:${idx}`;
}

function timeStamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${c.dim}${h}:${m}:${s}${c.reset}`;
}

function printLine(ts: string, prefix: string, text: string) {
  const cols = Math.min(process.stdout.columns || 80, 100);
  const maxText = Math.max(cols - 24, 30);
  console.log(`  ${ts}  ${prefix} ${trunc(text, maxText)}`);
}

function diffAndPrint(run: PipelineRun, state: WatchState): void {
  for (const phase of run.phases) {
    const prevPhaseStatus = state.phaseStatus[phase.name];

    // Phase started
    if (phase.status === "running" && prevPhaseStatus !== "running") {
      const w = Math.min(process.stdout.columns || 80, 100);
      const pName = phase.name.charAt(0).toUpperCase() + phase.name.slice(1);
      console.log("");
      console.log(`  ${c.dim}${"─".repeat(Math.max(w - 4, 40))}${c.reset}`);
      console.log(`  ${c.yellow}▶${c.reset} ${c.bold}${pName}${c.reset}`);
      console.log(`  ${c.dim}${"─".repeat(Math.max(w - 4, 40))}${c.reset}`);
    }

    // Phase completed/failed
    if (
      (phase.status === "completed" || phase.status === "failed") &&
      prevPhaseStatus !== phase.status
    ) {
      const pName = phase.name.charAt(0).toUpperCase() + phase.name.slice(1);
      let d = "";
      if (phase.startedAt) {
        const s = new Date(phase.startedAt).getTime();
        const e = phase.completedAt ? new Date(phase.completedAt).getTime() : Date.now();
        d = ` ${c.dim}(${dur(e - s)})${c.reset}`;
      }
      if (phase.status === "completed") {
        printLine(timeStamp(), `${c.green}✔${c.reset}`, `${c.bold}${pName}${c.reset} completed${d}`);
      } else {
        printLine(timeStamp(), `${c.red}✘${c.reset}`, `${c.bold}${pName}${c.reset} failed${d}`);
        if (phase.error) {
          printLine("        ", `${c.red} ${c.reset}`, `${c.red}${phase.error}${c.reset}`);
        }
      }
    }

    state.phaseStatus[phase.name] = phase.status;

    // Agent calls within phase
    for (let i = 0; i < phase.agentCalls.length; i++) {
      const agent = phase.agentCalls[i];
      const ak = agentKey(phase.name, i);
      const prevAgentStatus = state.agentStatus[ak];

      // Agent started
      if (agent.status === "running" && prevAgentStatus !== "running") {
        printLine(
          timeStamp(),
          `${c.cyan}◆${c.reset}`,
          `${c.cyan}${agent.agent}${c.reset} ${c.dim}(${agent.model})${c.reset} started`,
        );
        state.agentEventCount[ak] = 0;
      }

      // New events (append only)
      const prevCount = state.agentEventCount[ak] ?? 0;
      const events = agent.events ?? [];
      if (events.length > prevCount) {
        for (let j = prevCount; j < events.length; j++) {
          const ev = events[j];
          if (ev.type === "tool_call" && ev.tool) {
            const tn = ev.tool.replace("mcp__flowboost__flowboost_", "fb:");
            printLine(
              timeStamp(),
              `${c.magenta}→${c.reset}`,
              `${c.white}${tn}${c.reset} ${c.dim}${ev.input ?? ""}${c.reset}`,
            );
          } else if (ev.type === "error" && ev.text) {
            printLine(timeStamp(), `${c.red}⚠${c.reset}`, `${c.red}${ev.text}${c.reset}`);
          }
        }
        state.agentEventCount[ak] = events.length;
      }

      // Agent completed/failed
      if (
        (agent.status === "completed" || agent.status === "failed") &&
        prevAgentStatus !== agent.status
      ) {
        const ad = agent.durationMs > 0 ? ` ${c.dim}(${dur(agent.durationMs)})${c.reset}` : "";
        if (agent.status === "completed") {
          printLine(
            timeStamp(),
            `${c.green}✔${c.reset}`,
            `${c.cyan}${agent.agent}${c.reset} done${ad}`,
          );
        } else {
          printLine(
            timeStamp(),
            `${c.red}✘${c.reset}`,
            `${c.cyan}${agent.agent}${c.reset} failed${ad}`,
          );
          if (agent.error) {
            printLine("        ", `${c.red} ${c.reset}`, `${c.red}${agent.error}${c.reset}`);
          }
        }
      }

      state.agentStatus[ak] = agent.status;
    }
  }

  // Final summary
  if (["completed", "failed", "cancelled"].includes(run.status) && !state.donePrinted) {
    const w = Math.min(process.stdout.columns || 80, 100);
    console.log("");
    console.log(`  ${c.dim}${"═".repeat(Math.max(w - 4, 40))}${c.reset}`);

    let elapsed = "";
    if (run.startedAt) {
      const s = new Date(run.startedAt).getTime();
      const e = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
      elapsed = dur(e - s);
    }
    const totalTok = run.totalTokens.input + run.totalTokens.output;
    const label = run.type === "strategy" ? "Strategy" : "Production";
    const statusIcon = run.status === "completed"
      ? `${c.green}✔ DONE${c.reset}`
      : `${c.red}✘ FAILED${c.reset}`;

    console.log(`  ${c.bold}${label} Pipeline${c.reset} ${statusIcon}`);
    console.log(`  ${c.dim}Elapsed: ${elapsed || "—"}  │  Cost: $${run.totalCostUsd.toFixed(2)}  │  Tokens: ${totalTok > 0 ? `${(totalTok / 1000).toFixed(1)}k` : "—"}${c.reset}`);

    // Phase summary
    for (const phase of run.phases) {
      const pName = phase.name.charAt(0).toUpperCase() + phase.name.slice(1);
      let d = "";
      if (phase.startedAt) {
        const s = new Date(phase.startedAt).getTime();
        const e = phase.completedAt ? new Date(phase.completedAt).getTime() : Date.now();
        d = ` ${dur(e - s)}`;
      }
      console.log(`  ${icon(phase.status)} ${pName}${c.dim}${d}${c.reset}`);
    }

    console.log(`  ${c.dim}${"═".repeat(Math.max(w - 4, 40))}${c.reset}`);
    console.log("");
    state.donePrinted = true;
  }
}

async function watchRun(runId: string): Promise<void> {
  const label = runId.slice(0, 8);
  const w = Math.min(process.stdout.columns || 80, 100);
  console.log("");
  console.log(`  ${c.bold}FlowBoost${c.reset} ${c.dim}│${c.reset} Run ${c.dim}${label}${c.reset}`);
  console.log(`  ${c.dim}${"═".repeat(Math.max(w - 4, 40))}${c.reset}`);

  const state: WatchState = {
    phaseStatus: {},
    agentStatus: {},
    agentEventCount: {},
    donePrinted: false,
  };

  while (true) {
    try {
      const run = await api<PipelineRun>("GET", `/pipeline/runs/${runId}`);
      diffAndPrint(run, state);

      if (["completed", "failed", "cancelled"].includes(run.status)) {
        process.exit(run.status === "completed" ? 0 : 1);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`\r  ${c.dim}Waiting... ${msg}${c.reset}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// ── Commands ─────────────────────────────────────────────────────

async function cmdStrategy() {
  const project = await getProject();
  console.log(`${c.bold}Starting strategy pipeline${c.reset} for ${c.cyan}${project.name}${c.reset}`);

  const res = await api<{ runId: string }>("POST", "/pipeline/strategy", { projectId: project.id });
  await watchRun(res.runId);
}

async function cmdTopics() {
  const project = await getProject();
  let plan: ContentPlan;
  try {
    plan = await api<ContentPlan>("GET", `/projects/${project.id}/content-plan`);
  } catch {
    console.log(`${c.red}No content plan yet. Run: npm run pipeline strategy${c.reset}`);
    process.exit(1);
  }

  console.log(`\n  ${c.bold}Content Plan${c.reset} — ${plan.topics.length} topics\n`);
  for (const t of plan.topics) {
    const statusBadge =
      t.status === "approved" ? `${c.green}approved${c.reset}` :
      t.status === "proposed" ? `${c.yellow}proposed${c.reset}` :
      t.status === "rejected" ? `${c.red}rejected${c.reset}` :
      t.status === "produced" ? `${c.green}produced${c.reset}` :
      `${c.dim}${t.status}${c.reset}`;
    console.log(`  ${c.dim}#${t.priority}${c.reset} [${statusBadge}] ${c.bold}${t.title}${c.reset}`);
    console.log(`     ${c.dim}${t.id}  │  ${t.category}  │  kw: ${t.keywords.primary}${c.reset}`);
  }
  console.log("");
}

async function cmdApprove(topicId: string) {
  const project = await getProject();

  if (topicId === "--all") {
    const plan = await api<ContentPlan>("GET", `/projects/${project.id}/content-plan`);
    const proposed = plan.topics.filter((t) => t.status === "proposed");
    if (proposed.length === 0) {
      console.log(`${c.dim}No proposed topics to approve.${c.reset}`);
      return;
    }
    for (const t of proposed) {
      await api("POST", `/projects/${project.id}/content-plan/topics/${t.id}/approve`);
      console.log(`  ${c.green}✔${c.reset} Approved: ${t.title}`);
    }
    console.log(`\n  ${c.bold}${proposed.length} topics approved.${c.reset}\n`);
    return;
  }

  const res = await api<{ topic: Topic }>("POST", `/projects/${project.id}/content-plan/topics/${topicId}/approve`);
  console.log(`${c.green}✔${c.reset} Approved: ${c.bold}${res.topic.title}${c.reset}`);
}

async function cmdProduce(topicId?: string) {
  const project = await getProject();

  if (!topicId) {
    // Auto-pick first approved topic
    const plan = await api<ContentPlan>("GET", `/projects/${project.id}/content-plan`);
    const approved = plan.topics.find((t) => t.status === "approved");
    if (!approved) {
      console.log(`${c.red}No approved topics. Run:${c.reset}`);
      console.log(`  npm run pipeline topics       ${c.dim}# see topics${c.reset}`);
      console.log(`  npm run pipeline approve <id> ${c.dim}# approve one${c.reset}`);
      process.exit(1);
    }
    topicId = approved.id;
    console.log(`${c.dim}Auto-selected topic:${c.reset} ${c.bold}${approved.title}${c.reset}`);
  }

  console.log(`${c.bold}Starting production pipeline${c.reset} for topic ${c.cyan}${topicId.slice(0, 8)}${c.reset}`);
  const res = await api<{ runId: string }>("POST", "/pipeline/produce", {
    projectId: project.id,
    topicId,
  });
  await watchRun(res.runId);
}

// ── Main ─────────────────────────────────────────────────────────

const USAGE = `
  ${c.bold}FlowBoost Pipeline CLI${c.reset}

  ${c.cyan}Usage:${c.reset}
    npm run pipeline strategy              Start strategy pipeline (research + plan)
    npm run pipeline topics                List topics from content plan
    npm run pipeline approve <topicId>     Approve a topic for production
    npm run pipeline approve --all         Approve all proposed topics
    npm run pipeline produce [topicId]     Start production (auto-picks if omitted)
`;

async function main() {
  const cmd = process.argv[2];
  const arg = process.argv[3];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(USAGE);
    process.exit(0);
  }

  try {
    switch (cmd) {
      case "strategy":
        await cmdStrategy();
        break;
      case "topics":
        await cmdTopics();
        break;
      case "approve":
        if (!arg) {
          console.error(`${c.red}Usage: npm run pipeline approve <topicId|--all>${c.reset}`);
          process.exit(1);
        }
        await cmdApprove(arg);
        break;
      case "produce":
        await cmdProduce(arg);
        break;
      default:
        console.error(`${c.red}Unknown command: ${cmd}${c.reset}`);
        console.log(USAGE);
        process.exit(1);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n${c.red}Error: ${msg}${c.reset}\n`);
    process.exit(1);
  }
}

main();
