import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../utils/logger.js";
import { MediaAssetStore } from "../models/content.js";
import type { MediaAsset, MediaType, MediaSource } from "../models/types.js";

const log = createLogger("media");

const MIME_TO_TYPE: Record<string, MediaType> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/svg+xml": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
  "application/pdf": "document",
};

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface IngestOptions {
  customerId: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  source?: MediaSource;
  altText?: string;
  title?: string;
  description?: string;
  tags?: string[];
  generationPrompt?: string;
  generationModel?: string;
  generationCostUsd?: number;
}

interface IngestResult {
  asset: MediaAsset;
  thumbnailGenerated: boolean;
}

export class MediaService {
  constructor(private store: MediaAssetStore) {}

  async ingest(opts: IngestOptions): Promise<IngestResult> {
    const type = MIME_TO_TYPE[opts.mimeType] ?? "document";
    const now = new Date().toISOString();

    // Create asset record
    const asset = this.store.create({
      customerId: opts.customerId,
      projectId: opts.projectId,
      type,
      source: opts.source ?? "uploaded",
      mimeType: opts.mimeType,
      fileName: opts.fileName,
      fileSize: opts.buffer.length,
      localPath: "", // set after save
      altText: opts.altText,
      title: opts.title,
      description: opts.description,
      tags: opts.tags ?? [],
      usedBy: [],
      generationPrompt: opts.generationPrompt,
      generationModel: opts.generationModel,
      generationCostUsd: opts.generationCostUsd,
      createdAt: now,
      updatedAt: now,
    });

    // Save original file
    const originalDir = this.store.getOriginalDir(asset.id);
    fs.mkdirSync(originalDir, { recursive: true });
    const originalPath = path.join(originalDir, opts.fileName);
    fs.writeFileSync(originalPath, opts.buffer);

    // Update localPath
    this.store.update(asset.id, {
      localPath: path.join("original", opts.fileName),
    });

    // Extract metadata + generate thumbnail for images
    let thumbnailGenerated = false;
    if (IMAGE_MIMES.has(opts.mimeType)) {
      try {
        const meta = await this.extractImageMeta(opts.buffer);
        const updates: Partial<MediaAsset> = {
          width: meta.width,
          height: meta.height,
        };

        // Generate thumbnail
        const processedDir = this.store.getProcessedDir(asset.id);
        fs.mkdirSync(processedDir, { recursive: true });

        const thumbPath = path.join(processedDir, "thumb-400.webp");
        await this.generateThumbnail(opts.buffer, thumbPath, 400);
        updates.thumbnailPath = path.join("processed", "thumb-400.webp");
        thumbnailGenerated = true;

        this.store.update(asset.id, updates);
      } catch (err) {
        log.warn({ err, assetId: asset.id }, "image metadata/thumbnail failed");
      }
    }

    log.info({
      assetId: asset.id,
      type,
      fileName: opts.fileName,
      fileSize: opts.buffer.length,
      thumbnailGenerated,
    }, "media ingested");

    return {
      asset: this.store.get(asset.id)!,
      thumbnailGenerated,
    };
  }

  private async extractImageMeta(buffer: Buffer): Promise<{ width: number; height: number }> {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    return {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    };
  }

  private async generateThumbnail(buffer: Buffer, outputPath: string, maxWidth: number): Promise<void> {
    const sharp = (await import("sharp")).default;
    await sharp(buffer)
      .resize(maxWidth, undefined, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);
  }

  async generate(opts: {
    customerId: string;
    projectId: string;
    prompt: string;
    aspectRatio?: string;
    title?: string;
    tags?: string[];
  }): Promise<IngestResult> {
    const { generateImageBuffer } = await import("./imagen.js");
    const buffer = await generateImageBuffer(opts.prompt, {
      aspectRatio: opts.aspectRatio as "16:9" | "1:1" | "9:16" | "4:3" | "3:4" | undefined,
    });

    return this.ingest({
      customerId: opts.customerId,
      projectId: opts.projectId,
      fileName: `generated-${Date.now()}.png`,
      mimeType: "image/png",
      buffer,
      source: "generated",
      title: opts.title ?? `Generated: ${opts.prompt.slice(0, 60)}`,
      tags: opts.tags ?? [],
      generationPrompt: opts.prompt,
      generationModel: process.env.IMAGEN_MODEL ?? "imagen-4.0-fast-generate-001",
      generationCostUsd: 0.02,
    });
  }
}
