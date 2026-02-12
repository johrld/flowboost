import fs from "node:fs";
import path from "node:path";
import { Store } from "./store.js";
import type { ContentItem, ContentVersion, MediaAsset } from "./types.js";

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
}

// ─── Factories ──────────────────────────────────────────────────

export function createContentStore(dataDir: string, customerId: string, projectId: string): ContentStore {
  return new ContentStore(path.join(dataDir, "customers", customerId, "projects", projectId, "content"));
}

export function createMediaAssetStore(dataDir: string, customerId: string, projectId: string): MediaAssetStore {
  return new MediaAssetStore(path.join(dataDir, "customers", customerId, "projects", projectId, "media"));
}
