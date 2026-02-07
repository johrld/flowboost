import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { PipelineContext } from "../../pipeline/context.js";
import { runStrategyPipeline } from "../../pipeline/strategy/run.js";
import { runProductionPipeline } from "../../pipeline/production/run.js";

const log = createLogger("api:pipeline");

export async function pipelineRoutes(app: FastifyInstance) {
  // POST /pipeline/strategy - Run strategy pipeline
  app.post<{ Body: { projectId: string } }>("/strategy", async (request, reply) => {
    const { projectId } = request.body as { projectId: string };

    const project = app.ctx.projects.get(projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    // Create pipeline run
    const run = app.ctx.pipelineRuns.create({
      projectId,
      type: "strategy",
      status: "pending",
      phases: [
        { name: "audit", status: "pending", agentCalls: [] },
        { name: "research", status: "pending", agentCalls: [] },
        { name: "strategy", status: "pending", agentCalls: [] },
      ],
      totalCostUsd: 0,
      totalTokens: { input: 0, output: 0 },
      createdAt: new Date().toISOString(),
    });

    // Build context and run pipeline asynchronously
    const ctx = new PipelineContext(
      project,
      run,
      {
        projects: app.ctx.projects,
        articles: app.ctx.articles,
        pipelineRuns: app.ctx.pipelineRuns,
      },
      app.ctx.dataDir,
    );

    // Fire and forget — client polls GET /pipeline/runs/:id for progress
    runStrategyPipeline(ctx).catch((error) => {
      log.error({ runId: run.id, err: error }, "strategy pipeline failed");
    });

    return { message: "Strategy pipeline started", runId: run.id };
  });

  // POST /pipeline/produce - Run production pipeline
  app.post<{ Body: { projectId: string; topicId: string } }>("/produce", async (request, reply) => {
    const { projectId, topicId } = request.body as { projectId: string; topicId: string };

    const project = app.ctx.projects.get(projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const plan = app.ctx.projects.getContentPlan(projectId);
    if (!plan) {
      return reply.status(400).send({ error: "No content plan. Run strategy first." });
    }

    const topic = plan.topics.find((t) => t.id === topicId);
    if (!topic) {
      return reply.status(404).send({ error: "Topic not found" });
    }
    if (topic.status !== "approved") {
      return reply.status(400).send({ error: `Topic not approved (status: ${topic.status})` });
    }

    // Create pipeline run
    const run = app.ctx.pipelineRuns.create({
      projectId,
      type: "production",
      status: "pending",
      topicId,
      phases: [
        { name: "outline", status: "pending", agentCalls: [] },
        { name: "writing", status: "pending", agentCalls: [] },
        { name: "assembly", status: "pending", agentCalls: [] },
        { name: "image", status: "pending", agentCalls: [] },
        { name: "quality", status: "pending", agentCalls: [] },
        { name: "translation", status: "pending", agentCalls: [] },
      ],
      totalCostUsd: 0,
      totalTokens: { input: 0, output: 0 },
      createdAt: new Date().toISOString(),
    });

    // Mark topic as in production
    topic.status = "in_production";
    app.ctx.projects.saveContentPlan(projectId, plan);

    // Build context and run pipeline asynchronously
    const ctx = new PipelineContext(
      project,
      run,
      {
        projects: app.ctx.projects,
        articles: app.ctx.articles,
        pipelineRuns: app.ctx.pipelineRuns,
      },
      app.ctx.dataDir,
      topic,
    );

    // Fire and forget — client polls GET /pipeline/runs/:id for progress
    runProductionPipeline(ctx).catch((error) => {
      log.error({ runId: run.id, err: error }, "production pipeline failed");
    });

    return { message: "Production pipeline started", runId: run.id };
  });

  // GET /pipeline/runs/:id
  app.get<{ Params: { id: string } }>("/runs/:id", async (request, reply) => {
    const run = app.ctx.pipelineRuns.get(request.params.id);
    if (!run) {
      return reply.status(404).send({ error: "Pipeline run not found" });
    }
    return run;
  });
}
