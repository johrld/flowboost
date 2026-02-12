import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { ContentIndexStore } from "../../models/content-index.js";
import { SyncService } from "../../services/sync.js";
import { createSiteConnector } from "../../connectors/site/factory.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";
import type { ContentStatus } from "../../models/types.js";

const log = createLogger("api:content-index");

export async function contentIndexRoutes(app: FastifyInstance) {
  const indexStore = new ContentIndexStore(app.ctx.dataDir);
  const syncService = new SyncService(indexStore, parseFrontmatter);

  // GET /customers/:customerId/projects/:projectId/content-index
  app.get<{
    Params: { customerId: string; projectId: string };
    Querystring: {
      channel?: "website" | "social";
      status?: ContentStatus;
      source?: "flowboost" | "external";
      lang?: string;
      platform?: string;
    };
  }>("/", async (request) => {
    const { customerId, projectId } = request.params;
    const { channel, status, source, lang, platform } = request.query;

    const index = await indexStore.load(customerId, projectId);
    let entries = index.entries;

    if (channel) {
      entries = entries.filter((e) => e.channel === channel);
    }
    if (status) {
      entries = entries.filter((e) => e.status === status);
    }
    if (source) {
      entries = entries.filter((e) => e.source === source);
    }
    if (lang) {
      entries = entries.filter((e) =>
        e.site?.languages.some((l) => l.lang === lang),
      );
    }
    if (platform) {
      entries = entries.filter((e) =>
        e.publications.some((p) => p.platform === platform),
      );
    }

    return {
      projectId,
      lastSyncedAt: index.lastSyncedAt,
      total: entries.length,
      entries,
    };
  });

  // POST /customers/:customerId/projects/:projectId/content-index/sync
  app.post<{
    Params: { customerId: string; projectId: string };
  }>("/sync", async (request, reply) => {
    const { customerId, projectId } = request.params;

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    let connector;
    try {
      connector = createSiteConnector(project);
    } catch {
      return reply.status(400).send({
        error: "Project has no supported connector configured for sync",
      });
    }

    let reader;
    try {
      reader = connector.createReader();
    } catch {
      return reply.status(400).send({
        error: `Platform '${connector.platform}' does not support reading (e.g. filesystem)`,
      });
    }

    const result = await syncService.fullSync(customerId, projectId, reader);

    log.info(
      { customerId, projectId, ...result },
      "manual sync triggered",
    );

    return result;
  });

  // GET /customers/:customerId/projects/:projectId/content-index/:entryId
  app.get<{
    Params: { customerId: string; projectId: string; entryId: string };
    Querystring: { includeRevisions?: string };
  }>("/:entryId", async (request, reply) => {
    const { customerId, projectId, entryId } = request.params;
    const includeRevisions = request.query.includeRevisions === "true";

    const index = await indexStore.load(customerId, projectId);
    const entry = indexStore.getById(index, entryId);

    if (!entry) {
      return reply.status(404).send({ error: "Content entry not found" });
    }

    if (includeRevisions) {
      const revisions = await indexStore.getRevisions(
        customerId,
        projectId,
        entryId,
      );
      return { ...entry, revisions };
    }

    return entry;
  });

  // PATCH /customers/:customerId/projects/:projectId/content-index/:entryId
  app.patch<{
    Params: { customerId: string; projectId: string; entryId: string };
    Body: { status?: ContentStatus };
  }>("/:entryId", async (request, reply) => {
    const { customerId, projectId, entryId } = request.params;
    const body = request.body as { status?: ContentStatus };

    let index = await indexStore.load(customerId, projectId);
    const entry = indexStore.getById(index, entryId);

    if (!entry) {
      return reply.status(404).send({ error: "Content entry not found" });
    }

    if (body.status && body.status !== entry.status) {
      const oldStatus = entry.status;
      index = indexStore.updateStatus(index, entryId, body.status);
      await indexStore.save(customerId, projectId, index);

      await indexStore.addRevision(customerId, projectId, {
        id: crypto.randomUUID(),
        contentId: entryId,
        version: 1,
        changes: [{ field: "status", oldValue: oldStatus, newValue: body.status }],
        changedBy: "user",
        changedAt: new Date().toISOString(),
      });

      log.info({ entryId, oldStatus, newStatus: body.status }, "content index entry updated");
    }

    return indexStore.getById(
      await indexStore.load(customerId, projectId),
      entryId,
    );
  });

  // DELETE /customers/:customerId/projects/:projectId/content-index/:entryId
  app.delete<{
    Params: { customerId: string; projectId: string; entryId: string };
  }>("/:entryId", async (request, reply) => {
    const { customerId, projectId, entryId } = request.params;

    let index = await indexStore.load(customerId, projectId);
    const entry = indexStore.getById(index, entryId);

    if (!entry) {
      return reply.status(404).send({ error: "Content entry not found" });
    }

    index = indexStore.removeEntry(index, entryId);
    await indexStore.save(customerId, projectId, index);

    log.info({ entryId }, "content index entry deleted");
    return { message: "Entry removed", entryId };
  });

  // GET /customers/:customerId/projects/:projectId/content-index/:entryId/revisions
  app.get<{
    Params: { customerId: string; projectId: string; entryId: string };
  }>("/:entryId/revisions", async (request) => {
    const { customerId, projectId, entryId } = request.params;
    return indexStore.getRevisions(customerId, projectId, entryId);
  });
}
