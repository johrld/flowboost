import { Store } from "./store.js";
import type { Job, JobComment, JobStatus } from "./types.js";

export class JobStore extends Store<Job> {
  constructor(basePath: string) {
    super(basePath, "job.json");
  }

  /** List jobs filtered by status, agent, flow, or parent */
  listFiltered(filters?: {
    status?: JobStatus;
    assigneeAgent?: string;
    flowId?: string;
    parentJobId?: string;
    type?: string;
  }): Job[] {
    let jobs = this.list();
    if (filters?.status) jobs = jobs.filter((j) => j.status === filters.status);
    if (filters?.assigneeAgent) jobs = jobs.filter((j) => j.assigneeAgent === filters.assigneeAgent);
    if (filters?.flowId) jobs = jobs.filter((j) => j.flowId === filters.flowId);
    if (filters?.parentJobId) jobs = jobs.filter((j) => j.parentJobId === filters.parentJobId);
    if (filters?.type) jobs = jobs.filter((j) => j.type === filters.type);
    return jobs;
  }

  /** Get all child jobs of a parent */
  getChildren(parentJobId: string): Job[] {
    return this.list().filter((j) => j.parentJobId === parentJobId);
  }

  /** Check if all children of a parent are in terminal states */
  allChildrenDone(parentJobId: string): boolean {
    const children = this.getChildren(parentJobId);
    if (children.length === 0) return true;
    return children.every((c) => c.status === "done" || c.status === "failed" || c.status === "cancelled");
  }

  /** Add a comment to a job */
  addComment(jobId: string, agentName: string, content: string): Job | null {
    const job = this.get(jobId);
    if (!job) return null;
    const comment: JobComment = {
      id: crypto.randomUUID(),
      agentName,
      content,
      createdAt: new Date().toISOString(),
    };
    const comments = [...(job.comments ?? []), comment];
    return this.update(jobId, { comments } as Partial<Job>);
  }

  /** Transition job status with timestamp tracking */
  transition(jobId: string, status: JobStatus, output?: Record<string, unknown>): Job | null {
    const updates: Partial<Job> = { status };
    if (status === "in_progress" && !this.get(jobId)?.startedAt) {
      updates.startedAt = new Date().toISOString();
    }
    if (status === "done" || status === "failed" || status === "cancelled") {
      updates.completedAt = new Date().toISOString();
    }
    if (output) updates.output = output;
    return this.update(jobId, updates);
  }
}
