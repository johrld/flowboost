import path from "node:path";
import type { Project, PipelineRun, Topic } from "../models/types.js";
import type { ProjectStore } from "../models/project.js";
import type { ArticleStore } from "../models/article.js";
import type { PipelineRunStore } from "../models/pipeline-run.js";

export class PipelineContext {
  constructor(
    public readonly project: Project,
    public readonly run: PipelineRun,
    public readonly stores: {
      projects: ProjectStore;
      articles: ArticleStore;
      pipelineRuns: PipelineRunStore;
    },
    public readonly dataDir: string,
    public readonly topic?: Topic,
  ) {}

  get projectDir(): string {
    return path.join(this.dataDir, "projects", this.project.id);
  }

  get scratchpadDir(): string {
    return this.stores.pipelineRuns.scratchpadDir(this.run.id);
  }

  /** Update run in store */
  updateRun(data: Partial<PipelineRun>): void {
    this.stores.pipelineRuns.update(this.run.id, data);
    Object.assign(this.run, data);
  }

  /** Mark a phase as running */
  startPhase(phaseName: string): void {
    this.stores.pipelineRuns.updatePhase(this.run.id, phaseName, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    const phase = this.run.phases.find((p) => p.name === phaseName);
    if (phase) {
      phase.status = "running";
      phase.startedAt = new Date().toISOString();
    }
  }

  /** Mark a phase as completed */
  completePhase(phaseName: string): void {
    this.stores.pipelineRuns.updatePhase(this.run.id, phaseName, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
    const phase = this.run.phases.find((p) => p.name === phaseName);
    if (phase) {
      phase.status = "completed";
      phase.completedAt = new Date().toISOString();
    }
  }

  /** Mark a phase as failed */
  failPhase(phaseName: string, error: string): void {
    this.stores.pipelineRuns.updatePhase(this.run.id, phaseName, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error,
    });
    const phase = this.run.phases.find((p) => p.name === phaseName);
    if (phase) {
      phase.status = "failed";
      phase.completedAt = new Date().toISOString();
      phase.error = error;
    }
  }
}
