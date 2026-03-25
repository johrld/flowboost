import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../utils/logger.js";
import type { ContentMediaAsset } from "./types.js";

const log = createLogger("content-media");

/**
 * Per-content-item media store.
 * Manages `content/{contentId}/media/media.json` + image files.
 *
 * Storage layout:
 *   content/{contentId}/media/
 *     media.json         — JSON array of ContentMediaAsset
 *     {uuid}.png         — image files (ID-based names on disk)
 */
export class ContentMediaStore {
  private mediaDir: string;
  private registryPath: string;

  constructor(contentDir: string) {
    this.mediaDir = path.join(contentDir, "media");
    this.registryPath = path.join(this.mediaDir, "media.json");
  }

  /** List all media assets for this content item */
  list(): ContentMediaAsset[] {
    if (!fs.existsSync(this.registryPath)) return [];
    return JSON.parse(fs.readFileSync(this.registryPath, "utf-8"));
  }

  /** Get a single asset by ID */
  get(id: string): ContentMediaAsset | null {
    return this.list().find((a) => a.id === id) ?? null;
  }

  /** Add a new asset + write its file to disk */
  add(asset: ContentMediaAsset, buffer: Buffer): ContentMediaAsset {
    fs.mkdirSync(this.mediaDir, { recursive: true });

    // Write file
    const filePath = path.join(this.mediaDir, asset.fileName);
    fs.writeFileSync(filePath, buffer);

    // Append to registry
    const assets = this.list();
    assets.push(asset);
    this.writeRegistry(assets);

    log.debug({ id: asset.id, contentId: asset.contentId }, "added media asset");
    return asset;
  }

  /** Delete an asset and its file from disk */
  delete(id: string): boolean {
    const assets = this.list();
    const idx = assets.findIndex((a) => a.id === id);
    if (idx === -1) return false;

    const asset = assets[idx];

    // Remove file
    const filePath = path.join(this.mediaDir, asset.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update registry
    assets.splice(idx, 1);
    this.writeRegistry(assets);

    log.debug({ id, contentId: asset.contentId }, "deleted media asset");
    return true;
  }

  /** Get the absolute path to an asset's file */
  filePath(asset: ContentMediaAsset): string {
    return path.join(this.mediaDir, asset.fileName);
  }

  /** Get the media directory path */
  dir(): string {
    return this.mediaDir;
  }

  private writeRegistry(assets: ContentMediaAsset[]): void {
    fs.writeFileSync(this.registryPath, JSON.stringify(assets, null, 2));
  }
}

/** Factory: create a ContentMediaStore for a specific content item */
export function createContentMediaStore(
  dataDir: string,
  customerId: string,
  projectId: string,
  contentId: string,
): ContentMediaStore {
  const contentDir = path.join(
    dataDir, "customers", customerId, "projects", projectId, "content", contentId,
  );
  return new ContentMediaStore(contentDir);
}
