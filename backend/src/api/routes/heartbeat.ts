import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { PipelineContext } from "../../pipeline/context.js";
import { runTrendScanner, runContentWatcher } from "../../agents/workflows/monitor.js";
import { runCompetitorScan } from "../../agents/workflows/competitor-scan.js";
import { getMonitorAgents } from "../../agents/registry.js";

const log = createLogger("api:heartbeat");

/**
 * Heartbeat/monitor routes — triggered by external cron.
 * Prefix: /customers/:customerId/projects/:projectId/heartbeat
 */
export async function heartbeatRoutes(app: FastifyInstance) {
  /** Helper to create a PipelineContext for a monitor run */
  function createMonitorCtx(
    customerId: string,
    projectId: string,
    agentName: string,
  ) {
    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) return null;

    // Build phases: for competitor scan, one phase per competitor + classify + analyze
    const project2 = app.ctx.projectsFor(customerId).get(projectId);
    const competitors = project2?.competitors ?? [];
    const phases = agentName === "monitor-competitors" && competitors.length > 0
      ? [
          ...competitors.map((c) => ({ name: `crawl:${c.name}`, status: "pending" as const, agentCalls: [] })),
          { name: "classify", status: "pending" as const, agentCalls: [] },
          { name: "analyze", status: "pending" as const, agentCalls: [] },
        ]
      : [{ name: agentName, status: "pending" as const, agentCalls: [] }];

    const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
      customerId,
      projectId,
      type: "strategy",
      status: "pending",
      phases,
      totalCostUsd: 0,
      totalTokens: { input: 0, output: 0 },
      createdAt: new Date().toISOString(),
    });

    return new PipelineContext(
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
    );
  }

  // POST /heartbeat/competitor-scan — run competitor monitor
  app.post<{ Params: { customerId: string; projectId: string } }>(
    "/competitor-scan",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const ctx = createMonitorCtx(customerId, projectId, "monitor-competitors");
      if (!ctx) return reply.status(404).send({ error: "Project not found" });

      const jobs = app.ctx.jobsFor(customerId, projectId);
      runCompetitorScan(ctx, jobs).catch((err) => {
        log.error({ err }, "competitor scan failed");
      });

      return { message: "Competitor scan started", runId: ctx.run.id };
    },
  );

  // POST /heartbeat/trend-scan — run trend scanner
  app.post<{ Params: { customerId: string; projectId: string } }>(
    "/trend-scan",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const ctx = createMonitorCtx(customerId, projectId, "monitor-trends");
      if (!ctx) return reply.status(404).send({ error: "Project not found" });

      const jobs = app.ctx.jobsFor(customerId, projectId);
      runTrendScanner(ctx, jobs).catch((err) => {
        log.error({ err }, "trend scanner failed");
      });

      return { message: "Trend scan started", runId: ctx.run.id };
    },
  );

  // POST /heartbeat/content-watch — run content watcher
  app.post<{ Params: { customerId: string; projectId: string } }>(
    "/content-watch",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const ctx = createMonitorCtx(customerId, projectId, "monitor-content");
      if (!ctx) return reply.status(404).send({ error: "Project not found" });

      const jobs = app.ctx.jobsFor(customerId, projectId);
      runContentWatcher(ctx, jobs).catch((err) => {
        log.error({ err }, "content watcher failed");
      });

      return { message: "Content watch started", runId: ctx.run.id };
    },
  );

  // POST /heartbeat/trigger — run all due monitors
  app.post<{ Params: { customerId: string; projectId: string } }>(
    "/trigger",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const memory = app.ctx.memoryFor(customerId, projectId);
      const meta = memory.getMeta();
      const now = Date.now();
      const started: string[] = [];

      // Check each monitor agent's schedule against last run
      const monitors = getMonitorAgents();
      for (const agent of monitors) {
        const lastRun = meta.lastRunBy[`areas/${agent.name.replace("monitor-", "")}-landscape.json`]
          ? meta.lastUpdated[`areas/${agent.name.replace("monitor-", "")}-landscape.json`]
          : null;

        // Simple check: if never run, or last run > 24h ago, run it
        const lastRunMs = lastRun ? new Date(lastRun).getTime() : 0;
        const hoursSinceLastRun = (now - lastRunMs) / (1000 * 60 * 60);

        if (hoursSinceLastRun > 24) {
          const ctx = createMonitorCtx(customerId, projectId, agent.name);
          if (!ctx) continue;

          const jobs = app.ctx.jobsFor(customerId, projectId);

          if (agent.name === "monitor-competitors") {
            runCompetitorScan(ctx, jobs).catch((err) => log.error({ err }, "competitor scan failed"));
          } else if (agent.name === "monitor-trends") {
            runTrendScanner(ctx, jobs).catch((err) => log.error({ err }, "trend scanner failed"));
          } else if (agent.name === "monitor-content") {
            runContentWatcher(ctx, jobs).catch((err) => log.error({ err }, "content watcher failed"));
          }
          started.push(agent.name);
        }
      }

      return {
        message: started.length > 0 ? `Started ${started.length} monitors` : "No monitors due",
        started,
      };
    },
  );

  // GET /heartbeat/status — check when monitors last ran
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/status",
    async (request) => {
      const { customerId, projectId } = request.params;
      const memory = app.ctx.memoryFor(customerId, projectId);
      const meta = memory.getMeta();
      const monitors = getMonitorAgents();

      return {
        monitors: monitors.map((a) => ({
          name: a.name,
          role: a.role,
          schedule: a.heartbeat?.schedule,
          lastUpdated: meta.lastUpdated,
          lastRunBy: meta.lastRunBy,
        })),
        memoryFiles: memory.listFiles(),
      };
    },
  );
}
