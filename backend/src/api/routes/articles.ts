import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { createConnector } from "../../connectors/index.js";

const log = createLogger("api:articles");

export async function articleRoutes(app: FastifyInstance) {
  // GET /articles?projectId=x
  app.get<{ Querystring: { projectId?: string } }>("/", async (request) => {
    const articles = app.ctx.articles.list();
    const { projectId } = request.query;
    if (projectId) {
      return articles.filter((a) => a.projectId === projectId);
    }
    return articles;
  });

  // GET /articles/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const article = app.ctx.articles.get(request.params.id);
    if (!article) {
      return reply.status(404).send({ error: "Article not found" });
    }

    const versions = app.ctx.articles.getVersions(request.params.id);
    return { ...article, versions };
  });

  // POST /articles/:id/approve - Approve and deliver via connector
  app.post<{ Params: { id: string } }>("/:id/approve", async (request, reply) => {
    const article = app.ctx.articles.get(request.params.id);
    if (!article) {
      return reply.status(404).send({ error: "Article not found" });
    }

    if (article.status === "delivered") {
      return reply.status(400).send({ error: "Article already delivered" });
    }

    const project = app.ctx.projects.get(article.projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    // Mark as approved
    app.ctx.articles.update(request.params.id, {
      status: "approved",
      updatedAt: new Date().toISOString(),
    });

    // Get all versions and the version directory
    const versions = app.ctx.articles.getVersions(request.params.id);
    if (versions.length === 0) {
      return reply.status(400).send({ error: "No article versions found" });
    }

    const versionDir = app.ctx.articles.getVersionDir(article.id, versions[0].id);

    // Deliver via connector
    const connector = createConnector(project);
    const result = await connector.deliver(project, article, versions, versionDir);

    if (result.success) {
      app.ctx.articles.update(request.params.id, {
        status: "delivered",
        deliveredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      log.info({
        articleId: article.id,
        connector: result.connector,
        files: result.filesWritten.length,
        commitHash: result.commitHash,
      }, "article delivered");

      return {
        message: "Article approved and delivered",
        articleId: request.params.id,
        delivery: result,
      };
    } else {
      log.error({ articleId: article.id, error: result.error }, "delivery failed");
      return reply.status(500).send({
        error: "Delivery failed",
        detail: result.error,
        articleId: request.params.id,
      });
    }
  });
}
