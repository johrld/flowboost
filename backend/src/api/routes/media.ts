import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { MediaService } from "../../services/media.js";
import type { MediaType } from "../../models/types.js";

const log = createLogger("api:media");

export async function mediaRoutes(app: FastifyInstance) {
  // GET /media — list assets with filters
  app.get<{
    Params: { customerId: string; projectId: string };
    Querystring: { type?: MediaType; source?: string };
  }>("/", async (request) => {
    const { customerId, projectId } = request.params;
    const { type, source } = request.query;
    const store = app.ctx.mediaFor(customerId, projectId);

    let assets = store.list();
    if (type) assets = assets.filter((a) => a.type === type);
    if (source) assets = assets.filter((a) => a.source === source);

    return { total: assets.length, assets };
  });

  // POST /media/upload — multipart file upload
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

    const result = await service.ingest({
      customerId,
      projectId,
      fileName: data.filename,
      mimeType: data.mimetype,
      buffer,
      altText: (data.fields.altText as { value?: string })?.value,
    });

    log.info({ assetId: result.asset.id, fileName: data.filename }, "file uploaded");
    return result;
  });

  // POST /media/generate — AI generation request (placeholder)
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: {
      type: MediaType;
      prompt: string;
      model?: string;
    };
  }>("/generate", async (request, reply) => {
    const { customerId: _customerId, projectId: _projectId } = request.params;
    const body = request.body as { type: MediaType; prompt: string; model?: string };

    // Phase 2/3: AI Service Registry will handle this
    log.info({ type: body.type, model: body.model }, "media generation requested (not yet implemented)");
    return reply.status(501).send({
      error: "AI media generation not yet implemented",
      hint: "Phase 2 (video) / Phase 3 (audio) — coming soon",
      requested: { type: body.type, prompt: body.prompt, model: body.model },
    });
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

  // DELETE /media/:assetId
  app.delete<{
    Params: { customerId: string; projectId: string; assetId: string };
  }>("/:assetId", async (request, reply) => {
    const { customerId, projectId, assetId } = request.params;
    const store = app.ctx.mediaFor(customerId, projectId);
    const asset = store.get(assetId);

    if (!asset) {
      return reply.status(404).send({ error: "Media asset not found" });
    }

    store.delete(assetId);
    log.info({ assetId }, "media asset deleted");
    return { message: "Asset deleted", assetId };
  });
}
