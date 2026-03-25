import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { simpleGit } from "simple-git";
import type { Project, PipelineRun, Topic } from "../models/types.js";
import type { ConnectorSchema } from "../connectors/site/types.js";
import type { CustomerStore } from "../models/customer.js";
import type { ProjectStore } from "../models/project.js";
import type { ArticleStore } from "../models/article.js";
import type { ContentStore } from "../models/content.js";
import type { PipelineRunStore } from "../models/pipeline-run.js";
import type { TopicStore } from "../models/topic.js";
import { getCloneUrl } from "../services/github.js";

export class PipelineContext {
  constructor(
    public readonly customerId: string,
    public readonly project: Project,
    public readonly run: PipelineRun,
    public readonly stores: {
      customers: CustomerStore;
      projects: ProjectStore;
      articles: ArticleStore;
      content: ContentStore;
      pipelineRuns: PipelineRunStore;
      topics: TopicStore;
    },
    public readonly dataDir: string,
    public readonly topic?: Topic,
    public readonly connectorSchema?: ConnectorSchema,
  ) {}

  /** Build a prompt context string from briefing inputs (text + transcript content) */
  getBriefingInputsContext(): string {
    if (!this.topic?.inputs || this.topic.inputs.length === 0) return "";
    const textInputs = this.topic.inputs
      .filter((i) => i.type === "text" || i.type === "transcript")
      .map((i) => `[${i.type}]: ${i.content}`);
    if (textInputs.length === 0) return "";
    return `\n## Briefing Inputs\n${textInputs.join("\n\n")}`;
  }

  /** Build a prompt context string from connector schema slots */
  getSchemaContext(): string {
    if (!this.connectorSchema) return "";
    const slots = this.connectorSchema.slots
      .map((s) => `- **${s.label}** (${s.type}${s.required ? ", required" : ""})${s.constraints?.charLimit ? ` max ${s.constraints.charLimit} chars` : ""}${s.constraints?.wordCount ? ` ${s.constraints.wordCount.min}-${s.constraints.wordCount.max} words` : ""}`)
      .join("\n");
    return `\n## Target Structure: ${this.connectorSchema.label}\nGenerate content for each of these slots:\n${slots}`;
  }

  get customerDir(): string {
    return path.join(this.dataDir, "customers", this.customerId);
  }

  get projectDir(): string {
    return path.join(this.customerDir, "projects", this.project.id);
  }

  get scratchpadDir(): string {
    return this.stores.pipelineRuns.scratchpadDir(this.run.id);
  }

  private _repoDir: string | null = null;

  /**
   * Prepare the repo directory for pipeline access.
   * For GitHub connector: clones repo with installation token.
   * For git/other: uses REPOS_DIR env or projectDir/repo fallback.
   * Call once at pipeline start, reuse the returned path.
   */
  async prepareRepo(): Promise<string> {
    if (this._repoDir) return this._repoDir;

    if (this.project.connector.type === "github") {
      const gh = this.project.connector.github;
      if (!gh) throw new Error("GitHub connector configured but no github config found");

      const cloneUrl = await getCloneUrl(gh.installationId, gh.owner, gh.repo);
      const tmpDir = path.join(os.tmpdir(), `flowboost-repo-${this.run.id}`);

      // Clean up previous attempt
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }

      await simpleGit().clone(cloneUrl, tmpDir, ["--branch", gh.branch, "--depth", "1"]);
      this._repoDir = tmpDir;
      return tmpDir;
    }

    // Fallback: REPOS_DIR (dev) or projectDir/repo
    const reposDir = process.env.REPOS_DIR;
    if (reposDir) {
      this._repoDir = path.join(reposDir, this.project.slug);
    } else {
      this._repoDir = path.join(this.projectDir, "repo");
    }
    return this._repoDir;
  }

  /** Clean up cloned repo if it was a temp directory */
  cleanupRepo(): void {
    if (this._repoDir?.startsWith(os.tmpdir()) && fs.existsSync(this._repoDir)) {
      fs.rmSync(this._repoDir, { recursive: true });
      this._repoDir = null;
    }
  }

  /** Legacy sync accessor — prefer prepareRepo() */
  get repoDir(): string {
    if (this._repoDir) return this._repoDir;
    const reposDir = process.env.REPOS_DIR;
    if (reposDir) return path.join(reposDir, this.project.slug);
    return path.join(this.projectDir, "repo");
  }

  /** Get effective brand voice (project override > customer fallback) */
  getBrandVoice(): string | null {
    return this.stores.projects.getEffectiveBrandVoice(
      this.project.id,
      this.stores.customers,
      this.customerId,
    );
  }

  /** Get effective style guide (project override > customer fallback) */
  getStyleGuide(): string | null {
    return this.stores.projects.getEffectiveStyleGuide(
      this.project.id,
      this.stores.customers,
      this.customerId,
    );
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
