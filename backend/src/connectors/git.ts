import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { simpleGit, type SimpleGit } from "simple-git";
import { createLogger } from "../utils/logger.js";
import type { DeliveryConnector, DeliveryResult } from "./types.js";
import type { Article, ArticleVersion, Project } from "../models/types.js";

const log = createLogger("connector:git");

/**
 * Git connector — clones repo, writes article files, commits, and pushes.
 * Used for production delivery to Coolify-deployed sites.
 */
export class GitConnector implements DeliveryConnector {
  readonly name = "git";

  async deliver(
    project: Project,
    article: Article,
    versions: ArticleVersion[],
    versionDir: string,
  ): Promise<DeliveryResult> {
    const gitConfig = project.connector.git;
    if (!gitConfig) {
      return { success: false, connector: this.name, filesWritten: [], error: "No git connector config" };
    }

    const filesWritten: string[] = [];
    const workDir = path.join(os.tmpdir(), `flowboost-delivery-${article.id}`);

    try {
      // Clean up any previous attempt
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true });
      }

      // Clone the repository
      log.info({ repo: gitConfig.repoUrl, branch: gitConfig.branch }, "cloning repository");
      const git: SimpleGit = simpleGit();
      await git.clone(gitConfig.repoUrl, workDir, ["--branch", gitConfig.branch, "--depth", "1"]);

      const repoGit = simpleGit(workDir);

      // Create a feature branch for the article
      const branchName = `content/${article.translationKey}`;
      await repoGit.checkoutLocalBranch(branchName);

      // Copy article files into the repo
      for (const version of versions) {
        // Content file
        const sourceContent = path.join(versionDir, "content", version.lang, `${version.slug}.md`);
        const targetContent = path.join(workDir, gitConfig.contentPath, version.lang, `${version.slug}.md`);

        if (fs.existsSync(sourceContent)) {
          fs.mkdirSync(path.dirname(targetContent), { recursive: true });
          fs.copyFileSync(sourceContent, targetContent);
          filesWritten.push(path.join(gitConfig.contentPath, version.lang, `${version.slug}.md`));
          log.info({ lang: version.lang, slug: version.slug }, "content file added");
        }

        // Asset files (hero image)
        const sourceAssetsDir = path.join(versionDir, "assets", version.lang);
        if (fs.existsSync(sourceAssetsDir)) {
          const targetAssetsDir = path.join(workDir, gitConfig.assetsPath, version.lang);
          fs.mkdirSync(targetAssetsDir, { recursive: true });

          for (const file of fs.readdirSync(sourceAssetsDir)) {
            const src = path.join(sourceAssetsDir, file);
            const dest = path.join(targetAssetsDir, file);
            fs.copyFileSync(src, dest);
            filesWritten.push(path.join(gitConfig.assetsPath, version.lang, file));
            log.info({ lang: version.lang, file }, "asset file added");
          }
        }
      }

      if (filesWritten.length === 0) {
        return { success: false, connector: this.name, filesWritten: [], error: "No files to deliver" };
      }

      // Stage, commit, push
      await repoGit.add(filesWritten);

      const languages = versions.map((v) => v.lang).join(", ");
      const commitMessage = `feat(content): add ${article.translationKey} (${languages})`;
      await repoGit.commit(commitMessage);

      log.info({ branch: branchName, files: filesWritten.length }, "pushing to remote");
      await repoGit.push("origin", branchName, ["--set-upstream"]);

      // Get commit hash
      const logResult = await repoGit.log({ maxCount: 1 });
      const commitHash = logResult.latest?.hash;

      log.info({ commitHash, branch: branchName }, "git delivery complete");

      // Clean up
      fs.rmSync(workDir, { recursive: true });

      return { success: true, connector: this.name, filesWritten, commitHash };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error({ err: error }, "git delivery failed");

      // Clean up on failure
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true });
      }

      return { success: false, connector: this.name, filesWritten, error: msg };
    }
  }
}
