import { createLogger } from "../../utils/logger.js";
import type { ContentReader } from "../../services/sync.js";
import type { SiteConnector, ConnectorSchema, ConnectorSlot, WriteResult } from "./types.js";
import type { Article, ArticleVersion, ContentItem, ContentVersion, Project } from "../../models/types.js";

const log = createLogger("connector:wordpress");

interface WordPressConfig {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

/**
 * WordPress Site Connector.
 *
 * Standard WordPress: title + content (no schema discovery)
 * With ACF: discovers field groups as schemas
 *
 * Auth: Application Passwords (WordPress 5.6+)
 */
export class WordPressSiteConnector implements SiteConnector {
  readonly platform = "wordpress";

  constructor(private config: WordPressConfig) {}

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.config.username}:${this.config.applicationPassword}`).toString("base64")}`;
  }

  private async apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${this.config.siteUrl}/wp-json${path}`, {
      headers: { Authorization: this.authHeader, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`WordPress API GET ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.config.siteUrl}/wp-json${path}`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`WordPress API POST ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  createReader(): ContentReader {
    throw new Error("WordPress content reader not yet implemented");
  }

  // ── Write (standard title + content) ──────────────────────

  async write(
    _project: Project,
    article: Article,
    versions: ArticleVersion[],
    versionDir: string,
  ): Promise<WriteResult> {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const version = versions[0];
    if (!version) {
      return { success: false, ref: "", published: false, filesWritten: [], error: "No version" };
    }

    const contentPath = path.join(versionDir, "content", version.lang, `${version.slug}.md`);
    if (!fs.existsSync(contentPath)) {
      return { success: false, ref: "", published: false, filesWritten: [], error: "Content file not found" };
    }

    const markdown = fs.readFileSync(contentPath, "utf-8");

    try {
      const post = await this.apiPost<{ id: number; link: string }>("/wp/v2/posts", {
        title: article.translationKey,
        content: markdown,
        status: "draft",
      });

      log.info({ postId: post.id, url: post.link }, "WordPress post created");

      return {
        success: true,
        ref: String(post.id),
        url: post.link,
        published: false,
        filesWritten: [contentPath],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error({ err: error }, "WordPress write failed");
      return { success: false, ref: "", published: false, filesWritten: [], error: msg };
    }
  }

  // ── Schema Discovery (ACF) ────────────────────────────────

  async discoverSchemas(): Promise<ConnectorSchema[]> {
    log.info("discovering WordPress ACF field groups");

    try {
      // Try ACF REST API
      const groups = await this.apiGet<Array<{
        key: string;
        title: string;
        fields: Array<{
          key: string;
          label: string;
          name: string;
          type: string;
          required: number;
          maxlength?: string;
        }>;
      }>>("/acf/v3/field-groups");

      const schemas: ConnectorSchema[] = [];

      for (const group of groups) {
        const slots: ConnectorSlot[] = (group.fields ?? []).map((field) => {
          let slotType: ConnectorSlot["type"] = "text";
          if (field.type === "wysiwyg" || field.type === "textarea") slotType = "html";
          else if (field.type === "image" || field.type === "gallery") slotType = "image";
          else if (field.type === "repeater") slotType = "json";

          return {
            id: field.name,
            label: field.label,
            type: slotType,
            required: field.required === 1,
            constraints: field.maxlength ? { charLimit: parseInt(field.maxlength, 10) } : undefined,
          };
        });

        schemas.push({
          id: group.key,
          label: group.title,
          category: "site",
          slots,
        });
      }

      log.info({ groupCount: schemas.length }, "WordPress ACF schema discovery complete");
      return schemas;
    } catch (error) {
      // ACF not installed or REST API not enabled
      log.info("ACF not available — WordPress uses standard title + content");
      return [{
        id: "wp-standard",
        label: "Standard Post",
        description: "WordPress post with title and content",
        category: "site",
        slots: [
          { id: "title", label: "Title", type: "text", required: true },
          { id: "content", label: "Content", type: "html", required: true },
        ],
      }];
    }
  }

  // ── Structured Write (ACF fields) ─────────────────────────

  async writeStructured(
    _project: Project,
    contentItem: ContentItem,
    version: ContentVersion,
    schema: ConnectorSchema,
  ): Promise<WriteResult> {
    const customFields = version.customFields ?? {};

    try {
      const postData: Record<string, unknown> = {
        title: customFields.title ?? contentItem.title,
        content: customFields.content ?? "",
        status: "draft",
      };

      // Add ACF fields if schema has custom slots
      const acfFields: Record<string, unknown> = {};
      for (const slot of schema.slots) {
        if (slot.id === "title" || slot.id === "content") continue;
        if (customFields[slot.id] !== undefined) {
          acfFields[slot.id] = customFields[slot.id];
        }
      }
      if (Object.keys(acfFields).length > 0) {
        postData.acf = acfFields;
      }

      const post = await this.apiPost<{ id: number; link: string }>("/wp/v2/posts", postData);

      log.info({
        postId: post.id,
        acfFields: Object.keys(acfFields).length,
      }, "WordPress structured content written");

      return {
        success: true,
        ref: String(post.id),
        url: post.link,
        published: false,
        filesWritten: [],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error({ err: error }, "WordPress structured write failed");
      return { success: false, ref: "", published: false, filesWritten: [], error: msg };
    }
  }
}
