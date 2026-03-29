import path from "node:path";
import type { FastifyInstance } from "fastify";
import { ContentTypeStore, type CustomContentType, type CustomFieldDefinition } from "../../models/content-type.js";
import { createSiteConnector } from "../../connectors/site/factory.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("api:content-types");

export async function contentTypeRoutes(app: FastifyInstance) {
  // Seed directory for builtin content types
  const seedDir = path.join(app.ctx.dataDir, "..", "data.seed", "project-defaults", "content-types");

  // Helper: get store for project (syncs builtins on access)
  function getStore(customerId: string, projectId: string): ContentTypeStore {
    const projectDir = app.ctx.projectsFor(customerId).entityDir(projectId);
    const store = new ContentTypeStore(projectDir);
    store.syncBuiltins(seedDir);
    return store;
  }

  // GET /content-types — List all content types for project
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/",
    async (request) => {
      const { customerId, projectId } = request.params;
      return getStore(customerId, projectId).list();
    },
  );

  // GET /content-types/:typeId
  app.get<{ Params: { customerId: string; projectId: string; typeId: string } }>(
    "/:typeId",
    async (request, reply) => {
      const { customerId, projectId, typeId } = request.params;
      const ct = getStore(customerId, projectId).get(typeId);
      if (!ct) return reply.status(404).send({ error: "Content type not found" });
      return ct;
    },
  );

  // POST /content-types — Create custom content type
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { label: string; description?: string; category?: string; fields?: CustomFieldDefinition[] };
  }>(
    "/",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const { label, description, category, fields } = (request.body ?? {}) as {
        label?: string;
        description?: string;
        category?: string;
        fields?: CustomFieldDefinition[];
      };

      if (!label?.trim()) {
        return reply.status(400).send({ error: "label is required" });
      }

      const store = getStore(customerId, projectId);
      const ct = store.create({
        projectId,
        label: label.trim(),
        description,
        category: (category as CustomContentType["category"]) ?? "site",
        source: "custom",
        fields: fields ?? [],
      });

      return reply.status(201).send(ct);
    },
  );

  // PUT /content-types/:typeId — Update custom content type
  app.put<{
    Params: { customerId: string; projectId: string; typeId: string };
    Body: Partial<CustomContentType>;
  }>(
    "/:typeId",
    async (request, reply) => {
      const { customerId, projectId, typeId } = request.params;
      const store = getStore(customerId, projectId);
      const existing = store.get(typeId);

      if (!existing) {
        return reply.status(404).send({ error: "Content type not found" });
      }

      const body = request.body as Partial<CustomContentType>;

      // Built-in types: only allow agent config changes
      if (existing.source === "builtin") {
        if (body.label || body.description || body.category || body.fields) {
          return reply.status(403).send({ error: "Cannot modify fields/metadata of built-in content types. Only agent configuration can be changed." });
        }
        const updated = store.update(typeId, { agent: body.agent });
        return updated;
      }

      const updated = store.update(typeId, {
        label: body.label,
        description: body.description,
        category: body.category,
        fields: body.fields,
        agent: body.agent,
      });

      return updated;
    },
  );

  // DELETE /content-types/:typeId
  app.delete<{ Params: { customerId: string; projectId: string; typeId: string } }>(
    "/:typeId",
    async (request, reply) => {
      const { customerId, projectId, typeId } = request.params;
      const store = getStore(customerId, projectId);
      const existing = store.get(typeId);

      if (!existing) {
        return reply.status(404).send({ error: "Content type not found" });
      }
      if (existing.source === "builtin") {
        return reply.status(403).send({ error: "Cannot delete built-in content types" });
      }

      store.delete(typeId);
      return { message: "Content type deleted" };
    },
  );

  // POST /content-types/import — Import schemas from connector
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { schemaIds?: string[]; connectorType?: string };
  }>(
    "/import",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const body = (request.body ?? {}) as { schemaIds?: string[]; connectorType?: string };
      const project = app.ctx.projectsFor(customerId).get(projectId);
      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      try {
        const connector = createSiteConnector(project, body.connectorType ? { connectorType: body.connectorType as import("../../models/types.js").ConnectorType } : undefined);
        if (!connector.discoverSchemas) {
          return reply.status(400).send({
            error: `${connector.platform} connector does not support schema discovery`,
          });
        }

        let schemas = await connector.discoverSchemas();

        // Filter by selected schema IDs if provided
        if (body.schemaIds && body.schemaIds.length > 0) {
          const idSet = new Set(body.schemaIds);
          schemas = schemas.filter((s) => idSet.has(s.id));
        }

        const store = getStore(customerId, projectId);
        const imported = store.importFromConnector(projectId, connector.platform, schemas);

        log.info({ projectId, connector: connector.platform, count: imported.length, filtered: !!body.schemaIds }, "schemas imported");
        return { message: `${imported.length} content types imported`, types: imported };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error({ err: error }, "schema import failed");
        return reply.status(500).send({ error: msg });
      }
    },
  );
}
