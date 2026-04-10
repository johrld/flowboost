import path from "node:path";
import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { PipelineContext } from "../../pipeline/context.js";
import { runArticleWorkflow } from "../../agents/workflows/article.js";
import { runSocialWorkflow } from "../../agents/workflows/social.js";
import type { Job } from "../../models/types.js";

const log = createLogger("api:jobs");

/**
 * Job-based workflow routes (v2 agent system).
 * Prefix: /customers/:customerId/projects/:projectId/jobs
 */
export async function jobRoutes(app: FastifyInstance) {
  // GET /jobs — list all jobs
  app.get<{
    Params: { customerId: string; projectId: string };
    Querystring: { status?: string; flowId?: string; type?: string };
  }>(
    "/",
    async (request) => {
      const { customerId, projectId } = request.params;
      const { status, flowId, type } = request.query;
      const jobs = app.ctx.jobsFor(customerId, projectId);
      return jobs.listFiltered({
        status: status as Job["status"] | undefined,
        flowId,
        type,
      });
    },
  );

  // GET /jobs/:jobId — get a single job
  app.get<{ Params: { customerId: string; projectId: string; jobId: string } }>(
    "/:jobId",
    async (request, reply) => {
      const { customerId, projectId, jobId } = request.params;
      const job = app.ctx.jobsFor(customerId, projectId).get(jobId);
      if (!job) return reply.status(404).send({ error: "Job not found" });
      return job;
    },
  );

  // POST /jobs/article — trigger article workflow for a flow/topic
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { flowId: string; skipResearch?: boolean; contentId?: string };
  }>(
    "/article",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const { flowId, skipResearch, contentId } = (request.body ?? {}) as {
        flowId?: string; skipResearch?: boolean; contentId?: string;
      };

      if (!flowId) return reply.status(400).send({ error: "flowId required" });

      const project = app.ctx.projectsFor(customerId).get(projectId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const topic = app.ctx.topicsFor(customerId, projectId).get(flowId);
      if (!topic) return reply.status(404).send({ error: "Flow/topic not found" });

      // Create pipeline run for tracking
      const phases = skipResearch
        ? ["outline", "writing", "assembly", "quality"]
        : ["research", "outline", "writing", "assembly", "quality"];

      const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
        customerId,
        projectId,
        type: "production",
        status: "pending",
        flowId,
        contentId,
        phases: phases.map((name) => ({ name, status: "pending" as const, agentCalls: [] })),
        totalCostUsd: 0,
        totalTokens: { input: 0, output: 0 },
        createdAt: new Date().toISOString(),
      });

      const ctx = new PipelineContext(
        customerId,
        project,
        run,
        {
          customers: app.ctx.customers,
          projects: app.ctx.projectsFor(customerId),
          content: app.ctx.contentFor(customerId, projectId),
          pipelineRuns: app.ctx.pipelineRunsFor(customerId, projectId),
          topics: app.ctx.topicsFor(customerId, projectId),
        },
        app.ctx.dataDir,
        topic,
      );

      const jobs = app.ctx.jobsFor(customerId, projectId);

      // Fire and forget
      runArticleWorkflow(ctx, jobs, { skipResearch }).catch((err) => {
        log.error({ runId: run.id, err }, "article workflow failed");
      });

      return { message: "Article workflow started", runId: run.id };
    },
  );

  // POST /jobs/social — trigger social post workflow
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { flowId: string; platform: string; sourceContentId?: string; contentId?: string };
  }>(
    "/social",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const { flowId, platform, sourceContentId, contentId } = (request.body ?? {}) as {
        flowId?: string; platform?: string; sourceContentId?: string; contentId?: string;
      };

      if (!flowId || !platform) return reply.status(400).send({ error: "flowId and platform required" });

      const project = app.ctx.projectsFor(customerId).get(projectId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const topic = app.ctx.topicsFor(customerId, projectId).get(flowId);
      if (!topic) return reply.status(404).send({ error: "Flow/topic not found" });

      const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
        customerId,
        projectId,
        type: "social_production",
        status: "pending",
        flowId,
        contentId,
        phases: [{ name: "writing", status: "pending" as const, agentCalls: [] }],
        totalCostUsd: 0,
        totalTokens: { input: 0, output: 0 },
        createdAt: new Date().toISOString(),
      });

      const ctx = new PipelineContext(
        customerId,
        project,
        run,
        {
          customers: app.ctx.customers,
          projects: app.ctx.projectsFor(customerId),
          content: app.ctx.contentFor(customerId, projectId),
          pipelineRuns: app.ctx.pipelineRunsFor(customerId, projectId),
          topics: app.ctx.topicsFor(customerId, projectId),
        },
        app.ctx.dataDir,
        topic,
      );

      const jobs = app.ctx.jobsFor(customerId, projectId);

      runSocialWorkflow(ctx, jobs, { platform, sourceContentId }).catch((err) => {
        log.error({ runId: run.id, err }, "social workflow failed");
      });

      return { message: "Social workflow started", runId: run.id };
    },
  );
}
