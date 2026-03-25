import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { PipelineContext } from "../../pipeline/context.js";
import { runStrategyPipeline } from "../../pipeline/strategy/run.js";
import { runProductionPipeline } from "../../pipeline/production/run.js";
import { runVideoPipeline } from "../../pipeline/video/run.js";
import { runAudioPipeline } from "../../pipeline/audio/run.js";
import { runEnrichPipeline } from "../../pipeline/enrich/run.js";

const log = createLogger("api:pipeline");

export async function pipelineRoutes(app: FastifyInstance) {
  // POST /customers/:customerId/projects/:projectId/pipeline/strategy
  app.post<{ Params: { customerId: string; projectId: string } }>("/strategy", async (request, reply) => {
    const { customerId, projectId } = request.params;

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    // Create pipeline run
    const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
      customerId,
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
      customerId,
      project,
      run,
      {
        customers: app.ctx.customers,
        projects: app.ctx.projectsFor(customerId),
        articles: app.ctx.articlesFor(customerId, projectId),
        content: app.ctx.contentFor(customerId, projectId),
        media: app.ctx.mediaFor(customerId, projectId),
        pipelineRuns: app.ctx.pipelineRunsFor(customerId, projectId),
        topics: app.ctx.topicsFor(customerId, projectId),
      },
      app.ctx.dataDir,
    );

    // Fire and forget — client polls GET /pipeline/runs/:id for progress
    runStrategyPipeline(ctx).catch((error) => {
      log.error({ runId: run.id, err: error }, "strategy pipeline failed");
    });

    return { message: "Strategy pipeline started", runId: run.id };
  });

  // POST /customers/:customerId/projects/:projectId/pipeline/produce
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { topicId: string };
  }>("/produce", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { topicId } = request.body as { topicId: string };

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const topics = app.ctx.topicsFor(customerId, projectId);
    const topic = topics.get(topicId);
    if (!topic) {
      return reply.status(404).send({ error: "Topic not found" });
    }
    if (topic.status !== "approved") {
      return reply.status(400).send({ error: `Topic not approved (status: ${topic.status})` });
    }

    // Create pipeline run
    const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
      customerId,
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
    topics.update(topicId, { status: "in_production" });

    // Build context and run pipeline asynchronously
    const ctx = new PipelineContext(
      customerId,
      project,
      run,
      {
        customers: app.ctx.customers,
        projects: app.ctx.projectsFor(customerId),
        articles: app.ctx.articlesFor(customerId, projectId),
        content: app.ctx.contentFor(customerId, projectId),
        media: app.ctx.mediaFor(customerId, projectId),
        pipelineRuns: app.ctx.pipelineRunsFor(customerId, projectId),
        topics: app.ctx.topicsFor(customerId, projectId),
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

  // POST /pipeline/produce-video
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { topicId: string };
  }>("/produce-video", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { topicId } = request.body as { topicId: string };

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const topics = app.ctx.topicsFor(customerId, projectId);
    const topic = topics.get(topicId);
    if (!topic) return reply.status(404).send({ error: "Topic not found" });
    if (topic.status !== "approved") {
      return reply.status(400).send({ error: `Topic not approved (status: ${topic.status})` });
    }

    const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
      customerId,
      projectId,
      type: "video_production",
      status: "pending",
      topicId,
      phases: [
        { name: "script", status: "pending", agentCalls: [] },
        { name: "storyboard", status: "pending", agentCalls: [] },
        { name: "generate", status: "pending", agentCalls: [] },
        { name: "subtitle", status: "pending", agentCalls: [] },
        { name: "thumbnail", status: "pending", agentCalls: [] },
      ],
      totalCostUsd: 0,
      totalTokens: { input: 0, output: 0 },
      createdAt: new Date().toISOString(),
    });

    topics.update(topicId, { status: "in_production" });

    const ctx = new PipelineContext(
      customerId,
      project,
      run,
      {
        customers: app.ctx.customers,
        projects: app.ctx.projectsFor(customerId),
        articles: app.ctx.articlesFor(customerId, projectId),
        content: app.ctx.contentFor(customerId, projectId),
        media: app.ctx.mediaFor(customerId, projectId),
        pipelineRuns: app.ctx.pipelineRunsFor(customerId, projectId),
        topics: app.ctx.topicsFor(customerId, projectId),
      },
      app.ctx.dataDir,
      topic,
    );

    runVideoPipeline(ctx).catch((error) => {
      log.error({ runId: run.id, err: error }, "video pipeline failed");
    });

    return { message: "Video pipeline started", runId: run.id };
  });

  // POST /pipeline/produce-audio
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { topicId: string };
  }>("/produce-audio", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { topicId } = request.body as { topicId: string };

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const topics = app.ctx.topicsFor(customerId, projectId);
    const topic = topics.get(topicId);
    if (!topic) return reply.status(404).send({ error: "Topic not found" });
    if (topic.status !== "approved") {
      return reply.status(400).send({ error: `Topic not approved (status: ${topic.status})` });
    }

    const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
      customerId,
      projectId,
      type: "audio_production",
      status: "pending",
      topicId,
      phases: [
        { name: "script", status: "pending", agentCalls: [] },
        { name: "voice", status: "pending", agentCalls: [] },
        { name: "transcript", status: "pending", agentCalls: [] },
      ],
      totalCostUsd: 0,
      totalTokens: { input: 0, output: 0 },
      createdAt: new Date().toISOString(),
    });

    topics.update(topicId, { status: "in_production" });

    const ctx = new PipelineContext(
      customerId,
      project,
      run,
      {
        customers: app.ctx.customers,
        projects: app.ctx.projectsFor(customerId),
        articles: app.ctx.articlesFor(customerId, projectId),
        content: app.ctx.contentFor(customerId, projectId),
        media: app.ctx.mediaFor(customerId, projectId),
        pipelineRuns: app.ctx.pipelineRunsFor(customerId, projectId),
        topics: app.ctx.topicsFor(customerId, projectId),
      },
      app.ctx.dataDir,
      topic,
    );

    runAudioPipeline(ctx).catch((error) => {
      log.error({ runId: run.id, err: error }, "audio pipeline failed");
    });

    return { message: "Audio pipeline started", runId: run.id };
  });

  // POST /customers/:customerId/projects/:projectId/pipeline/enrich
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { topicId: string };
  }>("/enrich", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { topicId } = (request.body ?? {}) as { topicId?: string };

    if (!topicId) {
      return reply.status(400).send({ error: "topicId is required" });
    }

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const topic = app.ctx.topicsFor(customerId, projectId).get(topicId);
    if (!topic) {
      return reply.status(404).send({ error: "Topic not found" });
    }

    const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
      customerId,
      projectId,
      type: "strategy",
      status: "pending",
      topicId,
      phases: [
        { name: "enrich", status: "pending", agentCalls: [] },
      ],
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
        articles: app.ctx.articlesFor(customerId, projectId),
        content: app.ctx.contentFor(customerId, projectId),
        media: app.ctx.mediaFor(customerId, projectId),
        pipelineRuns: app.ctx.pipelineRunsFor(customerId, projectId),
        topics: app.ctx.topicsFor(customerId, projectId),
      },
      app.ctx.dataDir,
    );

    // Fire and forget — client polls topic for enriched: true
    runEnrichPipeline(ctx, topicId).catch((error) => {
      log.error({ runId: run.id, err: error }, "enrich pipeline failed");
    });

    return { message: "Enrichment started", runId: run.id };
  });

  // GET /customers/:customerId/projects/:projectId/pipeline/runs
  app.get<{ Params: { customerId: string; projectId: string } }>("/runs", async (request) => {
    const { customerId, projectId } = request.params;
    return app.ctx.pipelineRunsFor(customerId, projectId).list();
  });

  // GET /customers/:customerId/projects/:projectId/pipeline/runs/:runId
  app.get<{ Params: { customerId: string; projectId: string; runId: string } }>(
    "/runs/:runId",
    async (request, reply) => {
      const { customerId, projectId, runId } = request.params;
      const run = app.ctx.pipelineRunsFor(customerId, projectId).get(runId);
      if (!run) {
        return reply.status(404).send({ error: "Pipeline run not found" });
      }
      return run;
    },
  );
}
