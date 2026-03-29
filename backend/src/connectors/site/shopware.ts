import { createLogger } from "../../utils/logger.js";
import type { ContentReader } from "../../services/sync.js";
import type { SiteConnector, ConnectorSchema, ConnectorSlot, WriteResult } from "./types.js";
import type { ContentItem, ContentVersion, LanguageVariant, Project } from "../../models/types.js";

const log = createLogger("connector:shopware");

interface ShopwareConfig {
  shopUrl: string;
  clientId: string;
  clientSecret: string;
}

interface ShopwareToken {
  access_token: string;
  expires_in: number;
  fetchedAt: number;
}

/**
 * Shopware 6 Site Connector.
 *
 * Discovers CMS layouts (Erlebniswelten) via Admin API.
 * Writes content to categories via slotConfig patching.
 *
 * Critical rules (from production experience):
 * - NEVER patch /api/cms-slot/{id} — modifies layout defaults for ALL categories
 * - Always merge slotConfig — never full overwrite
 * - Resolve slots by section-index + block-type, not by UUID
 */
export class ShopwareSiteConnector implements SiteConnector {
  readonly platform = "shopware";
  private token: ShopwareToken | null = null;

  constructor(private config: ShopwareConfig) {}

  static async testConnection(config: Record<string, string>): Promise<{ success: boolean; error?: string; shopName?: string; shopUrl?: string }> {
    if (!config.shopUrl || !config.clientId || !config.clientSecret) {
      return { success: false, error: "shopUrl, clientId, clientSecret are required" };
    }
    const shopUrl = config.shopUrl.replace(/\/+$/, "");
    try {
      const res = await fetch(`${shopUrl}/api/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials", client_id: config.clientId, client_secret: config.clientSecret }),
      });
      if (!res.ok) {
        return { success: false, error: res.status === 401 ? "Authentication failed — check Client ID or Secret" : `Shopware API error: ${res.status}` };
      }
      const tokenData = await res.json() as { access_token: string };
      let shopName: string | undefined;
      try {
        const infoRes = await fetch(`${shopUrl}/api/_info/config`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
        });
        if (infoRes.ok) shopName = ((await infoRes.json()) as { title?: string }).title;
      } catch { /* optional */ }
      return { success: true, shopName, shopUrl };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  // ── Auth ──────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    // Reuse token if still valid (with 60s buffer)
    if (this.token && Date.now() < this.token.fetchedAt + (this.token.expires_in - 60) * 1000) {
      return this.token.access_token;
    }

    const res = await fetch(`${this.config.shopUrl}/api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`Shopware auth failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    this.token = { ...data, fetchedAt: Date.now() };
    return data.access_token;
  }

  private async apiGet<T>(path: string): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${this.config.shopUrl}/api${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Shopware API GET ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async apiPost<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${this.config.shopUrl}/api${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Shopware API POST ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async apiPatch(path: string, body: unknown): Promise<void> {
    const token = await this.getToken();
    const res = await fetch(`${this.config.shopUrl}/api${path}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Shopware API PATCH ${path}: ${res.status} ${await res.text()}`);
  }

  // ── ContentReader (for sync) ──────────────────────────────

  createReader(): ContentReader {
    throw new Error("Shopware content reader not yet implemented — use discoverSchemas() instead");
  }

  // ── Write (legacy Markdown — not used for Shopware) ───────

  async write(
    _project: Project,
    _contentItem: ContentItem,
    _languages: LanguageVariant[],
    _versionDir: string,
  ): Promise<WriteResult> {
    throw new Error("Shopware connector uses writeStructured(), not write()");
  }

  // ── Schema Discovery ──────────────────────────────────────

  async discoverSchemas(): Promise<ConnectorSchema[]> {
    log.info("discovering Shopware CMS layouts");

    // Use POST /search/cms-page for reliable association loading
    const result = await this.apiPost<{
      data: Array<{
        id: string;
        name: string;
        type: string;
        sections: Array<{
          position: number;
          name?: string;
          blocks: Array<{
            position: number;
            type: string;
            slots: Array<{
              slot: string;
              type: string;
              config?: Record<string, unknown>;
            }>;
          }>;
        }>;
      }>;
    }>("/search/cms-page", {
      filter: [{ type: "equals", field: "type", value: "landingpage" }],
      associations: {
        sections: {
          associations: {
            blocks: {
              associations: {
                slots: {},
              },
            },
          },
        },
      },
      limit: 50,
    });

    const schemas: ConnectorSchema[] = [];

    for (const page of result.data ?? []) {
      const slots: ConnectorSlot[] = [];

      for (const section of (page.sections ?? []).sort((a, b) => a.position - b.position)) {
        for (const block of (section.blocks ?? []).sort((a, b) => a.position - b.position)) {
          for (const slot of block.slots ?? []) {
            const slotId = `s${section.position}-${block.type}-${slot.slot}`;
            const label = section.name
              ? `${section.name} → ${slot.slot}`
              : `Section ${section.position} → ${block.type} → ${slot.slot}`;

            // Map Shopware slot types to our generic types
            let slotType: ConnectorSlot["type"] = "html";
            if (slot.type === "image" || slot.type === "manufacturer-logo") slotType = "image";
            else if (slot.type === "product-slider" || slot.type === "product-listing") slotType = "product-list";
            else if (slot.type === "text") slotType = "html";

            // Extract default content from slot config (Ansatz B: content in layout)
            let defaultContent: string | undefined;
            const slotConfig = slot.config as Record<string, { source?: string; value?: unknown }> | undefined;
            if (slotConfig?.content?.value && typeof slotConfig.content.value === "string") {
              defaultContent = slotConfig.content.value;
            }

            slots.push({
              id: slotId,
              label,
              type: slotType,
              required: false,
              exampleContent: defaultContent,
            });
          }
        }
      }

      // Try to find a category using this layout for real content (Ansatz A: content in slotConfig)
      try {
        const catResult = await this.apiPost<{
          data: Array<{ id: string; slotConfig?: Record<string, Record<string, { source?: string; value?: unknown }>> }>;
        }>("/search/category", {
          filter: [{ type: "equals", field: "cmsPageId", value: page.id }],
          limit: 1,
          includes: { category: ["id", "slotConfig"] },
        });

        const category = catResult.data?.[0];
        if (category?.slotConfig) {
          // Map slotConfig overrides to our slot IDs
          for (const slot of slots) {
            // slotConfig keys are Shopware's internal slot UUIDs, not our s{N}-... IDs
            // We need to match by position — iterate all slotConfig entries
            // For now, match by checking if any slotConfig entry has content
            for (const [, config] of Object.entries(category.slotConfig)) {
              const content = config?.content?.value;
              if (content && typeof content === "string" && content.length > 10) {
                // Heuristic: match slots without exampleContent to available slotConfig entries
                if (!slot.exampleContent) {
                  slot.exampleContent = content;
                  break;
                }
              }
            }
          }
          log.info({ layoutId: page.id, categoryId: category.id }, "loaded example content from category slotConfig");
        }
      } catch {
        log.debug({ layoutId: page.id }, "no category found for example content");
      }

      schemas.push({
        id: page.id,
        label: page.name || `Layout ${page.id.slice(0, 8)}`,
        description: `Shopware Erlebniswelt: ${slots.length} slots`,
        category: "site",
        slots,
      });

      log.info({ layoutId: page.id, name: page.name, slots: slots.length }, "layout discovered");
    }

    schemas.sort((a, b) => a.label.localeCompare(b.label));
    log.info({ layoutCount: schemas.length }, "Shopware schema discovery complete");
    return schemas;
  }

  // ── Structured Write (slot-based) ─────────────────────────

  async writeStructured(
    _project: Project,
    contentItem: ContentItem,
    version: ContentVersion,
    schema: ConnectorSchema,
  ): Promise<WriteResult> {
    const customFields = version.customFields ?? {};

    // Build slotConfig from customFields
    const slotConfig: Record<string, Record<string, { source: string; value: unknown }>> = {};

    for (const slot of schema.slots) {
      const value = customFields[slot.id];
      if (value === undefined || value === null) continue;

      if (slot.type === "html" || slot.type === "text") {
        slotConfig[slot.id] = {
          content: { source: "static", value: String(value) },
        };
      } else if (slot.type === "image") {
        const imgValue = value as { mediaId?: string };
        if (imgValue.mediaId) {
          slotConfig[slot.id] = {
            media: { source: "static", value: imgValue.mediaId },
            displayMode: { source: "static", value: "cover" },
          };
        }
      }
      // product-list and other types would need specific handling
    }

    // Find the category that uses this layout
    // For now, the category ID should be stored in contentItem.deliveryRef
    const categoryId = contentItem.deliveryRef;
    if (!categoryId) {
      return {
        success: false,
        ref: "",
        published: false,
        filesWritten: [],
        error: "No category ID (deliveryRef) set on content item",
      };
    }

    try {
      // IMPORTANT: Merge with existing slotConfig, don't overwrite
      const existingCategory = await this.apiGet<{ data: { slotConfig?: Record<string, unknown> } }>(
        `/category/${categoryId}`,
      );
      const existingConfig = existingCategory.data?.slotConfig ?? {};
      const mergedConfig = { ...existingConfig, ...slotConfig };

      await this.apiPatch(`/category/${categoryId}`, {
        slotConfig: mergedConfig,
      });

      log.info({
        categoryId,
        slotsWritten: Object.keys(slotConfig).length,
        contentItemId: contentItem.id,
      }, "Shopware content written");

      return {
        success: true,
        ref: categoryId,
        published: true,
        filesWritten: Object.keys(slotConfig),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error({ err: error, categoryId }, "Shopware write failed");
      return { success: false, ref: "", published: false, filesWritten: [], error: msg };
    }
  }
}
