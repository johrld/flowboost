import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { createSiteConnector } from "../../connectors/site/factory.js";
import { ContentIndexStore } from "../../models/content-index.js";
import sharp from "sharp";
import type {
  ContentItem,
  ContentItemStatus,
  ContentMediaAsset,
  ContentType,
  LanguageVariant,
  SiteContentLangMeta,
} from "../../models/types.js";
import { generateImageBuffer } from "../../services/imagen.js";

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
      "title" | "description" | "category" | "tags" | "keywords" | "author" | "translationKey" | "heroImageId" | "scheduledDate"
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

      // Stage hero image into version assets for delivery
      const freshItem = content.get(contentId)!;
      if (freshItem.heroImageId) {
        const contentMedia = app.ctx.contentMediaFor(customerId, projectId, contentId);
        stageHeroImageForDelivery(contentMedia, freshItem.heroImageId, versionDir, latestVersion.languages);
      }

      const result = await connector.write(
        project,
        freshItem,
        latestVersion.languages,
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

      // Mark version as published
      if (result.published) {
        content.updateVersion(contentId, latestVersion.id, { publishedAt: now });
      }

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
      if (item.currentVersionId) {
        content.updateVersion(contentId, item.currentVersionId, { publishedAt: now });
      }
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
    if (item.currentVersionId) {
      content.updateVersion(contentId, item.currentVersionId, { publishedAt: now });
    }

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

    // Use update() if available, otherwise fallback to write()
    const result = connector.update
      ? await connector.update(
          project,
          item,
          latestVersion.languages,
          versionDir,
          item.deliveryRef,
        )
      : await connector.write(
          project,
          item,
          latestVersion.languages,
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
    if (result.published) {
      content.updateVersion(contentId, latestVersion.id, { publishedAt: now });
    }

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

  // GET /content/:contentId/versions/:versionId/file?lang=de
  app.get<{
    Params: { customerId: string; projectId: string; contentId: string; versionId: string };
    Querystring: { lang?: string };
  }>("/:contentId/versions/:versionId/file", async (request, reply) => {
    const { customerId, projectId, contentId, versionId } = request.params;
    const lang = request.query.lang;
    const content = app.ctx.contentFor(customerId, projectId);

    const version = content.getVersion(contentId, versionId);
    if (!version) return reply.status(404).send({ error: "Version not found" });

    const langVariant = lang
      ? version.languages.find((l) => l.lang === lang)
      : version.languages[0];
    if (!langVariant) return reply.status(404).send({ error: `Language '${lang}' not found in version` });

    const versionDir = content.getVersionDir(contentId, versionId);
    const filePath = path.join(versionDir, langVariant.contentPath);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: "Content file not found on disk" });
    }

    const markdown = fs.readFileSync(filePath, "utf-8");
    return reply.type("text/markdown; charset=utf-8").send(markdown);
  });

  // POST /content/:contentId/versions — create new version from editor
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
    Body: { files: Record<string, string>; createdBy?: "pipeline" | "user" | "sync"; createdByName?: string };
  }>("/:contentId/versions", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const { files, createdBy = "user", createdByName } = request.body as {
      files: Record<string, string>;
      createdBy?: "pipeline" | "user" | "sync";
      createdByName?: string;
    };
    const content = app.ctx.contentFor(customerId, projectId);

    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (!files || Object.keys(files).length === 0) {
      return reply.status(400).send({ error: "At least one file is required" });
    }

    // Parse each language file
    const languages: LanguageVariant[] = [];
    let totalWordCount = 0;
    let totalHeadingCount = 0;
    let hasFaq = false;
    let hasAnswerCapsule = false;

    for (const [lang, markdown] of Object.entries(files)) {
      const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
      const fm = fmMatch?.[1] ?? "";
      const body = markdown.replace(/^---\n[\s\S]*?\n---\n*/, "");

      // Extract metadata from frontmatter
      const titleMatch = fm.match(/^title:\s*"(.+?)"\s*$/m);
      const descMatch = fm.match(/^description:\s*"(.+?)"\s*$/m);
      const title = titleMatch?.[1] ?? item.title;
      const description = descMatch?.[1] ?? item.description ?? "";

      // Slug: from frontmatter, or from existing version, or from translationKey/id
      const existingVersion = content.getLatestVersion(contentId);
      const existingLang = existingVersion?.languages.find((l) => l.lang === lang);
      const slug = existingLang?.slug ?? item.translationKey ?? item.id;

      // Calculate metrics
      const words = body.split(/\s+/).filter(Boolean).length;
      const headings = (body.match(/^##\s+/gm) ?? []).length;
      totalWordCount += words;
      totalHeadingCount += headings;
      if (fm.includes("faq:")) hasFaq = true;
      if (body.trimStart().startsWith(">")) hasAnswerCapsule = true;

      const contentPath = `content/${lang}/${slug}.md`;
      languages.push({ lang, slug, title, description, contentPath, wordCount: words });
    }

    // Create version
    const version = content.createVersion(contentId, {
      contentId,
      languages,
      assets: [],
      text: {
        wordCount: totalWordCount,
        headingCount: totalHeadingCount,
        hasFaq,
        hasAnswerCapsule,
      },
      createdAt: new Date().toISOString(),
      createdBy,
      ...(createdByName ? { createdByName } : {}),
    });

    // Write markdown files to version directory
    const versionDir = content.getVersionDir(contentId, version.id);
    for (const [lang] of Object.entries(files)) {
      const langVariant = languages.find((l) => l.lang === lang)!;
      const filePath = path.join(versionDir, langVariant.contentPath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, files[lang]);
    }

    // Update currentVersionId + auto-transition to draft
    const updates: Record<string, unknown> = {
      currentVersionId: version.id,
      updatedAt: new Date().toISOString(),
    };
    if (item.status === "planned" || item.status === "producing") {
      updates.status = "draft";
    }
    content.update(contentId, updates as Partial<ContentItem>);

    log.info(
      { contentId, versionId: version.id, versionNumber: version.versionNumber, langs: languages.map((l) => l.lang) },
      "version created",
    );
    return version;
  });

  // ─── Content Media ─────────────────────────────────────────────

  // GET /content/:contentId/media — list media assets
  app.get<{
    Params: { customerId: string; projectId: string; contentId: string };
  }>("/:contentId/media", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    if (!content.get(contentId)) return reply.status(404).send({ error: "Content not found" });

    const mediaStore = app.ctx.contentMediaFor(customerId, projectId, contentId);
    let assets = mediaStore.list();

    // Lazy migration: if no media.json exists, scan version directories for hero images
    if (assets.length === 0) {
      assets = migrateExistingHeroImages(content, mediaStore, contentId);
      if (assets.length > 0) {
        // Auto-set first as heroImageId
        const item = content.get(contentId)!;
        if (!item.heroImageId) {
          content.update(contentId, { heroImageId: assets[0].id });
        }
      }
    }

    return { total: assets.length, assets };
  });

  // GET /content/:contentId/media/:assetId/file — serve image file
  app.get<{
    Params: { customerId: string; projectId: string; contentId: string; assetId: string };
  }>("/:contentId/media/:assetId/file", async (request, reply) => {
    const { customerId, projectId, contentId, assetId } = request.params;
    const mediaStore = app.ctx.contentMediaFor(customerId, projectId, contentId);
    const asset = mediaStore.get(assetId);
    if (!asset) return reply.status(404).send({ error: "Media asset not found" });

    const filePath = mediaStore.filePath(asset);
    if (!fs.existsSync(filePath)) return reply.status(404).send({ error: "File not found on disk" });

    const stream = fs.createReadStream(filePath);
    return reply
      .type(asset.mimeType)
      .header("Cache-Control", "public, max-age=86400")
      .send(stream);
  });

  // POST /content/:contentId/media/generate — generate hero image via Imagen
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
    Body: { prompt: string; aspectRatio?: "16:9" | "1:1" | "9:16" | "4:3" | "3:4"; role?: "hero" | "inline" };
  }>("/:contentId/media/generate", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const { prompt, aspectRatio, role: reqRole } = request.body as { prompt: string; aspectRatio?: "16:9" | "1:1" | "9:16" | "4:3" | "3:4"; role?: "hero" | "inline" };
    if (!prompt) return reply.status(400).send({ error: "prompt is required" });
    const role = reqRole === "inline" ? "inline" : "hero";

    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    const buffer = await generateImageBuffer(prompt, { aspectRatio });
    const meta = await sharp(buffer).metadata();

    const id = crypto.randomUUID();
    const fileName = `${id}.png`;
    const seoFilename = buildSeoFilename(item, role);

    const asset: ContentMediaAsset = {
      id,
      contentId,
      type: "image",
      source: "generated",
      role,
      mimeType: "image/png",
      fileName,
      seoFilename,
      fileSize: buffer.length,
      width: meta.width,
      height: meta.height,
      generationPrompt: prompt,
      generationModel: process.env.IMAGEN_MODEL ?? "imagen-4.0-fast-generate-001",
      generationCostUsd: 0.02,
      createdAt: new Date().toISOString(),
    };

    const mediaStore = app.ctx.contentMediaFor(customerId, projectId, contentId);
    mediaStore.add(asset, buffer);

    // Auto-set as hero if none set (only for hero role)
    if (role === "hero" && !item.heroImageId) {
      content.update(contentId, { heroImageId: id, updatedAt: new Date().toISOString() });
    }

    log.info({ contentId, assetId: id, role }, "image generated");
    return asset;
  });

  // POST /content/:contentId/media/upload — upload custom image
  app.post<{
    Params: { customerId: string; projectId: string; contentId: string };
  }>("/:contentId/media/upload", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    const parts = request.parts();
    let fileBuffer: Buffer | null = null;
    let filename = "upload.png";
    let mimetype = "image/png";
    let role: "hero" | "inline" = "hero";

    for await (const part of parts) {
      if (part.type === "file") {
        fileBuffer = await part.toBuffer();
        filename = part.filename;
        mimetype = part.mimetype;
      } else if (part.fieldname === "role") {
        role = (part.value as string) === "inline" ? "inline" : "hero";
      }
    }

    if (!fileBuffer) return reply.status(400).send({ error: "No file uploaded" });

    const meta = await sharp(fileBuffer).metadata();
    const ext = filename.split(".").pop() ?? "png";

    const id = crypto.randomUUID();
    const fileName = `${id}.${ext}`;
    const seoFilename = buildSeoFilename(item, role);

    const asset: ContentMediaAsset = {
      id,
      contentId,
      type: "image",
      source: "uploaded",
      role,
      mimeType: mimetype,
      fileName,
      seoFilename,
      fileSize: fileBuffer.length,
      width: meta.width,
      height: meta.height,
      createdAt: new Date().toISOString(),
    };

    const mediaStore = app.ctx.contentMediaFor(customerId, projectId, contentId);
    mediaStore.add(asset, fileBuffer);

    // Auto-set as hero if none set (only for hero role)
    if (role === "hero" && !item.heroImageId) {
      content.update(contentId, { heroImageId: id, updatedAt: new Date().toISOString() });
    }

    log.info({ contentId, assetId: id, role }, "image uploaded");
    return asset;
  });

  // PUT /content/:contentId/hero — select hero image
  app.put<{
    Params: { customerId: string; projectId: string; contentId: string };
    Body: { assetId: string | null };
  }>("/:contentId/hero", async (request, reply) => {
    const { customerId, projectId, contentId } = request.params;
    const { assetId } = request.body as { assetId: string | null };
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    if (assetId) {
      const mediaStore = app.ctx.contentMediaFor(customerId, projectId, contentId);
      if (!mediaStore.get(assetId)) {
        return reply.status(404).send({ error: "Media asset not found" });
      }
    }

    content.update(contentId, {
      heroImageId: assetId ?? undefined,
      updatedAt: new Date().toISOString(),
    });

    return { contentId, heroImageId: assetId };
  });

  // DELETE /content/:contentId/media/:assetId — delete asset
  app.delete<{
    Params: { customerId: string; projectId: string; contentId: string; assetId: string };
  }>("/:contentId/media/:assetId", async (request, reply) => {
    const { customerId, projectId, contentId, assetId } = request.params;
    const content = app.ctx.contentFor(customerId, projectId);
    const item = content.get(contentId);
    if (!item) return reply.status(404).send({ error: "Content not found" });

    const mediaStore = app.ctx.contentMediaFor(customerId, projectId, contentId);
    if (!mediaStore.delete(assetId)) {
      return reply.status(404).send({ error: "Media asset not found" });
    }

    // Clear heroImageId if it was the hero
    if (item.heroImageId === assetId) {
      content.update(contentId, { heroImageId: undefined, updatedAt: new Date().toISOString() });
    }

    log.info({ contentId, assetId }, "media asset deleted");
    return { message: "Asset deleted", assetId };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Build SEO-friendly filename from content item metadata */
function buildSeoFilename(item: ContentItem, role: string): string {
  const base = (item.translationKey ?? item.title ?? item.id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base}-${role}`;
}

/** Lazy migration: discover hero images from existing version directories */
function migrateExistingHeroImages(
  content: import("../../models/content.js").ContentStore,
  mediaStore: import("../../models/content-media.js").ContentMediaStore,
  contentId: string,
): ContentMediaAsset[] {
  const versions = content.getVersions(contentId);
  const migrated: ContentMediaAsset[] = [];

  for (const version of versions) {
    const versionDir = content.getVersionDir(contentId, version.id);
    const assetsDir = path.join(versionDir, "assets");
    if (!fs.existsSync(assetsDir)) continue;

    // Scan assets/{lang}/*-hero.png
    const langDirs = fs.readdirSync(assetsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const langDir of langDirs) {
      const langAssetsPath = path.join(assetsDir, langDir.name);
      const files = fs.readdirSync(langAssetsPath).filter((f) => f.includes("-hero") && f.endsWith(".png"));
      for (const file of files) {
        const filePath = path.join(langAssetsPath, file);
        const buffer = fs.readFileSync(filePath);
        const id = crypto.randomUUID();
        const fileName = `${id}.png`;
        const seoFilename = file.replace(/\.png$/, "");

        const asset: ContentMediaAsset = {
          id,
          contentId,
          type: "image",
          source: "generated",
          role: "hero",
          mimeType: "image/png",
          fileName,
          seoFilename,
          fileSize: buffer.length,
          createdAt: version.createdAt,
        };

        mediaStore.add(asset, buffer);
        migrated.push(asset);
        // Only migrate first found hero image
        return migrated;
      }
    }
  }

  return migrated;
}

/** Stage hero image into version assets directory before delivery */
export function stageHeroImageForDelivery(
  contentMediaStore: import("../../models/content-media.js").ContentMediaStore,
  heroImageId: string,
  versionDir: string,
  languages: LanguageVariant[],
): void {
  const asset = contentMediaStore.get(heroImageId);
  if (!asset) return;

  const srcPath = contentMediaStore.filePath(asset);
  if (!fs.existsSync(srcPath)) return;

  const ext = asset.fileName.split(".").pop() ?? "png";
  for (const lang of languages) {
    const destDir = path.join(versionDir, "assets", lang.lang);
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, `${asset.seoFilename}.${ext}`);
    fs.copyFileSync(srcPath, destPath);
  }
}

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
