import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import type { ContentReader } from "../../services/sync.js";
import type { SiteConnector, WriteResult, UnpublishResult } from "./types.js";
import type { ContentItem, LanguageVariant, Project } from "../../models/types.js";
import { findConnector } from "../../models/types.js";

const log = createLogger("connector:filesystem");

/**
 * Filesystem Site Connector — for development and testing.
 *
 * Write = publish (files are immediately "live" on disk).
 * No reader (no remote to sync from).
 */
export class FilesystemSiteConnector implements SiteConnector {
  readonly platform = "filesystem";

  constructor(private outputDir: string) {}

  createReader(): ContentReader {
    throw new Error("Filesystem connector has no remote reader (local only)");
  }

  async write(
    project: Project,
    contentItem: ContentItem,
    languages: LanguageVariant[],
    versionDir: string,
  ): Promise<WriteResult> {
    const filesWritten: string[] = [];
    const gitConn = findConnector(project, "git");
    const ghConn = findConnector(project, "github");
    const contentPath = gitConn?.git?.contentPath
      ?? ghConn?.github?.contentPath
      ?? "src/content/posts";
    const assetsPath = gitConn?.git?.assetsPath
      ?? ghConn?.github?.assetsPath
      ?? "src/assets/posts";

    try {
      for (const lang of languages) {
        const sourceContent = path.join(versionDir, "content", lang.lang, `${lang.slug}.md`);
        const targetContent = path.join(this.outputDir, contentPath, lang.lang, `${lang.slug}.md`);

        if (fs.existsSync(sourceContent)) {
          fs.mkdirSync(path.dirname(targetContent), { recursive: true });
          fs.copyFileSync(sourceContent, targetContent);
          filesWritten.push(targetContent);
        }

        const sourceAssetsDir = path.join(versionDir, "assets", lang.lang);
        if (fs.existsSync(sourceAssetsDir)) {
          const targetAssetsDir = path.join(this.outputDir, assetsPath, lang.lang);
          fs.mkdirSync(targetAssetsDir, { recursive: true });
          for (const file of fs.readdirSync(sourceAssetsDir)) {
            fs.copyFileSync(
              path.join(sourceAssetsDir, file),
              path.join(targetAssetsDir, file),
            );
            filesWritten.push(path.join(targetAssetsDir, file));
          }
        }
      }

      log.info({ contentId: contentItem.id, files: filesWritten.length }, "filesystem write complete");

      return {
        success: true,
        ref: contentItem.id,
        published: true, // Filesystem: write = publish
        filesWritten,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error({ err: error }, "filesystem write failed");
      return { success: false, ref: "", published: false, filesWritten, error: msg };
    }
  }

  async update(
    project: Project,
    contentItem: ContentItem,
    languages: LanguageVariant[],
    versionDir: string,
    _previousRef?: string,
  ): Promise<WriteResult> {
    // Filesystem update = overwrite (same as write)
    return this.write(project, contentItem, languages, versionDir);
  }

  async unpublish(ref: string, _options?: { soft?: boolean }): Promise<UnpublishResult> {
    // For filesystem, unpublish = delete the files
    // ref is the article ID — we'd need to know the file paths
    log.info({ ref }, "filesystem unpublish (files remain — manual cleanup needed)");
    return { success: true, ref };
  }

  // No publish() needed — write() already publishes
}
