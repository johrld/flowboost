import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../utils/logger.js";
import type {
  ContentIndex,
  ContentIndexEntry,
  ContentRevision,
  ContentStatus,
  Publication,
} from "./types.js";

const log = createLogger("content-index");

const SCHEMA_VERSION = 1;

/**
 * File-based Content Index store.
 * Stores: data/customers/{cid}/projects/{pid}/content-index.json
 * Revisions: data/customers/{cid}/projects/{pid}/revisions/{contentId}.json
 */
export class ContentIndexStore {
  constructor(private dataDir: string) {}

  private indexPath(customerId: string, projectId: string): string {
    return path.join(
      this.dataDir,
      "customers",
      customerId,
      "projects",
      projectId,
      "content-index.json",
    );
  }

  private revisionsDir(customerId: string, projectId: string): string {
    return path.join(
      this.dataDir,
      "customers",
      customerId,
      "projects",
      projectId,
      "revisions",
    );
  }

  // ─── Load / Save ──────────────────────────────────────────────

  async load(customerId: string, projectId: string): Promise<ContentIndex> {
    const filePath = this.indexPath(customerId, projectId);
    if (!fs.existsSync(filePath)) {
      return {
        projectId,
        lastSyncedAt: "",
        schemaVersion: SCHEMA_VERSION,
        entries: [],
      };
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  async save(customerId: string, projectId: string, index: ContentIndex): Promise<void> {
    const filePath = this.indexPath(customerId, projectId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(index, null, 2), "utf-8");
    log.debug({ customerId, projectId, entries: index.entries.length }, "index saved");
  }

  // ─── Queries ──────────────────────────────────────────────────

  getByTranslationKey(
    index: ContentIndex,
    key: string,
  ): ContentIndexEntry | undefined {
    return index.entries.find(
      (e) => e.site?.translationKey === key,
    );
  }

  getByStatus(index: ContentIndex, status: ContentStatus): ContentIndexEntry[] {
    return index.entries.filter((e) => e.status === status);
  }

  getByChannel(
    index: ContentIndex,
    channel: "website" | "social",
  ): ContentIndexEntry[] {
    return index.entries.filter((e) => e.channel === channel);
  }

  getBySource(
    index: ContentIndex,
    source: "flowboost" | "external",
  ): ContentIndexEntry[] {
    return index.entries.filter((e) => e.source === source);
  }

  getByPlatform(index: ContentIndex, platform: string): ContentIndexEntry[] {
    return index.entries.filter((e) =>
      e.publications.some((p) => p.platform === platform),
    );
  }

  getById(index: ContentIndex, id: string): ContentIndexEntry | undefined {
    return index.entries.find((e) => e.id === id);
  }

  // ─── Mutations (return new index, caller must save) ───────────

  upsertEntry(index: ContentIndex, entry: ContentIndexEntry): ContentIndex {
    const existing = index.entries.findIndex((e) => e.id === entry.id);
    const entries = [...index.entries];
    if (existing >= 0) {
      entries[existing] = entry;
    } else {
      entries.push(entry);
    }
    return { ...index, entries };
  }

  updateStatus(
    index: ContentIndex,
    id: string,
    status: ContentStatus,
  ): ContentIndex {
    const entries = index.entries.map((e) =>
      e.id === id ? { ...e, status, lastUpdatedAt: new Date().toISOString() } : e,
    );
    return { ...index, entries };
  }

  addPublication(
    index: ContentIndex,
    id: string,
    pub: Publication,
  ): ContentIndex {
    const entries = index.entries.map((e) =>
      e.id === id
        ? { ...e, publications: [...e.publications, pub] }
        : e,
    );
    return { ...index, entries };
  }

  updatePublication(
    index: ContentIndex,
    id: string,
    platform: string,
    update: Partial<Publication>,
  ): ContentIndex {
    const entries = index.entries.map((e) => {
      if (e.id !== id) return e;
      const publications = e.publications.map((p) =>
        p.platform === platform ? { ...p, ...update } : p,
      );
      return { ...e, publications };
    });
    return { ...index, entries };
  }

  removeEntry(index: ContentIndex, id: string): ContentIndex {
    return {
      ...index,
      entries: index.entries.filter((e) => e.id !== id),
    };
  }

  // ─── Versioning ───────────────────────────────────────────────

  async addRevision(
    customerId: string,
    projectId: string,
    revision: ContentRevision,
  ): Promise<void> {
    const dir = this.revisionsDir(customerId, projectId);
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${revision.contentId}.json`);
    let revisions: ContentRevision[] = [];

    if (fs.existsSync(filePath)) {
      revisions = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }

    revisions.push(revision);
    fs.writeFileSync(filePath, JSON.stringify(revisions, null, 2), "utf-8");
    log.debug(
      { contentId: revision.contentId, version: revision.version },
      "revision added",
    );
  }

  async getRevisions(
    customerId: string,
    projectId: string,
    contentId: string,
  ): Promise<ContentRevision[]> {
    const filePath = path.join(
      this.revisionsDir(customerId, projectId),
      `${contentId}.json`,
    );
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
}
