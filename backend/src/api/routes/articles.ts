import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { createSiteConnector } from "../../connectors/site/factory.js";
import { ContentIndexStore } from "../../models/content-index.js";
import type { SiteContentLangMeta } from "../../models/types.js";

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
  // Writes content to the platform (may create draft or publish directly)
  app.post<{ Params: { customerId: string; projectId: string; articleId: string } }>(
    "/:articleId/approve",
    async (request, reply) => {
      const { customerId, projectId, articleId } = request.params;
      const articles = app.ctx.articlesFor(customerId, projectId);
      const article = articles.get(articleId);
      if (!article) {
        return reply.status(404).send({ error: "Article not found" });
      }

      if (article.status === "delivered" || article.status === "published") {
        return reply.status(400).send({ error: `Article already ${article.status}` });
      }

      const project = app.ctx.projectsFor(customerId).get(projectId);
      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      // Mark as approved
      articles.update(articleId, {
        status: "approved",
        updatedAt: new Date().toISOString(),
      });

      const versions = articles.getVersions(articleId);
      if (versions.length === 0) {
        return reply.status(400).send({ error: "No article versions found" });
      }

      const versionDir = articles.getVersionDir(article.id, versions[0].id);

      // Write via platform-agnostic SiteConnector
      const connector = createSiteConnector(project);
      const result = await connector.write(project, article, versions, versionDir);

      if (!result.success) {
        log.error({ articleId, error: result.error }, "write failed");
        return reply.status(500).send({
          error: "Delivery failed",
          detail: result.error,
          articleId,
        });
      }

      if (result.published) {
        // Platform published on write (filesystem, WordPress, Shopify)
        articles.update(articleId, {
          status: "published",
          deliveredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Update Content Index
        await updateContentIndex(app, customerId, projectId, article, versions, connector.platform, result.ref);

        log.info({ articleId, platform: connector.platform }, "article written and published");
        return {
          message: "Article approved and published",
          articleId,
          published: true,
          ref: result.ref,
        };
      } else {
        // Platform created draft/PR — needs explicit publish()
        articles.update(articleId, {
          status: "delivered",
          deliveredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        log.info({
          articleId,
          platform: connector.platform,
          ref: result.ref,
          url: result.url,
        }, "article delivered (awaiting publish)");

        return {
          message: "Article delivered — review and publish when ready",
          articleId,
          published: false,
          ref: result.ref,
          url: result.url,
        };
      }
    },
  );

  // POST /customers/:customerId/projects/:projectId/articles/:articleId/publish
  // Makes delivered content live (merges PR, publishes draft, etc.)
  app.post<{
    Params: { customerId: string; projectId: string; articleId: string };
    Body: { ref?: string };
  }>(
    "/:articleId/publish",
    async (request, reply) => {
      const { customerId, projectId, articleId } = request.params;
      const articles = app.ctx.articlesFor(customerId, projectId);
      const article = articles.get(articleId);

      if (!article) {
        return reply.status(404).send({ error: "Article not found" });
      }

      if (article.status === "published") {
        return reply.status(400).send({ error: "Article already published" });
      }

      if (article.status !== "delivered") {
        return reply.status(400).send({
          error: `Article must be 'delivered' to publish (current: ${article.status})`,
        });
      }

      const project = app.ctx.projectsFor(customerId).get(projectId);
      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const connector = createSiteConnector(project);

      if (!connector.publish) {
        return reply.status(400).send({
          error: `Platform '${connector.platform}' does not need explicit publish (content is live on delivery)`,
        });
      }

      // Get the write ref (PR number, draft ID, etc.)
      const writeRef = (request.body as { ref?: string })?.ref;
      if (!writeRef) {
        return reply.status(400).send({ error: "Missing 'ref' in request body (e.g. PR number)" });
      }

      try {
        const result = await connector.publish(writeRef);

        if (!result.success) {
          return reply.status(500).send({ error: "Publish failed", detail: result.error });
        }

        // Update article
        articles.update(articleId, {
          status: "published",
          updatedAt: new Date().toISOString(),
        });

        // Update Content Index
        const versions = articles.getVersions(articleId);
        await updateContentIndex(app, customerId, projectId, article, versions, connector.platform, result.ref ?? writeRef);

        log.info({ articleId, platform: connector.platform, ref: result.ref }, "article published");

        return {
          message: "Article published",
          articleId,
          ref: result.ref,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error({ err: error, articleId }, "publish failed");
        return reply.status(500).send({ error: "Publish failed", detail: msg });
      }
    },
  );
}

/**
 * Update Content Index after publish — platform-agnostic.
 */
async function updateContentIndex(
  app: FastifyInstance,
  customerId: string,
  projectId: string,
  article: { id: string; topicId: string; translationKey: string },
  versions: Array<{ lang: string; slug: string; wordCount: number }>,
  platform: string,
  ref: string,
) {
  const indexStore = new ContentIndexStore(app.ctx.dataDir);
  const project = app.ctx.projectsFor(customerId).get(projectId);

  const contentPath = project?.connector.github?.contentPath
    ?? project?.connector.git?.contentPath
    ?? "src/content/posts";

  const langMetas: SiteContentLangMeta[] = versions.map((v) => ({
    lang: v.lang,
    slug: v.slug,
    title: "",
    description: "",
    wordCount: v.wordCount,
    filePath: `${contentPath}/${v.lang}/${v.slug}.md`,
    sha: ref,
  }));

  let index = await indexStore.load(customerId, projectId);
  let entry = indexStore.getByTranslationKey(index, article.translationKey);

  if (!entry) {
    entry = {
      id: crypto.randomUUID(),
      channel: "website",
      source: "flowboost",
      status: "live",
      site: {
        type: "blog",
        translationKey: article.translationKey,
        languages: langMetas,
      },
      articleId: article.id,
      topicId: article.topicId,
      createdAt: new Date().toISOString(),
      firstPublishedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      publications: [{
        platform,
        status: "published",
        ref,
        publishedAt: new Date().toISOString(),
        retryCount: 0,
      }],
    };
    index = indexStore.upsertEntry(index, entry);
  } else {
    index = indexStore.updateStatus(index, entry.id, "live");
    index = indexStore.addPublication(index, entry.id, {
      platform,
      status: "published",
      ref,
      publishedAt: new Date().toISOString(),
      retryCount: 0,
    });
  }

  await indexStore.save(customerId, projectId, index);

  await indexStore.addRevision(customerId, projectId, {
    id: crypto.randomUUID(),
    contentId: entry.id,
    version: 1,
    changes: [{ field: "status", oldValue: "delivered", newValue: "live" }],
    changedBy: "user",
    changedAt: new Date().toISOString(),
  });
}
