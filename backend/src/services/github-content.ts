import { getInstallationToken } from "./github.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("github-content");
const GITHUB_API = "https://api.github.com";

/**
 * Reads repository content via GitHub Contents API (no clone needed).
 * Uses Trees API for file listing and Contents API for file reading.
 */
export class GitHubContentService {
  /**
   * Get the full file tree via Git Trees API (single API call).
   * Returns Map of relative paths to their SHA hashes.
   * Only includes files matching the contentPath prefix.
   */
  async getContentTree(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    contentPath: string,
  ): Promise<Map<string, { path: string; sha: string }>> {
    const token = await getInstallationToken(installationId);

    // Get the tree recursively (1 API call for entire repo)
    const tree = await this.githubFetch<{
      sha: string;
      tree: Array<{ path: string; type: string; sha: string }>;
      truncated: boolean;
    }>(
      `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      token,
    );

    if (tree.truncated) {
      log.warn({ owner, repo, branch }, "tree response was truncated (repo too large)");
    }

    // Filter to content files only (e.g. src/content/posts/)
    const prefix = contentPath.endsWith("/") ? contentPath : `${contentPath}/`;
    const result = new Map<string, { path: string; sha: string }>();

    for (const item of tree.tree) {
      if (item.type === "blob" && item.path.startsWith(prefix) && item.path.endsWith(".md")) {
        result.set(item.path, { path: item.path, sha: item.sha });
      }
    }

    log.info(
      { owner, repo, branch, contentPath, files: result.size },
      "content tree loaded",
    );

    return result;
  }

  /**
   * Read a single file via Contents API (base64 decoded).
   */
  async readFile(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ): Promise<{ content: string; sha: string }> {
    const token = await getInstallationToken(installationId);

    const file = await this.githubFetch<{
      content: string;
      sha: string;
      encoding: string;
    }>(
      `/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
      token,
    );

    const content =
      file.encoding === "base64"
        ? Buffer.from(file.content, "base64").toString("utf-8")
        : file.content;

    return { content, sha: file.sha };
  }

  /**
   * Read multiple files in parallel with throttling.
   * Batch size: 10 concurrent requests, 100ms pause between batches.
   */
  async readFiles(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    paths: string[],
  ): Promise<Map<string, { content: string; sha: string }>> {
    const result = new Map<string, { content: string; sha: string }>();
    const batchSize = 10;

    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((p) =>
          this.readFile(installationId, owner, repo, branch, p).then(
            (data) => ({ path: p, ...data }),
          ),
        ),
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          result.set(r.value.path, {
            content: r.value.content,
            sha: r.value.sha,
          });
        } else {
          log.warn({ error: r.reason }, "failed to read file");
        }
      }

      // Throttle between batches
      if (i + batchSize < paths.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    log.info(
      { owner, repo, total: paths.length, read: result.size },
      "batch file read complete",
    );

    return result;
  }

  private async githubFetch<T>(apiPath: string, token: string): Promise<T> {
    const res = await fetch(`${GITHUB_API}${apiPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
    }

    return res.json() as Promise<T>;
  }
}
