import fs from "node:fs";
import path from "node:path";
import { Store } from "./store.js";
import type { PipelineRun, PipelinePhase, AgentCall } from "./types.js";

export class PipelineRunStore extends Store<PipelineRun> {
  constructor(basePath: string) {
    super(basePath, "run.json");
  }

  /** Update a specific phase within a run */
  updatePhase(runId: string, phaseName: string, data: Partial<PipelinePhase>): PipelineRun | null {
    const run = this.get(runId);
    if (!run) return null;

    const phase = run.phases.find((p) => p.name === phaseName);
    if (phase) {
      Object.assign(phase, data);
    }

    // Recalculate totals
    run.totalCostUsd = run.phases.reduce(
      (sum, p) => sum + p.agentCalls.reduce((s, a) => s + a.costUsd, 0),
      0,
    );
    run.totalTokens = run.phases.reduce(
      (acc, p) => {
        for (const a of p.agentCalls) {
          acc.input += a.tokens.input;
          acc.output += a.tokens.output;
        }
        return acc;
      },
      { input: 0, output: 0 },
    );

    return this.update(runId, run);
  }

  /** Add an agent call to a phase */
  addAgentCall(runId: string, phaseName: string, call: AgentCall): PipelineRun | null {
    const run = this.get(runId);
    if (!run) return null;

    const phase = run.phases.find((p) => p.name === phaseName);
    if (!phase) return null;

    phase.agentCalls.push(call);
    return this.updatePhase(runId, phaseName, phase);
  }

  /** Get the scratchpad directory for a run */
  scratchpadDir(runId: string): string {
    const dir = path.join(this.entityDir(runId), "scratchpad");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}

export function createPipelineRunStore(dataDir: string, customerId: string, projectId: string): PipelineRunStore {
  return new PipelineRunStore(path.join(dataDir, "customers", customerId, "projects", projectId, "pipeline-runs"));
}
