import Fastify from "fastify";
import cors from "@fastify/cors";
import { createLogger } from "../utils/logger.js";
import { ProjectStore } from "../models/project.js";
import { ArticleStore } from "../models/article.js";
import { PipelineRunStore } from "../models/pipeline-run.js";
import { healthRoutes } from "./routes/health.js";
import { projectRoutes } from "./routes/projects.js";
import { contentPlanRoutes } from "./routes/content-plan.js";
import { articleRoutes } from "./routes/articles.js";
import { pipelineRoutes } from "./routes/pipeline.js";

const log = createLogger("server");

export interface AppContext {
  projects: ProjectStore;
  articles: ArticleStore;
  pipelineRuns: PipelineRunStore;
  dataDir: string;
}

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export async function buildServer(dataDir: string) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  // Application context
  const ctx: AppContext = {
    projects: new ProjectStore(dataDir),
    articles: new ArticleStore(dataDir),
    pipelineRuns: new PipelineRunStore(dataDir),
    dataDir,
  };
  app.decorate("ctx", ctx);

  // Routes
  await app.register(healthRoutes);
  await app.register(projectRoutes, { prefix: "/projects" });
  await app.register(contentPlanRoutes, { prefix: "/projects" });
  await app.register(articleRoutes, { prefix: "/articles" });
  await app.register(pipelineRoutes, { prefix: "/pipeline" });

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
