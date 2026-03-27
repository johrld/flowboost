import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { ShopwareSiteConnector } from "../../connectors/site/shopware.js";
import { createSiteConnector } from "../../connectors/site/factory.js";
import { ListmonkConnector } from "../../connectors/email/listmonk.js";

const log = createLogger("api:connectors");

export async function connectorRoutes(app: FastifyInstance) {
  // POST /connectors/test — test connector credentials
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: {
      type: string;
      config: Record<string, string | undefined>;
    };
  }>("/test", async (request, reply) => {
    const { type, config } = request.body;

    if (type === "shopware") {
      if (!config.shopUrl || !config.clientId || !config.clientSecret) {
        return reply.status(400).send({ success: false, error: "shopUrl, clientId, clientSecret sind erforderlich" });
      }

      try {
        // Normalize URL (remove trailing slash)
        const shopUrl = config.shopUrl.replace(/\/+$/, "");

        // Try to get OAuth token
        const res = await fetch(`${shopUrl}/api/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          log.warn({ status: res.status, body }, "Shopware connection test failed");
          return reply.status(200).send({
            success: false,
            error: res.status === 401
              ? "Authentifizierung fehlgeschlagen -- Client ID oder Secret falsch"
              : `Shopware API Fehler: ${res.status}`,
          });
        }

        // Token works, try to get shop info
        const tokenData = await res.json() as { access_token: string };
        let shopName: string | undefined;
        try {
          const infoRes = await fetch(`${shopUrl}/api/_info/config`, {
            headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
          });
          if (infoRes.ok) {
            const info = await infoRes.json() as { version?: string; title?: string };
            shopName = info.title;
          }
        } catch {
          // Info endpoint optional
        }

        log.info({ shopUrl, shopName }, "Shopware connection test successful");
        return { success: true, shopName, shopUrl };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
        log.error({ err, shopUrl: config.shopUrl }, "Shopware connection test error");
        return reply.status(200).send({ success: false, error: message });
      }
    }

    if (type === "listmonk") {
      if (!config.baseUrl || !config.username || !config.password) {
        return reply.status(400).send({ success: false, error: "baseUrl, username, password are required" });
      }

      const connector = new ListmonkConnector({
        baseUrl: (config.baseUrl as string).replace(/\/+$/, ""),
        username: config.username as string,
        password: config.password as string,
      });

      const result = await connector.testConnection();
      return result;
    }

    return reply.status(400).send({ success: false, error: `Connector type "${type}" not supported` });
  });

  // GET /connectors/schemas — discover schemas from configured connector
  app.get<{
    Params: { customerId: string; projectId: string };
  }>("/schemas", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const projects = app.ctx.projectsFor(customerId);
    const project = projects.get(projectId);

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const connectorType = project.connector?.type;
    if (connectorType !== "shopware" && connectorType !== "wordpress") {
      return reply.status(400).send({ error: "Kein Connector mit Schema Discovery konfiguriert" });
    }

    try {
      const connector = createSiteConnector(project);
      if (!connector.discoverSchemas) {
        return reply.status(400).send({ error: "Connector unterstützt keine Schema Discovery" });
      }

      const schemas = await connector.discoverSchemas();
      log.info({ connectorType, schemaCount: schemas.length }, "schemas discovered");
      return { schemas };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Schema Discovery fehlgeschlagen";
      log.error({ err, connectorType }, "schema discovery failed");
      return reply.status(500).send({ error: message });
    }
  });

  // GET /connectors/browse — browse connector content (products, categories)
  app.get<{
    Params: { customerId: string; projectId: string };
    Querystring: {
      entity?: string;
      search?: string;
      categoryId?: string;
      page?: string;
      limit?: string;
    };
  }>("/browse", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { entity = "products", search, categoryId, page = "1", limit = "20" } = request.query;

    const projects = app.ctx.projectsFor(customerId);
    const project = projects.get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (project.connector?.type !== "shopware") {
      return reply.status(400).send({ error: "Nur Shopware-Connector unterstützt Browse" });
    }

    const sw = project.connector.shopware;
    if (!sw?.shopUrl || !sw?.clientId || !sw?.clientSecret) {
      return reply.status(400).send({ error: "Shopware-Connector nicht konfiguriert" });
    }

    const connector = new ShopwareSiteConnector(sw);

    try {
      if (entity === "products") {
        const result = await browseProducts(connector, search, categoryId, parseInt(page), parseInt(limit));
        return result;
      } else if (entity === "categories") {
        const result = await browseCategories(connector, search);
        return result;
      }
      return reply.status(400).send({ error: `Unbekannte Entity: ${entity}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Browse fehlgeschlagen";
      log.error({ err, entity }, "connector browse failed");
      return reply.status(500).send({ error: message });
    }
  });

  // GET /connectors/browse/:refId — get detail for a specific item
  app.get<{
    Params: { customerId: string; projectId: string; refId: string };
    Querystring: { entity?: string };
  }>("/browse/:refId", async (request, reply) => {
    const { customerId, projectId, refId } = request.params;
    const { entity = "products" } = request.query;

    const projects = app.ctx.projectsFor(customerId);
    const project = projects.get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (project.connector?.type !== "shopware") {
      return reply.status(400).send({ error: "Nur Shopware-Connector unterstützt Browse" });
    }

    const sw = project.connector.shopware;
    if (!sw?.shopUrl || !sw?.clientId || !sw?.clientSecret) {
      return reply.status(400).send({ error: "Shopware-Connector nicht konfiguriert" });
    }

    const connector = new ShopwareSiteConnector(sw);

    try {
      if (entity === "products") {
        const detail = await getProductDetail(connector, refId);
        return detail;
      }
      return reply.status(400).send({ error: `Unbekannte Entity: ${entity}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Detail-Abruf fehlgeschlagen";
      log.error({ err, refId, entity }, "connector browse detail failed");
      return reply.status(500).send({ error: message });
    }
  });

  // GET /connectors/templates — list templates from email connector (Listmonk)
  app.get<{
    Params: { customerId: string; projectId: string };
  }>("/templates", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const projects = app.ctx.projectsFor(customerId);
    const project = projects.get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (project.connector?.type === "listmonk") {
      const lm = project.connector.listmonk;
      if (!lm?.baseUrl || !lm?.username || !lm?.password) {
        return reply.status(400).send({ error: "Listmonk connector not configured" });
      }
      const connector = new ListmonkConnector(lm);
      const templates = await connector.getTemplates();
      return { templates };
    }

    return reply.status(400).send({ error: "No email connector configured" });
  });

  // GET /connectors/lists — list subscriber lists from email connector (Listmonk)
  app.get<{
    Params: { customerId: string; projectId: string };
  }>("/lists", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const projects = app.ctx.projectsFor(customerId);
    const project = projects.get(projectId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (project.connector?.type === "listmonk") {
      const lm = project.connector.listmonk;
      if (!lm?.baseUrl || !lm?.username || !lm?.password) {
        return reply.status(400).send({ error: "Listmonk connector not configured" });
      }
      const connector = new ListmonkConnector(lm);
      const lists = await connector.getLists();
      return { lists };
    }

    return reply.status(400).send({ error: "No email connector configured" });
  });
}

// ── Shopware Browse Helpers ─────────────────────────────────────

async function browseProducts(
  connector: ShopwareSiteConnector,
  search: string | undefined,
  categoryId: string | undefined,
  page: number,
  limit: number,
) {
  const filters: Record<string, unknown>[] = [
    { type: "equals", field: "active", value: true },
    { type: "equals", field: "parentId", value: null }, // no variants
  ];

  if (categoryId) {
    filters.push({ type: "equals", field: "categories.id", value: categoryId });
  }

  const body: Record<string, unknown> = {
    filter: filters,
    page,
    limit,
    includes: {
      product: ["id", "name", "productNumber", "description", "active"],
    },
    "total-count-mode": 1,
  };

  if (search && search.length >= 2) {
    body.query = [
      { score: 500, query: { type: "contains", field: "name", value: search } },
      { score: 200, query: { type: "contains", field: "description", value: search } },
      { score: 100, query: { type: "contains", field: "productNumber", value: search } },
    ];
  }

  // Access internal apiPost via casting -- ShopwareSiteConnector exposes only public methods
  // We need to call the search endpoint, so we add a public method
  const result = await connector.apiPost(
    "/search/product",
    body,
  );

  const data = result as { data: Array<{ id: string; name: string; productNumber: string; description?: string }>; total: number };

  return {
    total: data.total ?? 0,
    items: (data.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      productNumber: p.productNumber,
      description: p.description ? stripHtml(p.description).slice(0, 200) : undefined,
    })),
  };
}

async function browseCategories(connector: ShopwareSiteConnector, search: string | undefined) {
  const filters: Record<string, unknown>[] = [
    { type: "equals", field: "active", value: true },
    { type: "not", queries: [{ type: "equals", field: "type", value: "folder" }] },
    { type: "not", queries: [{ type: "equals", field: "type", value: "link" }] },
  ];

  const body: Record<string, unknown> = {
    filter: filters,
    limit: 100,
    includes: {
      category: ["id", "name", "type", "level", "parentId", "childCount"],
    },
  };

  if (search && search.length >= 2) {
    body.query = [
      { score: 500, query: { type: "contains", field: "name", value: search } },
    ];
  }

  const result = await connector.apiPost(
    "/search/category",
    body,
  );

  const data = result as { data: Array<{ id: string; name: string; type: string; level: number; parentId?: string; childCount: number }>; total: number };

  return {
    total: data.total ?? 0,
    items: (data.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      level: c.level,
      childCount: c.childCount,
    })),
  };
}

async function getProductDetail(connector: ShopwareSiteConnector, productId: string) {
  const body = {
    ids: [productId],
    associations: {
      cover: { associations: { media: {} } },
      properties: { associations: { group: {} } },
    },
    includes: {
      product: ["id", "name", "productNumber", "description", "price", "cover", "properties", "metaTitle", "metaDescription"],
      product_media: ["media"],
      media: ["url", "alt", "title"],
      property_group_option: ["name", "group"],
      property_group: ["name"],
    },
  };

  const result = await connector.apiPost(
    "/search/product",
    body,
  );

  const data = result as { data: Array<Record<string, unknown>> };
  const product = data.data?.[0];
  if (!product) return { error: "Produkt nicht gefunden" };

  // Build structured text for FlowInput
  const parts: string[] = [];
  parts.push(`Produkt: ${product.name}`);
  if (product.productNumber) parts.push(`Artikelnummer: ${product.productNumber}`);
  if (product.description) parts.push(`Beschreibung: ${stripHtml(String(product.description))}`);

  // Properties
  const props = product.properties as Array<{ name: string; group?: { name: string } }> | undefined;
  if (props && props.length > 0) {
    const propTexts = props.map((p) => `${p.group?.name ?? "Eigenschaft"}: ${p.name}`);
    parts.push(`Eigenschaften: ${propTexts.join(", ")}`);
  }

  // Price
  const price = product.price as Array<{ gross: number; net: number; currencyId: string }> | undefined;
  if (price && price.length > 0) {
    parts.push(`Preis: ${price[0].gross.toFixed(2)} EUR (brutto)`);
  }

  // Cover image
  const cover = product.cover as { media?: { url?: string; alt?: string } } | undefined;
  const imageUrl = cover?.media?.url;

  return {
    id: product.id,
    name: product.name,
    productNumber: product.productNumber,
    structuredText: parts.join("\n"),
    imageUrl,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
