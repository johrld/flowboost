import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../utils/logger.js";
import type { DeliveryConnector, DeliveryResult } from "./types.js";
import type { Article, ArticleVersion, Project } from "../models/types.js";

const log = createLogger("connector:filesystem");

/**
 * Filesystem connector — copies article files to a local directory.
 * Used for development and testing.
 */
export class FilesystemConnector implements DeliveryConnector {
  readonly name = "filesystem";

  constructor(private outputDir: string) {}

  async deliver(
    project: Project,
    article: Article,
    versions: ArticleVersion[],
    versionDir: string,
  ): Promise<DeliveryResult> {
    const filesWritten: string[] = [];
    const contentPath = project.connector.git?.contentPath ?? "src/content/posts";
    const assetsPath = project.connector.git?.assetsPath ?? "src/assets/posts";

    try {
      for (const version of versions) {
        // Copy content file
        const sourceContent = path.join(versionDir, "content", version.lang, `${version.slug}.md`);
        const targetContent = path.join(this.outputDir, contentPath, version.lang, `${version.slug}.md`);

        if (fs.existsSync(sourceContent)) {
          fs.mkdirSync(path.dirname(targetContent), { recursive: true });
          fs.copyFileSync(sourceContent, targetContent);
          filesWritten.push(targetContent);
          log.info({ lang: version.lang, slug: version.slug }, "content file copied");
        }

        // Copy assets (hero image)
        const sourceAssetsDir = path.join(versionDir, "assets", version.lang);
        if (fs.existsSync(sourceAssetsDir)) {
          const targetAssetsDir = path.join(this.outputDir, assetsPath, version.lang);
          fs.mkdirSync(targetAssetsDir, { recursive: true });

          for (const file of fs.readdirSync(sourceAssetsDir)) {
            const src = path.join(sourceAssetsDir, file);
            const dest = path.join(targetAssetsDir, file);
            fs.copyFileSync(src, dest);
            filesWritten.push(dest);
            log.info({ lang: version.lang, file }, "asset file copied");
          }
        }
      }

      log.info({ articleId: article.id, filesWritten: filesWritten.length }, "filesystem delivery complete");
      return { success: true, connector: this.name, filesWritten };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error({ err: error }, "filesystem delivery failed");
      return { success: false, connector: this.name, filesWritten, error: msg };
    }
  }
}
