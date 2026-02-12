import type { ContentReader } from "../../services/sync.js";
import type { GitHubContentService } from "../../services/github-content.js";

/**
 * GitHub Content Reader — implements the platform-agnostic ContentReader interface.
 * Wraps GitHubContentService with pre-configured repo credentials.
 */
export class GitHubContentReader implements ContentReader {
  constructor(
    private ghContent: GitHubContentService,
    private config: {
      installationId: number;
      owner: string;
      repo: string;
      branch: string;
      contentPath: string;
    },
  ) {}

  async getContentTree(): Promise<Map<string, { path: string; sha: string }>> {
    return this.ghContent.getContentTree(
      this.config.installationId,
      this.config.owner,
      this.config.repo,
      this.config.branch,
      this.config.contentPath,
    );
  }

  async readFile(filePath: string): Promise<{ content: string; sha: string }> {
    return this.ghContent.readFile(
      this.config.installationId,
      this.config.owner,
      this.config.repo,
      this.config.branch,
      filePath,
    );
  }

  async readFiles(
    paths: string[],
  ): Promise<Map<string, { content: string; sha: string }>> {
    return this.ghContent.readFiles(
      this.config.installationId,
      this.config.owner,
      this.config.repo,
      this.config.branch,
      paths,
    );
  }
}
