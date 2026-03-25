import fs from "node:fs";
import path from "node:path";
import { Store } from "./store.js";
import type { ContentItem, ContentVersion, MediaAsset, MediaFilter, MediaUsageRef } from "./types.js";

export class ContentStore extends Store<ContentItem> {
  constructor(basePath: string) {
    super(basePath, "content.json");
  }

  // ─── Versions ──────────────────────────────────────────────────

  createVersion(contentId: string, version: Omit<ContentVersion, "id" | "versionNumber">): ContentVersion {
    const existing = this.getVersions(contentId);
    const versionNumber = existing.length > 0
      ? Math.max(...existing.map((v) => v.versionNumber)) + 1
      : 1;

    const id = crypto.randomUUID();
    const v: ContentVersion = { id, versionNumber, ...version };
    const dir = path.join(this.entityDir(contentId), "versions", id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "version.json"), JSON.stringify(v, null, 2));
    return v;
  }

  getVersions(contentId: string): ContentVersion[] {
    const versionsDir = path.join(this.entityDir(contentId), "versions");
    if (!fs.existsSync(versionsDir)) return [];
    return fs
      .readdirSync(versionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const vPath = path.join(versionsDir, d.name, "version.json");
        if (!fs.existsSync(vPath)) return null;
        return JSON.parse(fs.readFileSync(vPath, "utf-8")) as ContentVersion;
      })
      .filter((v): v is ContentVersion => v !== null)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  getVersion(contentId: string, versionId: string): ContentVersion | null {
    const vPath = path.join(this.entityDir(contentId), "versions", versionId, "version.json");
    if (!fs.existsSync(vPath)) return null;
    return JSON.parse(fs.readFileSync(vPath, "utf-8")) as ContentVersion;
  }

  getLatestVersion(contentId: string): ContentVersion | null {
    const versions = this.getVersions(contentId);
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  updateVersion(contentId: string, versionId: string, updates: Partial<ContentVersion>): ContentVersion | null {
    const version = this.getVersion(contentId, versionId);
    if (!version) return null;
    const updated = { ...version, ...updates };
    const vPath = path.join(this.entityDir(contentId), "versions", versionId, "version.json");
    fs.writeFileSync(vPath, JSON.stringify(updated, null, 2));
    return updated;
  }

  getVersionDir(contentId: string, versionId: string): string {
    return path.join(this.entityDir(contentId), "versions", versionId);
  }
}

// ─── Media Asset Store ──────────────────────────────────────────

export class MediaAssetStore extends Store<MediaAsset> {
  constructor(basePath: string) {
    super(basePath, "asset.json");
  }

  getOriginalDir(assetId: string): string {
    return path.join(this.entityDir(assetId), "original");
  }

  getProcessedDir(assetId: string): string {
    return path.join(this.entityDir(assetId), "processed");
  }

  /** List assets with filters and pagination */
  listFiltered(filter: MediaFilter): { total: number; assets: MediaAsset[] } {
    let assets = this.list();

    if (filter.type) assets = assets.filter(a => a.type === filter.type);
    if (filter.source) assets = assets.filter(a => a.source === filter.source);
    if (filter.tags?.length) {
      assets = assets.filter(a => a.tags?.some(t => filter.tags!.includes(t)));
    }
    if (filter.unused) {
      assets = assets.filter(a => !a.usedBy || a.usedBy.length === 0);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      assets = assets.filter(a =>
        a.fileName.toLowerCase().includes(q) ||
        a.title?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.altText?.toLowerCase().includes(q) ||
        a.tags?.some(t => t.toLowerCase().includes(q)) ||
        a.generationPrompt?.toLowerCase().includes(q)
      );
    }

    // Sort by newest first
    assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = assets.length;
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const start = (page - 1) * limit;
    assets = assets.slice(start, start + limit);

    return { total, assets };
  }

  /** Get all unique tags with counts */
  listTags(): { tag: string; count: number }[] {
    const tagMap = new Map<string, number>();
    for (const asset of this.list()) {
      for (const tag of asset.tags ?? []) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Add a usage reference to an asset */
  addUsage(assetId: string, ref: MediaUsageRef): MediaAsset | null {
    const asset = this.get(assetId);
    if (!asset) return null;
    const usedBy = asset.usedBy ?? [];
    // Don't add duplicate
    if (usedBy.some(u => u.contentId === ref.contentId && u.role === ref.role)) return asset;
    usedBy.push(ref);
    return this.update(assetId, { usedBy, updatedAt: new Date().toISOString() } as Partial<MediaAsset>);
  }

  /** Remove all usage references for a content item */
  removeUsage(assetId: string, contentId: string): MediaAsset | null {
    const asset = this.get(assetId);
    if (!asset) return null;
    const usedBy = (asset.usedBy ?? []).filter(u => u.contentId !== contentId);
    return this.update(assetId, { usedBy, updatedAt: new Date().toISOString() } as Partial<MediaAsset>);
  }

  /** Bulk delete assets */
  bulkDelete(assetIds: string[]): { deleted: string[]; failed: string[] } {
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const id of assetIds) {
      if (this.delete(id)) deleted.push(id);
      else failed.push(id);
    }
    return { deleted, failed };
  }

  /** Bulk update tags on multiple assets */
  bulkUpdateTags(assetIds: string[], addTags: string[], removeTags: string[]): MediaAsset[] {
    const updated: MediaAsset[] = [];
    const now = new Date().toISOString();
    for (const id of assetIds) {
      const asset = this.get(id);
      if (!asset) continue;
      let tags = asset.tags ?? [];
      tags = tags.filter(t => !removeTags.includes(t));
      for (const t of addTags) {
        if (!tags.includes(t)) tags.push(t);
      }
      const result = this.update(id, { tags, updatedAt: now } as Partial<MediaAsset>);
      if (result) updated.push(result);
    }
    return updated;
  }
}

// ─── Factories ──────────────────────────────────────────────────

export function createContentStore(dataDir: string, customerId: string, projectId: string): ContentStore {
  return new ContentStore(path.join(dataDir, "customers", customerId, "projects", projectId, "content"));
}

export function createMediaAssetStore(dataDir: string, customerId: string, projectId: string): MediaAssetStore {
  return new MediaAssetStore(path.join(dataDir, "customers", customerId, "projects", projectId, "media"));
}
