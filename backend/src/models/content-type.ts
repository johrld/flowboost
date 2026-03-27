import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../utils/logger.js";

const log = createLogger("content-type-store");

// ── Types ─────────────────────────────────────────────────────

export type FieldType =
  | "short-text"
  | "long-text"
  | "rich-text"
  | "markdown"
  | "image"
  | "faq"
  | "cta"
  | "list"
  | "select"
  | "json"
  | "date"
  | "number"
  | "boolean";

export interface CustomFieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  sortOrder: number;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  constraints?: {
    charLimit?: number;
    wordCount?: { min: number; max: number };
    maxItems?: number;
    imageAspectRatio?: string;
    options?: string[];
  };
}

export interface ContentTypeAgent {
  /** Agent role/identity — injected as first line of system prompt */
  role: string;
  /** Markdown guidelines — tone, structure, do/don'ts, examples */
  guidelines: string;
}

export interface ContentTypePipeline {
  /** Pipeline execution mode */
  mode: "single-phase" | "multi-phase";
  /** Ordered list of phase names (e.g. ["write", "image"] or ["research", "outline", "write", "quality", "image", "translate"]) */
  phases: string[];
  /** Whether this content type benefits from SEO enrichment before production */
  requiresEnrichment?: boolean;
  /** Model override for this content type */
  defaultModel?: string;
}

export interface CustomContentType {
  id: string;
  projectId: string;
  label: string;
  description?: string;
  category: "site" | "social" | "email" | "media";
  source: "builtin" | "connector" | "custom";
  connectorType?: string;
  connectorRef?: string;
  icon?: string;
  fields: CustomFieldDefinition[];
  agent?: ContentTypeAgent;
  pipeline?: ContentTypePipeline;
  createdAt: string;
  updatedAt: string;
}

// ── Store ─────────────────────────────────────────────────────

export class ContentTypeStore {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = path.join(basePath, "content-types");
    fs.mkdirSync(this.basePath, { recursive: true });
  }

  list(): CustomContentType[] {
    if (!fs.existsSync(this.basePath)) return [];
    return fs.readdirSync(this.basePath)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.basePath, f), "utf-8")) as CustomContentType;
        } catch {
          return null;
        }
      })
      .filter((ct): ct is CustomContentType => ct !== null);
  }

  get(id: string): CustomContentType | null {
    const filePath = path.join(this.basePath, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as CustomContentType;
  }

  create(data: Omit<CustomContentType, "id" | "createdAt" | "updatedAt">): CustomContentType {
    let id = data.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID();
    // Prevent ID collision — append suffix if file exists
    if (fs.existsSync(path.join(this.basePath, `${id}.json`))) {
      id = `${id}-${Date.now().toString(36)}`;
    }
    const now = new Date().toISOString();
    const ct: CustomContentType = { id, ...data, createdAt: now, updatedAt: now };
    this.save(ct);
    log.info({ id, label: ct.label }, "content type created");
    return ct;
  }

  update(id: string, data: Partial<CustomContentType>): CustomContentType | null {
    const existing = this.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
    this.save(updated);
    log.info({ id }, "content type updated");
    return updated;
  }

  delete(id: string): boolean {
    const filePath = path.join(this.basePath, `${id}.json`);
    if (!fs.existsSync(filePath)) return false;
    const ct = this.get(id);
    if (ct?.source === "builtin") return false; // Protect built-in types
    fs.unlinkSync(filePath);
    log.info({ id }, "content type deleted");
    return true;
  }

  private save(ct: CustomContentType): void {
    fs.writeFileSync(
      path.join(this.basePath, `${ct.id}.json`),
      JSON.stringify(ct, null, 2),
      "utf-8",
    );
  }

  /** Import schemas from a connector as content types */
  importFromConnector(
    projectId: string,
    connectorType: string,
    schemas: Array<{ id: string; label: string; description?: string; category: string; slots: Array<{ id: string; label: string; type: string; required: boolean; constraints?: Record<string, unknown> }> }>,
  ): CustomContentType[] {
    const imported: CustomContentType[] = [];
    for (const schema of schemas) {
      const fields: CustomFieldDefinition[] = schema.slots.map((slot, i) => ({
        id: slot.id,
        label: slot.label,
        type: mapSlotType(slot.type),
        required: slot.required,
        sortOrder: i,
        constraints: slot.constraints as CustomFieldDefinition["constraints"],
      }));

      const ct = this.create({
        projectId,
        label: schema.label,
        description: schema.description,
        category: schema.category as CustomContentType["category"],
        source: "connector",
        connectorType,
        connectorRef: schema.id,
        fields,
      });
      imported.push(ct);
    }
    return imported;
  }
}

function mapSlotType(slotType: string): FieldType {
  switch (slotType) {
    case "text": return "short-text";
    case "html": return "rich-text";
    case "markdown": return "markdown";
    case "image": return "image";
    case "faq": return "faq";
    case "cta": return "cta";
    case "product-list": return "json";
    case "json": return "json";
    default: return "long-text";
  }
}
