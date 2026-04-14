import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { createLogger } from "../utils/logger.js";
import { CustomerStore } from "../models/customer.js";
import { ProjectStore } from "../models/project.js";
import { ContentStore, MediaAssetStore } from "../models/content.js";
import { ContentMediaStore } from "../models/content-media.js";
import { PipelineRunStore } from "../models/pipeline-run.js";
import { TopicStore } from "../models/topic.js";
import { JobStore } from "../models/job.js";
import { MemoryStore } from "../models/memory.js";
import { IdeaStore } from "../models/idea.js";
import { healthRoutes } from "./routes/health.js";
import { customerRoutes } from "./routes/customers.js";
import { projectRoutes } from "./routes/projects.js";
import { topicRoutes } from "./routes/topics.js";
import { contentPlanRoutes } from "./routes/content-plan.js";
import { pipelineRoutes } from "./routes/pipeline.js";
import { githubAuthRoutes, githubApiRoutes, githubWebhookRoutes } from "./routes/github.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { contentIndexRoutes } from "./routes/content-index.js";
import { contentRoutes } from "./routes/content.js";
import { mediaRoutes } from "./routes/media.js";
import { contentTypeRoutes } from "./routes/content-types.js";
import { connectorRoutes } from "./routes/connectors.js";
import { cmoRoutes } from "./routes/cmo.js";
import { jobRoutes } from "./routes/jobs.js";
import { heartbeatRoutes } from "./routes/heartbeat.js";
import { ideaRoutes } from "./routes/ideas.js";

const log = createLogger("server");

export interface AppContext {
  dataDir: string;
  customers: CustomerStore;
  projectsFor(customerId: string): ProjectStore;
  contentFor(customerId: string, projectId: string): ContentStore;
  contentMediaFor(customerId: string, projectId: string, contentId: string): ContentMediaStore;
  mediaFor(customerId: string, projectId: string): MediaAssetStore;
  pipelineRunsFor(customerId: string, projectId: string): PipelineRunStore;
  topicsFor(customerId: string, projectId: string): TopicStore;
  jobsFor(customerId: string, projectId: string): JobStore;
  memoryFor(customerId: string, projectId: string): MemoryStore;
  ideasFor(customerId: string, projectId: string): IdeaStore;
}

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export async function buildServer(dataDir: string) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

  // Application context with factory methods
  const ctx: AppContext = {
    dataDir,
    customers: new CustomerStore(dataDir),
    projectsFor(customerId: string) {
      return new ProjectStore(path.join(dataDir, "customers", customerId, "projects"));
    },
    contentFor(customerId: string, projectId: string) {
      return new ContentStore(path.join(dataDir, "customers", customerId, "projects", projectId, "content"));
    },
    contentMediaFor(customerId: string, projectId: string, contentId: string) {
      return new ContentMediaStore(
        path.join(dataDir, "customers", customerId, "projects", projectId, "content", contentId),
      );
    },
    mediaFor(customerId: string, projectId: string) {
      return new MediaAssetStore(path.join(dataDir, "customers", customerId, "projects", projectId, "media"));
    },
    pipelineRunsFor(customerId: string, projectId: string) {
      return new PipelineRunStore(path.join(dataDir, "customers", customerId, "projects", projectId, "pipeline-runs"));
    },
    topicsFor(customerId: string, projectId: string) {
      return new TopicStore(path.join(dataDir, "customers", customerId, "projects", projectId, "topics"));
    },
    jobsFor(customerId: string, projectId: string) {
      return new JobStore(path.join(dataDir, "customers", customerId, "projects", projectId, "jobs"));
    },
    memoryFor(customerId: string, projectId: string) {
      return new MemoryStore(path.join(dataDir, "customers", customerId, "projects", projectId));
    },
    ideasFor(customerId: string, projectId: string) {
      return new IdeaStore(path.join(dataDir, "customers", customerId, "projects", projectId, "ideas"));
    },
  };
  app.decorate("ctx", ctx);

  // Routes
  await app.register(healthRoutes);
  await app.register(customerRoutes, { prefix: "/customers" });
  await app.register(projectRoutes, { prefix: "/customers/:customerId/projects" });
  await app.register(topicRoutes, { prefix: "/customers/:customerId/projects/:projectId/topics" });
  await app.register(contentPlanRoutes, { prefix: "/customers/:customerId/projects/:projectId" });
  await app.register(pipelineRoutes, { prefix: "/customers/:customerId/projects/:projectId/pipeline" });
  await app.register(githubAuthRoutes, { prefix: "/auth" });
  await app.register(githubApiRoutes, { prefix: "/github" });
  await app.register(githubWebhookRoutes, { prefix: "/github" });
  await app.register(webhookRoutes, { prefix: "/webhooks" });
  await app.register(contentRoutes, { prefix: "/customers/:customerId/projects/:projectId/content" });
  await app.register(mediaRoutes, { prefix: "/customers/:customerId/projects/:projectId/media" });
  await app.register(contentIndexRoutes, { prefix: "/customers/:customerId/projects/:projectId/content-index" });
  await app.register(contentTypeRoutes, { prefix: "/customers/:customerId/projects/:projectId/content-types" });
  await app.register(connectorRoutes, { prefix: "/customers/:customerId/projects/:projectId/connectors" });
  await app.register(cmoRoutes, { prefix: "/customers/:customerId/projects/:projectId/cmo" });
  await app.register(jobRoutes, { prefix: "/customers/:customerId/projects/:projectId/jobs" });
  await app.register(heartbeatRoutes, { prefix: "/customers/:customerId/projects/:projectId/heartbeat" });
  await app.register(ideaRoutes, { prefix: "/customers/:customerId/projects/:projectId/ideas" });

  // Error handler
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    log.error({ err: error }, "request error");
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: error.message,
      statusCode,
    });
  });

  return app;
}
