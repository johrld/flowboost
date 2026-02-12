import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { createSiteConnector } from "../../connectors/site/factory.js";
import { ContentIndexStore } from "../../models/content-index.js";
import type {
  ContentItem,
  ContentItemStatus,
  ContentType,
  SiteContentLangMeta,
} from "../../models/types.js";

const log = createLogger("api:content");

/** Allowed status transitions */
const TRANSITIONS: Record<string, ContentItemStatus[]> = {
  planned:   ["producing"],
  producing: ["draft"],
  draft:     ["review", "archived"],
  review:    ["approved", "draft"],   // approve or reject (→ draft)
  approved:  ["delivered"],
  delivered: ["published"],
  published: ["updating", "archived"],
  updating:  ["delivered", "published"],
  archived:  ["draft"],               // restore
};

function canTransition(from: ContentItemStatus, to: ContentItemStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export async function contentRoutes(app: FastifyInstance) {
  // GET /content — list with filters
  app.get<{
    Params: { customerId: string; projectId: string };
    Querystring: {
      type?: ContentType;
      status?: ContentItemStatus;
      category?: string;
      lang?: string;
    };
  }>("/", async (request) => {
    const { customerId, projectId } = request.params;
    const { type, status, category } = request.query;
    const content = app.ctx.contentFor(customerId, projectId);

    let items = content.list();
    if (type) items = items.filter((c) => c.type === type);
    if (status) items = items.filter((c) => c.status === status);
    if (category) items = items.filter((c) => c.category === category);

    return { total: items.length, items };
  });

  // POST /content — create
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: {
      type: ContentType;
      title: string;
      description?: string;
      category?: string;
      tags?: string[];
      keywords?: string[];
      topicId?: string;
      translationKey?: string;
      parentId?: string;
    };
  }>("/", async (request) => {
    const { customerId, projectId } = request.params;
    const body = request.body as ContentItem;
    const content = app.ctx.contentFor(customerId, projectId);

    const now = new Date().toISOString();
    const item = content.create({
      customerId,
      projectId,
      type: body.type ?? "article",
      status: "planned",
      title: body.title ?? "",
      description: body.description,
      category: body.category,
      tags: body.tags,
      keywords: body.keywords,
      topicId: body.topicId,
      translationKey: body.translationKey,
      parentId: body.parentId,
      createdAt: now,
      updatedAt: now,
    });

    log.info({ contentId: item.id, type: item.type }, "content created");
    return item;
  });

  // GET /content/:contentId
  app.get<{
    Params: { customerId: string; projectId: string; contentId: string };
  }>("/:contentId", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    const versions = content.getVersions(contentId);
    return { ...item, versions };
  });

  // PUT /content/:contentId — update metadata
  app.put<{
    Params: { customerId: string; projectId: string; contentId: string };
    Body: Partial<Pick<ContentItem,
      "title" | "description" | "category" | "tags" | "keywords" | "translationKey"
    >>;
  }>("/:contentId", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const body = request.body as Partial<ContentItem>;
    const content = app.ctx.contentFor(customerId, projectId);

    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    const updated = content.update(contentId, {
      ...body,
      updatedAt: new Date().toISOString(),
    });

    return updated;
  });

  // DELETE /content/:contentId — archive or hard delete
  app.delete<{
    Params: { customerId: string; projectId: string; contentId: string };
    Querystring: { hard?: string };
  }>("/:contentId", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const hard = request.query.hard === "true";
    const content = app.ctx.contentFor(customerId, projectId);

    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (hard) {
      content.delete(contentId);
      log.info({ contentId }, "content hard deleted");
      return { message: "Content deleted", contentId };
    }

    // Soft delete = archive
    if (item.status === "archived") {
      return reply.status(400).send({ error: "Content already archived" });
    }

    content.update(contentId, {
      status: "archived",
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    log.info({ contentId }, "content archived");
    return { message: "Content archived", contentId };
  });

  // ─── Lifecycle Transitions ──────────────────────────────────────

  // POST /content/:contentId/submit — draft → review
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
  }>("/:contentId/submit", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (!canTransition(item.status, "review")) {
      return reply.status(400).send({
        error: `Cannot submit from '${item.status}' (must be 'draft')`,
      });
    }

    content.update(contentId, { status: "review", updatedAt: new Date().toISOString() });
    return { message: "Content submitted for review", contentId, status: "review" };
  });

  // POST /content/:contentId/approve — review → approved → deliver
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
  }>("/:contentId/approve", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (!canTransition(item.status, "approved")) {
      return reply.status(400).send({
        error: `Cannot approve from '${item.status}' (must be 'review')`,
      });
    }

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    // Mark approved
    content.update(contentId, {
      status: "approved",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Only deliver site content types automatically
    if (item.type === "article" || item.type === "guide" || item.type === "landing_page") {
      const latestVersion = content.getLatestVersion(contentId);
      if (!latestVersion) {
        return reply.status(400).send({ error: "No content versions found" });
      }

      const versionDir = content.getVersionDir(contentId, latestVersion.id);
      const connector = createSiteConnector(project);

      // Build ArticleVersion-compatible objects for SiteConnector
      const articleVersions = latestVersion.languages.map((lang) => ({
        id: latestVersion.id,
        articleId: contentId,
        lang: lang.lang,
        slug: lang.slug,
        wordCount: lang.wordCount ?? 0,
        contentPath: lang.contentPath,
        createdAt: latestVersion.createdAt,
      }));

      const result = await connector.write(
        project,
        { ...item, topicId: item.topicId ?? "", translationKey: item.translationKey ?? "" } as import("../../models/types.js").Article,
        articleVersions,
        versionDir,
      );

      if (!result.success) {
        log.error({ contentId, error: result.error }, "delivery failed");
        return reply.status(500).send({ error: "Delivery failed", detail: result.error });
      }

      const newStatus = result.published ? "published" : "delivered";
      const now = new Date().toISOString();
      content.update(contentId, {
        status: newStatus,
        deliveryRef: result.ref,
        deliveryUrl: result.url,
        deliveredAt: now,
        ...(result.published ? { publishedAt: now } : {}),
        currentVersionId: latestVersion.id,
        ...(result.published ? { lastPublishedVersionId: latestVersion.id } : {}),
        updatedAt: now,
      });

      // Update Content Index
      if (result.published) {
        await updateContentIndex(app, customerId, projectId, item, latestVersion, connector.platform, result.ref);
      }

      log.info({ contentId, platform: connector.platform, published: result.published }, "content delivered");
      return {
        message: result.published ? "Content approved and published" : "Content delivered — publish when ready",
        contentId,
        published: result.published,
        ref: result.ref,
        url: result.url,
      };
    }

    return { message: "Content approved", contentId, status: "approved" };
  });

  // POST /content/:contentId/reject — review → draft (with feedback)
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
    Body: { reason?: string };
  }>("/:contentId/reject", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const body = request.body as { reason?: string };
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (!canTransition(item.status, "draft") || item.status !== "review") {
      return reply.status(400).send({
        error: `Cannot reject from '${item.status}' (must be 'review')`,
      });
    }

    content.update(contentId, { status: "draft", updatedAt: new Date().toISOString() });
    log.info({ contentId, reason: body.reason }, "content rejected");
    return { message: "Content rejected — returned to draft", contentId, status: "draft", reason: body.reason };
  });

  // POST /content/:contentId/publish — delivered → published
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
    Body: { ref?: string };
  }>("/:contentId/publish", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const body = request.body as { ref?: string };
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (!canTransition(item.status, "published")) {
      return reply.status(400).send({
        error: `Cannot publish from '${item.status}' (must be 'delivered')`,
      });
    }

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const connector = createSiteConnector(project);
    if (!connector.publish) {
      // Platform publishes on write — just update status
      const now = new Date().toISOString();
      content.update(contentId, {
        status: "published",
        publishedAt: now,
        lastPublishedVersionId: item.currentVersionId,
        updatedAt: now,
      });
      return { message: "Content published", contentId };
    }

    const writeRef = body.ref ?? item.deliveryRef;
    if (!writeRef) {
      return reply.status(400).send({ error: "Missing 'ref' (PR number, draft ID, etc.)" });
    }

    const result = await connector.publish(writeRef);
    if (!result.success) {
      return reply.status(500).send({ error: "Publish failed", detail: result.error });
    }

    const now = new Date().toISOString();
    content.update(contentId, {
      status: "published",
      publishedAt: now,
      lastPublishedVersionId: item.currentVersionId,
      updatedAt: now,
    });

    // Update Content Index
    const latestVersion = content.getLatestVersion(contentId);
    if (latestVersion) {
      await updateContentIndex(app, customerId, projectId, item, latestVersion, connector.platform, result.ref ?? writeRef);
    }

    log.info({ contentId, platform: connector.platform }, "content published");
    return { message: "Content published", contentId, ref: result.ref };
  });

  // POST /content/:contentId/update — published → updating → re-deliver
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
  }>("/:contentId/update", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (!canTransition(item.status, "updating")) {
      return reply.status(400).send({
        error: `Cannot update from '${item.status}' (must be 'published')`,
      });
    }

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const latestVersion = content.getLatestVersion(contentId);
    if (!latestVersion) {
      return reply.status(400).send({ error: "No content versions found" });
    }

    content.update(contentId, { status: "updating", updatedAt: new Date().toISOString() });

    const connector = createSiteConnector(project);
    const versionDir = content.getVersionDir(contentId, latestVersion.id);
    const articleVersions = latestVersion.languages.map((lang) => ({
      id: latestVersion.id,
      articleId: contentId,
      lang: lang.lang,
      slug: lang.slug,
      wordCount: lang.wordCount ?? 0,
      contentPath: lang.contentPath,
      createdAt: latestVersion.createdAt,
    }));

    // Use update() if available, otherwise fallback to write()
    const result = connector.update
      ? await connector.update(
          project,
          { ...item, topicId: item.topicId ?? "", translationKey: item.translationKey ?? "" } as import("../../models/types.js").Article,
          articleVersions,
          versionDir,
          item.deliveryRef,
        )
      : await connector.write(
          project,
          { ...item, topicId: item.topicId ?? "", translationKey: item.translationKey ?? "" } as import("../../models/types.js").Article,
          articleVersions,
          versionDir,
        );

    if (!result.success) {
      content.update(contentId, { status: "published", updatedAt: new Date().toISOString() });
      return reply.status(500).send({ error: "Update delivery failed", detail: result.error });
    }

    const newStatus = result.published ? "published" : "delivered";
    const now = new Date().toISOString();
    content.update(contentId, {
      status: newStatus,
      deliveryRef: result.ref,
      deliveryUrl: result.url,
      currentVersionId: latestVersion.id,
      ...(result.published ? { publishedAt: now, lastPublishedVersionId: latestVersion.id } : {}),
      updatedAt: now,
    });

    log.info({ contentId, platform: connector.platform }, "content update delivered");
    return {
      message: result.published ? "Content updated and published" : "Content update delivered",
      contentId,
      published: result.published,
      ref: result.ref,
    };
  });

  // POST /content/:contentId/archive — published → archived (unpublish)
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
  }>("/:contentId/archive", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (!canTransition(item.status, "archived")) {
      return reply.status(400).send({
        error: `Cannot archive from '${item.status}'`,
      });
    }

    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    // Unpublish from platform if connector supports it
    if (item.deliveryRef) {
      try {
        const connector = createSiteConnector(project);
        if (connector.unpublish) {
          await connector.unpublish(item.deliveryRef);
        }
      } catch (err) {
        log.warn({ err, contentId }, "unpublish failed (archiving anyway)");
      }
    }

    const now = new Date().toISOString();
    content.update(contentId, {
      status: "archived",
      archivedAt: now,
      updatedAt: now,
    });

    log.info({ contentId }, "content archived");
    return { message: "Content archived", contentId, status: "archived" };
  });

  // POST /content/:contentId/restore — archived → draft
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
  }>("/:contentId/restore", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (item.status !== "archived") {
      return reply.status(400).send({
        error: `Cannot restore from '${item.status}' (must be 'archived')`,
      });
    }

    content.update(contentId, {
      status: "draft",
      archivedAt: undefined,
      updatedAt: new Date().toISOString(),
    });

    return { message: "Content restored to draft", contentId, status: "draft" };
  });

  // ─── Versions ───────────────────────────────────────────────────

  // GET /content/:contentId/versions
  app.get<{
    Params: { customerId: string; projectId: string; contentId: string };
  }>("/:contentId/versions", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    return content.getVersions(contentId);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────

async function updateContentIndex(
  app: FastifyInstance,
  customerId: string,
  projectId: string,
  item: ContentItem,
  version: import("../../models/types.js").ContentVersion,
  platform: string,
  ref: string,
) {
  const indexStore = new ContentIndexStore(app.ctx.dataDir);
  const project = app.ctx.projectsFor(customerId).get(projectId);

  const contentPath = project?.connector.github?.contentPath
    ?? project?.connector.git?.contentPath
    ?? "src/content/posts";

  const langMetas: SiteContentLangMeta[] = version.languages.map((v) => ({
    lang: v.lang,
    slug: v.slug,
    title: v.title,
    description: v.description,
    wordCount: v.wordCount ?? 0,
    filePath: `${contentPath}/${v.lang}/${v.slug}.md`,
    sha: ref,
  }));

  let index = await indexStore.load(customerId, projectId);
  const translationKey = item.translationKey ?? item.id;
  let entry = indexStore.getByTranslationKey(index, translationKey);

  if (!entry) {
    entry = {
      id: crypto.randomUUID(),
      channel: "website",
      source: "flowboost",
      status: "live",
      site: {
        type: item.type === "guide" ? "guide" : item.type === "landing_page" ? "landing" : "blog",
        translationKey,
        languages: langMetas,
      },
      articleId: item.id,
      topicId: item.topicId,
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
}
