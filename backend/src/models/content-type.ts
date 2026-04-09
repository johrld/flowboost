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
  /** Example content from an existing page (for AI context during generation) */
  exampleContent?: string;
}

export interface ContentTypeAgent {
  /** Agent role/identity — injected as first line of system prompt */
  role: string;
  /** Markdown guidelines — tone, structure, do/don'ts, examples */
  guidelines: string;
}

export interface ContentTypeLocalization {
  /** single = one language per content piece (social, email). multi = multiple languages (articles). */
  mode: "single" | "multi";
  /** Auto-translate into project languages when generating with AI (only for multi mode) */
  translateOnGenerate?: boolean;
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
  localization?: ContentTypeLocalization;
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
    const files = fs.readdirSync(this.basePath).filter((f) => f.endsWith(".json"));
    const byId = new Map<string, { ct: CustomContentType; fileName: string; mtime: number }>();

    for (const f of files) {
      const filePath = path.join(this.basePath, f);
      try {
        const ct = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CustomContentType;
        const mtime = fs.statSync(filePath).mtimeMs;
        const existing = byId.get(ct.id);

        if (!existing || mtime > existing.mtime) {
          if (existing) {
            // Remove older duplicate
            const oldPath = path.join(this.basePath, existing.fileName);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
              log.info({ id: ct.id, removed: existing.fileName }, "removed duplicate content type file");
            }
          }
          byId.set(ct.id, { ct, fileName: f, mtime });
        } else {
          // This file is older — remove it
          fs.unlinkSync(filePath);
          log.info({ id: ct.id, removed: f }, "removed duplicate content type file");
        }
      } catch { /* skip corrupt files */ }
    }

    // Self-heal: rename files whose name doesn't match their ID
    for (const [id, entry] of byId) {
      const expected = `${id}.json`;
      if (entry.fileName !== expected) {
        const correctPath = path.join(this.basePath, expected);
        try {
          fs.renameSync(path.join(this.basePath, entry.fileName), correctPath);
          log.info({ id, from: entry.fileName, to: expected }, "self-healed mismatched filename");
        } catch (err) {
          log.warn({ id, err }, "failed to self-heal filename");
        }
      }
    }

    return Array.from(byId.values()).map((e) => e.ct);
  }

  get(id: string): CustomContentType | null {
    return this.findById(id)?.ct ?? null;
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
    const found = this.findById(id);
    if (!found) return false;
    if (found.ct.source === "builtin") return false;
    fs.unlinkSync(found.filePath);
    log.info({ id }, "content type deleted");
    // Clean up any remaining duplicate files with the same ID
    this.removeDuplicateFiles(id);
    return true;
  }

  private save(ct: CustomContentType): void {
    fs.writeFileSync(
      path.join(this.basePath, `${ct.id}.json`),
      JSON.stringify(ct, null, 2),
      "utf-8",
    );
  }

  /** Find content type file by ID — fast path first, then directory scan with self-healing */
  private findById(id: string): { ct: CustomContentType; filePath: string } | null {
    // Fast path: filename matches ID
    const expectedPath = path.join(this.basePath, `${id}.json`);
    if (fs.existsSync(expectedPath)) {
      try {
        const ct = JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as CustomContentType;
        if (ct.id === id) return { ct, filePath: expectedPath };
      } catch { /* fall through to scan */ }
    }

    // Slow path: scan directory for mismatched filename
    if (!fs.existsSync(this.basePath)) return null;
    for (const f of fs.readdirSync(this.basePath).filter((f) => f.endsWith(".json"))) {
      const filePath = path.join(this.basePath, f);
      try {
        const ct = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CustomContentType;
        if (ct.id === id) {
          // Self-heal: rename to match ID
          if (f !== `${id}.json` && !fs.existsSync(expectedPath)) {
            fs.renameSync(filePath, expectedPath);
            log.info({ id, from: f, to: `${id}.json` }, "self-healed mismatched filename");
            return { ct, filePath: expectedPath };
          }
          return { ct, filePath };
        }
      } catch { /* skip corrupt files */ }
    }
    return null;
  }

  /** Remove all files containing a given ID (used after primary delete to clean up duplicates) */
  private removeDuplicateFiles(id: string): void {
    if (!fs.existsSync(this.basePath)) return;
    for (const f of fs.readdirSync(this.basePath).filter((f) => f.endsWith(".json"))) {
      const filePath = path.join(this.basePath, f);
      try {
        const ct = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CustomContentType;
        if (ct.id === id) {
          fs.unlinkSync(filePath);
          log.info({ id, file: f }, "removed duplicate file during delete");
        }
      } catch { /* skip */ }
    }
  }

  /** Sync builtin content types from seed directory.
   *  - Missing builtins are copied in
   *  - Outdated builtins are updated (seed is newer)
   *  - Connector and custom types are never touched */
  syncBuiltins(seedDir: string): void {
    if (!fs.existsSync(seedDir)) return;

    const seedFiles = fs.readdirSync(seedDir).filter((f) => f.endsWith(".json"));
    for (const file of seedFiles) {
      try {
        const seed = JSON.parse(fs.readFileSync(path.join(seedDir, file), "utf-8")) as CustomContentType;
        if (seed.source !== "builtin") continue;

        const existing = this.get(seed.id);
        if (!existing) {
          // Missing → copy in
          this.save(seed);
          log.info({ id: seed.id }, "builtin content type added");
        } else if (existing.source === "builtin" && seed.updatedAt > existing.updatedAt) {
          // Outdated → update
          this.save(seed);
          log.info({ id: seed.id }, "builtin content type updated");
        }
      } catch {
        log.warn({ file }, "failed to read seed content type");
      }
    }
  }

  /** Import schemas from a connector as content types */
  importFromConnector(
    projectId: string,
    connectorType: string,
    schemas: Array<{ id: string; label: string; description?: string; category: string; slots: Array<{ id: string; label: string; type: string; required: boolean; constraints?: Record<string, unknown>; exampleContent?: string }> }>,
  ): CustomContentType[] {
    // Load default agent/pipeline from builtin template (if available)
    const defaultCt = connectorType === "shopware" ? this.get("shopware-landing-page") : null;

    const imported: CustomContentType[] = [];
    for (const schema of schemas) {
      const fields: CustomFieldDefinition[] = schema.slots.map((slot, i) => ({
        id: slot.id,
        label: slot.label,
        type: mapSlotType(slot.type),
        required: slot.required,
        sortOrder: i,
        constraints: slot.constraints as CustomFieldDefinition["constraints"],
        exampleContent: slot.exampleContent,
      }));

      // Check if a content type with this connectorRef already exists → update instead of create
      const existing = this.list().find((ct) => ct.connectorRef === schema.id && ct.connectorType === connectorType);
      let ct: CustomContentType;
      if (existing) {
        ct = this.update(existing.id, {
          label: schema.label,
          description: schema.description,
          fields,
          agent: existing.agent ?? defaultCt?.agent,
          pipeline: existing.pipeline ?? defaultCt?.pipeline,
        })!;
        log.info({ id: existing.id, label: schema.label }, "connector content type updated");
      } else {
        ct = this.create({
          projectId,
          label: schema.label,
          description: schema.description,
          category: schema.category as CustomContentType["category"],
          source: "connector",
          connectorType,
          connectorRef: schema.id,
          fields,
          agent: defaultCt?.agent,
          pipeline: defaultCt?.pipeline,
        });
      }
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
