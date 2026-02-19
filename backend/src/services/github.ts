import jwt from "jsonwebtoken";
import { createLogger } from "../utils/logger.js";

const log = createLogger("github");

const GITHUB_API = "https://api.github.com";

/**
 * Get GitHub App config from environment.
 */
function getConfig() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

  if (!appId || !privateKeyBase64) {
    throw new Error("Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY_BASE64 env vars");
  }

  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf-8");
  return { appId: Number(appId), privateKey };
}

/**
 * Generate a JWT to authenticate as the GitHub App (10 min TTL).
 */
function generateAppJwt(): string {
  const { appId, privateKey } = getConfig();
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iat: now - 60, // 60s clock drift
      exp: now + 600, // 10 min
      iss: appId,
    },
    privateKey,
    { algorithm: "RS256" },
  );
}

/**
 * Call GitHub API with the given token.
 */
async function githubFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
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

/**
 * POST to GitHub API with the given token.
 */
async function githubPost<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw new Error(`GitHub API ${res.status}: ${bodyText.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

/**
 * PUT to GitHub API with the given token.
 */
async function githubPut<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw new Error(`GitHub API ${res.status}: ${bodyText.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

/**
 * DELETE on GitHub API with the given token.
 */
async function githubDelete(path: string, token: string): Promise<void> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: "DELETE",
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
}

/**
 * Get an installation access token for a specific GitHub App installation.
 * Valid for 1 hour.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const appJwt = generateAppJwt();
  const result = await githubPost<{ token: string }>(
    `/app/installations/${installationId}/access_tokens`,
    appJwt,
  );
  log.debug({ installationId }, "generated installation token");
  return result.token;
}

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
}

/**
 * List repositories accessible to a GitHub App installation.
 */
export async function listRepos(installationId: number): Promise<GitHubRepo[]> {
  const token = await getInstallationToken(installationId);
  const result = await githubFetch<{ repositories: GitHubRepo[] }>(
    "/installation/repositories?per_page=100",
    token,
  );
  log.info({ installationId, count: result.repositories.length }, "listed repos");
  return result.repositories;
}

interface GitHubBranch {
  name: string;
}

/**
 * List branches for a repository.
 */
export async function listBranches(
  installationId: number,
  owner: string,
  repo: string,
): Promise<string[]> {
  const token = await getInstallationToken(installationId);
  const branches = await githubFetch<GitHubBranch[]>(
    `/repos/${owner}/${repo}/branches?per_page=100`,
    token,
  );
  return branches.map((b) => b.name);
}

/**
 * Generate a clone URL with embedded installation token.
 * URL format: https://x-access-token:{token}@github.com/{owner}/{repo}.git
 */
export async function getCloneUrl(
  installationId: number,
  owner: string,
  repo: string,
): Promise<string> {
  const token = await getInstallationToken(installationId);
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
}

/**
 * Create a pull request.
 */
export async function createPullRequest(
  installationId: number,
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string,
): Promise<{ number: number; url: string }> {
  const token = await getInstallationToken(installationId);
  const result = await githubPost<{ number: number; html_url: string }>(
    `/repos/${owner}/${repo}/pulls`,
    token,
    { title, body, head, base },
  );
  log.info({ owner, repo, pr: result.number }, "pull request created");
  return { number: result.number, url: result.html_url };
}

/**
 * Merge a pull request.
 */
export async function mergePullRequest(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  mergeMethod: "merge" | "squash" | "rebase" = "squash",
): Promise<{ sha: string }> {
  const token = await getInstallationToken(installationId);
  const result = await githubPut<{ sha: string; merged: boolean }>(
    `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
    token,
    { merge_method: mergeMethod },
  );
  log.info({ owner, repo, pr: prNumber, sha: result.sha }, "pull request merged");
  return { sha: result.sha };
}

/**
 * Delete a branch.
 */
export async function deleteBranch(
  installationId: number,
  owner: string,
  repo: string,
  branch: string,
): Promise<void> {
  const token = await getInstallationToken(installationId);
  await githubDelete(
    `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    token,
  );
  log.info({ owner, repo, branch }, "branch deleted");
}

/**
 * Get file contents from a repository.
 */
export async function getFileContent(
  installationId: number,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<string> {
  const token = await getInstallationToken(installationId);
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const result = await githubFetch<{ content: string; encoding: string }>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${query}`,
    token,
  );
  return Buffer.from(result.content, "base64").toString("utf-8");
}

/**
 * Check if GitHub App credentials are configured.
 */
export function isConfigured(): boolean {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY_BASE64);
}
