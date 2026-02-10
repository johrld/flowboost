import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { createConnector } from "../../connectors/index.js";

const log = createLogger("api:articles");

export async function articleRoutes(app: FastifyInstance) {
  // GET /customers/:customerId/projects/:projectId/articles
  app.get<{ Params: { customerId: string; projectId: string } }>("/", async (request) => {
    const { customerId, projectId } = request.params;
    return app.ctx.articlesFor(customerId, projectId).list();
  });

  // GET /customers/:customerId/projects/:projectId/articles/:articleId
  app.get<{ Params: { customerId: string; projectId: string; articleId: string } }>(
    "/:articleId",
    async (request, reply) => {
      const { customerId, projectId, articleId } = request.params;
      const articles = app.ctx.articlesFor(customerId, projectId);
      const article = articles.get(articleId);
      if (!article) {
        return reply.status(404).send({ error: "Article not found" });
      }

      const versions = articles.getVersions(articleId);
      return { ...article, versions };
    },
  );

  // POST /customers/:customerId/projects/:projectId/articles/:articleId/approve
  app.post<{ Params: { customerId: string; projectId: string; articleId: string } }>(
    "/:articleId/approve",
    async (request, reply) => {
      const { customerId, projectId, articleId } = request.params;
      const articles = app.ctx.articlesFor(customerId, projectId);
      const article = articles.get(articleId);
      if (!article) {
        return reply.status(404).send({ error: "Article not found" });
      }

      if (article.status === "delivered") {
        return reply.status(400).send({ error: "Article already delivered" });
      }

      const projects = app.ctx.projectsFor(customerId);
      const project = projects.get(projectId);
      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      // Mark as approved
      articles.update(articleId, {
        status: "approved",
        updatedAt: new Date().toISOString(),
      });

      // Get all versions and the version directory
      const versions = articles.getVersions(articleId);
      if (versions.length === 0) {
        return reply.status(400).send({ error: "No article versions found" });
      }

      const versionDir = articles.getVersionDir(article.id, versions[0].id);

      // Deliver via connector
      const connector = createConnector(project);
      const result = await connector.deliver(project, article, versions, versionDir);

      if (result.success) {
        articles.update(articleId, {
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
          articleId,
          delivery: result,
        };
      } else {
        log.error({ articleId: article.id, error: result.error }, "delivery failed");
        return reply.status(500).send({
          error: "Delivery failed",
          detail: result.error,
          articleId,
        });
      }
    },
  );
}
