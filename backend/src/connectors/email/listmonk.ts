import { createLogger } from "../../utils/logger.js";

const log = createLogger("connector:listmonk");

export interface ListmonkConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export interface ListmonkTemplate {
  id: number;
  name: string;
  type: string;       // "campaign" | "tx"
  isDefault: boolean;
}

export interface ListmonkList {
  id: number;
  name: string;
  type: string;       // "public" | "private"
  optin: string;      // "single" | "double"
  subscriberCount: number;
  tags: string[];
}

export interface CreateDraftPayload {
  name: string;           // internal campaign name
  subject: string;        // email subject line
  body: string;           // HTML content
  listIds: number[];      // recipient list IDs
  templateId?: number;    // Listmonk template ID
  fromEmail?: string;     // sender email
  tags?: string[];
}

export interface CreateDraftResult {
  id: number;
  url: string;
  status: string;
}

export class ListmonkConnector {
  readonly platform = "listmonk";

  constructor(private config: ListmonkConfig) {}

  // ── Auth ──────────────────────────────────────────────────

  private authHeader(): string {
    const encoded = Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64");
    return `Basic ${encoded}`;
  }

  // ── API Helpers ───────────────────────────────────────────

  private async apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}/api${path}`, {
      headers: {
        Authorization: this.authHeader(),
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Listmonk API GET ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}/api${path}`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Listmonk API POST ${path}: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }

  // ── Public API ────────────────────────────────────────────

  async testConnection(): Promise<{ success: boolean; listCount?: number; error?: string }> {
    try {
      const result = await this.apiGet<{ data: { results: unknown[]; total: number } }>("/lists?per_page=1");
      const listCount = result.data?.total ?? 0;
      log.info({ baseUrl: this.config.baseUrl, listCount }, "Listmonk connection test successful");
      return { success: true, listCount };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      log.warn({ err, baseUrl: this.config.baseUrl }, "Listmonk connection test failed");
      return { success: false, error: message };
    }
  }

  async getTemplates(): Promise<ListmonkTemplate[]> {
    const result = await this.apiGet<{
      data: Array<{
        id: number;
        name: string;
        type: string;
        is_default: boolean;
      }>;
    }>("/templates");

    return (result.data ?? [])
      .filter((t) => t.type === "campaign")
      .map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        isDefault: t.is_default,
      }));
  }

  async getLists(): Promise<ListmonkList[]> {
    const result = await this.apiGet<{
      data: {
        results: Array<{
          id: number;
          name: string;
          type: string;
          optin: string;
          subscriber_count: number;
          tags: string[];
        }>;
      };
    }>("/lists?per_page=100");

    return (result.data?.results ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      optin: l.optin,
      subscriberCount: l.subscriber_count,
      tags: l.tags ?? [],
    }));
  }

  async createDraft(payload: CreateDraftPayload): Promise<CreateDraftResult> {
    const result = await this.apiPost<{ data: { id: number; status: string } }>("/campaigns", {
      name: payload.name,
      subject: payload.subject,
      body: payload.body,
      content_type: "html",
      lists: payload.listIds,
      type: "regular",
      status: "draft",
      template_id: payload.templateId,
      from_email: payload.fromEmail,
      tags: payload.tags ?? ["flowboost"],
    });

    const campaignId = result.data.id;
    const url = `${this.config.baseUrl}/campaigns/${campaignId}`;

    log.info({ campaignId, subject: payload.subject, lists: payload.listIds }, "Listmonk campaign draft created");

    return {
      id: campaignId,
      url,
      status: result.data.status,
    };
  }
}
