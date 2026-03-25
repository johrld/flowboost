import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { MediaService } from "../../services/media.js";
import type { MediaType, MediaSource, MediaFilter } from "../../models/types.js";

const log = createLogger("api:media");

export async function mediaRoutes(app: FastifyInstance) {
  // GET /media/tags — all tags with count
  app.get<{
    Params: { customerId: string; projectId: string };
  }>("/tags", async (request) => {
    const { customerId, projectId } = request.params;
    const store = app.ctx.mediaFor(customerId, projectId);

    const assets = store.list();
    const tagMap = new Map<string, number>();
    for (const asset of assets) {
      for (const tag of asset.tags ?? []) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      }
    }

    const tags = Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { tags };
  });

  // GET /media — list assets with filters (erweitert)
  app.get<{
    Params: { customerId: string; projectId: string };
    Querystring: {
      type?: MediaType;
      source?: MediaSource;
      tags?: string;
      search?: string;
      unused?: string;
      page?: string;
      limit?: string;
    };
  }>("/", async (request) => {
    const { customerId, projectId } = request.params;
    const { type, source, tags, search, unused, page, limit } = request.query;
    const store = app.ctx.mediaFor(customerId, projectId);

    const filter: MediaFilter = {
      type,
      source,
      tags: tags ? tags.split(",").map((t) => t.trim()) : undefined,
      search,
      unused: unused === "true" ? true : unused === "false" ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    // Filtern auf Basis der vorhandenen Store-Methoden
    let assets = store.list();

    if (filter.type) {
      assets = assets.filter((a) => a.type === filter.type);
    }
    if (filter.source) {
      assets = assets.filter((a) => a.source === filter.source);
    }
    if (filter.tags && filter.tags.length > 0) {
      assets = assets.filter((a) =>
        filter.tags!.every((t) => (a.tags ?? []).includes(t))
      );
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      assets = assets.filter(
        (a) =>
          a.fileName.toLowerCase().includes(q) ||
          (a.title ?? "").toLowerCase().includes(q) ||
          (a.description ?? "").toLowerCase().includes(q) ||
          (a.altText ?? "").toLowerCase().includes(q)
      );
    }
    if (filter.unused === true) {
      assets = assets.filter((a) => (a.usedBy ?? []).length === 0);
    } else if (filter.unused === false) {
      assets = assets.filter((a) => (a.usedBy ?? []).length > 0);
    }

    const total = assets.length;
    const pageNum = filter.page ?? 1;
    const pageSize = filter.limit ?? 50;
    const offset = (pageNum - 1) * pageSize;
    const paged = assets.slice(offset, offset + pageSize);

    return {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      assets: paged,
    };
  });

  // POST /media/upload — multipart file upload (erweitert)
  app.post<{
    Params: { customerId: string; projectId: string };
  }>("/upload", async (request, reply) => {
    const { customerId, projectId } = request.params;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const buffer = await data.toBuffer();
    const store = app.ctx.mediaFor(customerId, projectId);
    const service = new MediaService(store);

    // Zusaetzliche Multipart-Fields auslesen
    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const title = fields.title?.value;
    const description = fields.description?.value;
    const altText = fields.altText?.value;
    let tags: string[] | undefined;
    if (fields.tags?.value) {
      try {
        tags = JSON.parse(fields.tags.value);
      } catch {
        return reply.status(400).send({ error: "tags must be a valid JSON array" });
      }
    }

    const result = await service.ingest({
      customerId,
      projectId,
      fileName: data.filename,
      mimeType: data.mimetype,
      buffer,
      altText,
    });

    // Metadaten nachtraeglich setzen (title, description, tags)
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (tags !== undefined) updates.tags = tags;
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      store.update(result.asset.id, updates);
    }

    log.info({ assetId: result.asset.id, fileName: data.filename }, "file uploaded");

    return {
      asset: store.get(result.asset.id) ?? result.asset,
      thumbnailGenerated: result.thumbnailGenerated,
    };
  });

  // POST /media/bulk/upload — Multi-File Upload
  app.post<{
    Params: { customerId: string; projectId: string };
  }>("/bulk/upload", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const store = app.ctx.mediaFor(customerId, projectId);
    const service = new MediaService(store);

    const results: Array<{ fileName: string; asset?: unknown; error?: string }> = [];
    let succeeded = 0;
    let failed = 0;
    let metadata: { tags?: string[]; title_prefix?: string; description?: string } = {};

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === "field") {
        if (part.fieldname === "metadata" && typeof part.value === "string") {
          try {
            metadata = JSON.parse(part.value);
          } catch {
            return reply.status(400).send({ error: "metadata must be valid JSON" });
          }
        }
        continue;
      }

      // part.type === "file"
      try {
        const buffer = await part.toBuffer();
        const result = await service.ingest({
          customerId,
          projectId,
          fileName: part.filename,
          mimeType: part.mimetype,
          buffer,
        });

        // Metadata anwenden
        const updates: Record<string, unknown> = {};
        if (metadata.tags) updates.tags = metadata.tags;
        if (metadata.title_prefix) updates.title = `${metadata.title_prefix} ${part.filename}`;
        if (metadata.description) updates.description = metadata.description;
        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date().toISOString();
          store.update(result.asset.id, updates);
        }

        results.push({ fileName: part.filename, asset: store.get(result.asset.id) ?? result.asset });
        succeeded++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ fileName: part.filename, error: message });
        failed++;
        log.warn({ err, fileName: part.filename }, "bulk upload: file failed");
      }
    }

    log.info({ total: succeeded + failed, succeeded, failed }, "bulk upload completed");
    return { total: succeeded + failed, succeeded, failed, results };
  });

  // POST /media/bulk/update — Bulk Tag Update
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { assetIds: string[]; addTags?: string[]; removeTags?: string[] };
  }>("/bulk/update", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { assetIds, addTags, removeTags } = request.body;

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return reply.status(400).send({ error: "assetIds must be a non-empty array" });
    }

    const store = app.ctx.mediaFor(customerId, projectId);
    const now = new Date().toISOString();
    const updated: string[] = [];
    const notFound: string[] = [];

    for (const assetId of assetIds) {
      const asset = store.get(assetId);
      if (!asset) {
        notFound.push(assetId);
        continue;
      }

      let tags = [...(asset.tags ?? [])];
      if (addTags) {
        for (const tag of addTags) {
          if (!tags.includes(tag)) tags.push(tag);
        }
      }
      if (removeTags) {
        tags = tags.filter((t) => !removeTags.includes(t));
      }

      store.update(assetId, { tags, updatedAt: now } as Partial<typeof asset>);
      updated.push(assetId);
    }

    log.info({ updated: updated.length, notFound: notFound.length }, "bulk tag update completed");
    return { updated, notFound };
  });

  // POST /media/bulk/delete — Bulk Delete
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { assetIds: string[]; force?: boolean };
  }>("/bulk/delete", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { assetIds, force } = request.body;

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return reply.status(400).send({ error: "assetIds must be a non-empty array" });
    }

    const store = app.ctx.mediaFor(customerId, projectId);
    const deleted: string[] = [];
    const notFound: string[] = [];
    const inUse: string[] = [];

    for (const assetId of assetIds) {
      const asset = store.get(assetId);
      if (!asset) {
        notFound.push(assetId);
        continue;
      }

      if (!force && (asset.usedBy ?? []).length > 0) {
        inUse.push(assetId);
        continue;
      }

      store.delete(assetId);
      deleted.push(assetId);
    }

    log.info({ deleted: deleted.length, notFound: notFound.length, inUse: inUse.length }, "bulk delete completed");
    return { deleted, notFound, inUse };
  });

  // POST /media/generate — AI generation (aktiviert)
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: {
      prompt: string;
      aspectRatio?: string;
      title?: string;
      tags?: string[];
      linkToContent?: { contentId: string; role: string };
    };
  }>("/generate", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { prompt, aspectRatio, title, tags, linkToContent } = request.body;

    if (!prompt) {
      return reply.status(400).send({ error: "prompt is required" });
    }

    const store = app.ctx.mediaFor(customerId, projectId);
    const service = new MediaService(store);

    try {
      const result = await service.generate({ customerId, projectId, prompt, aspectRatio, title, tags });

      // Usage verknuepfen
      if (linkToContent) {
        const asset = store.get(result.asset.id);
        if (asset) {
          const usedBy = [...(asset.usedBy ?? [])];
          usedBy.push({
            contentId: linkToContent.contentId,
            role: linkToContent.role as "hero" | "inline" | "thumbnail" | "attachment" | "social_media",
            addedAt: new Date().toISOString(),
          });
          store.update(result.asset.id, { usedBy, updatedAt: new Date().toISOString() } as Partial<typeof asset>);
        }
      }

      log.info({ assetId: result.asset.id, prompt }, "media generated");
      return { asset: store.get(result.asset.id) ?? result.asset };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      log.error({ err, prompt }, "media generation failed");
      return reply.status(500).send({ error: message });
    }
  });

  // GET /media/:assetId — get asset metadata
  app.get<{
    Params: { customerId: string; projectId: string; assetId: string };
  }>("/:assetId", async (request, reply) => {
    const { customerId, projectId, assetId } = request.params;
    const store = app.ctx.mediaFor(customerId, projectId);
    const asset = store.get(assetId);

    if (!asset) {
      return reply.status(404).send({ error: "Media asset not found" });
    }

    return asset;
  });

  // PATCH /media/:assetId — Metadaten-Update
  app.patch<{
    Params: { customerId: string; projectId: string; assetId: string };
    Body: { title?: string; description?: string; tags?: string[]; altText?: string };
  }>("/:assetId", async (request, reply) => {
    const { customerId, projectId, assetId } = request.params;
    const { title, description, tags, altText } = request.body;
    const store = app.ctx.mediaFor(customerId, projectId);

    const asset = store.get(assetId);
    if (!asset) {
      return reply.status(404).send({ error: "Media asset not found" });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (tags !== undefined) updates.tags = tags;
    if (altText !== undefined) updates.altText = altText;
    updates.updatedAt = new Date().toISOString();

    const updated = store.update(assetId, updates);
    log.info({ assetId }, "media asset metadata updated");
    return updated;
  });

  // DELETE /media/:assetId — erweitert mit force-Param
  app.delete<{
    Params: { customerId: string; projectId: string; assetId: string };
    Querystring: { force?: string };
  }>("/:assetId", async (request, reply) => {
    const { customerId, projectId, assetId } = request.params;
    const { force } = request.query;
    const store = app.ctx.mediaFor(customerId, projectId);
    const asset = store.get(assetId);

    if (!asset) {
      return reply.status(404).send({ error: "Media asset not found" });
    }

    if (force !== "true" && (asset.usedBy ?? []).length > 0) {
      return reply.status(409).send({
        error: "Asset is in use",
        usedBy: asset.usedBy,
        hint: "Use ?force=true to delete anyway",
      });
    }

    store.delete(assetId);
    log.info({ assetId }, "media asset deleted");
    return { message: "Asset deleted", assetId };
  });

  // GET /media/:assetId/file — Original-Datei als Binary-Stream
  app.get<{
    Params: { customerId: string; projectId: string; assetId: string };
  }>("/:assetId/file", async (request, reply) => {
    const { customerId, projectId, assetId } = request.params;
    const store = app.ctx.mediaFor(customerId, projectId);
    const asset = store.get(assetId);

    if (!asset) {
      return reply.status(404).send({ error: "Media asset not found" });
    }

    const originalDir = store.getOriginalDir(assetId);
    const filePath = path.join(originalDir, path.basename(asset.localPath));

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: "Original file not found on disk" });
    }

    reply.header("Content-Type", asset.mimeType);
    reply.header("Content-Disposition", `inline; filename="${asset.fileName}"`);
    return reply.send(fs.createReadStream(filePath));
  });

  // GET /media/:assetId/thumbnail — Thumbnail ausliefern
  app.get<{
    Params: { customerId: string; projectId: string; assetId: string };
  }>("/:assetId/thumbnail", async (request, reply) => {
    const { customerId, projectId, assetId } = request.params;
    const store = app.ctx.mediaFor(customerId, projectId);
    const asset = store.get(assetId);

    if (!asset) {
      return reply.status(404).send({ error: "Media asset not found" });
    }

    if (!asset.thumbnailPath) {
      return reply.status(404).send({ error: "No thumbnail available for this asset" });
    }

    const thumbPath = path.join(store.entityDir(assetId), asset.thumbnailPath);

    if (!fs.existsSync(thumbPath)) {
      return reply.status(404).send({ error: "Thumbnail file not found on disk" });
    }

    reply.header("Content-Type", "image/webp");
    reply.header("Content-Disposition", `inline; filename="thumb-${assetId}.webp"`);
    return reply.send(fs.createReadStream(thumbPath));
  });

  // POST /media/:assetId/usage — Usage hinzufuegen
  app.post<{
    Params: { customerId: string; projectId: string; assetId: string };
    Body: { contentId: string; role: string };
  }>("/:assetId/usage", async (request, reply) => {
    const { customerId, projectId, assetId } = request.params;
    const { contentId, role } = request.body;

    if (!contentId || !role) {
      return reply.status(400).send({ error: "contentId and role are required" });
    }

    const store = app.ctx.mediaFor(customerId, projectId);
    const asset = store.get(assetId);

    if (!asset) {
      return reply.status(404).send({ error: "Media asset not found" });
    }

    const usedBy = [...(asset.usedBy ?? [])];
    // Duplikat-Check
    const exists = usedBy.some((u) => u.contentId === contentId && u.role === role);
    if (exists) {
      return reply.status(409).send({ error: "Usage reference already exists" });
    }

    usedBy.push({
      contentId,
      role: role as "hero" | "inline" | "thumbnail" | "attachment" | "social_media",
      addedAt: new Date().toISOString(),
    });

    store.update(assetId, { usedBy, updatedAt: new Date().toISOString() } as Partial<typeof asset>);
    log.info({ assetId, contentId, role }, "usage added");
    return { message: "Usage added", assetId, contentId, role };
  });

  // DELETE /media/:assetId/usage/:contentId — Usage entfernen
  app.delete<{
    Params: { customerId: string; projectId: string; assetId: string; contentId: string };
  }>("/:assetId/usage/:contentId", async (request, reply) => {
    const { customerId, projectId, assetId, contentId } = request.params;
    const store = app.ctx.mediaFor(customerId, projectId);
    const asset = store.get(assetId);

    if (!asset) {
      return reply.status(404).send({ error: "Media asset not found" });
    }

    const usedBy = (asset.usedBy ?? []).filter((u) => u.contentId !== contentId);

    if (usedBy.length === (asset.usedBy ?? []).length) {
      return reply.status(404).send({ error: "Usage reference not found" });
    }

    store.update(assetId, { usedBy, updatedAt: new Date().toISOString() } as Partial<typeof asset>);
    log.info({ assetId, contentId }, "usage removed");
    return { message: "Usage removed", assetId, contentId };
  });
}
