import type { Customer, Project, Topic, Category, Author, PipelineRun, ContentItem, ContentVersion, ContentType, ContentItemStatus } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6100";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...init?.headers as Record<string, string> };
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Customers ─────────────────────────────────────────────────────

export function getCustomers(): Promise<Customer[]> {
  return fetchJson("/customers");
}

export function getCustomer(customerId: string): Promise<Customer> {
  return fetchJson(`/customers/${customerId}`);
}

// ── Projects ──────────────────────────────────────────────────────

export function getProjects(customerId: string): Promise<Project[]> {
  return fetchJson(`/customers/${customerId}/projects`);
}

export function getProject(customerId: string, projectId: string): Promise<Project> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}`);
}

export function updateProject(customerId: string, projectId: string, data: Partial<Project>): Promise<Project> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── Project Brief ────────────────────────────────────────────────

export function getProjectBrief(customerId: string, projectId: string): Promise<{ content: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/project-brief`);
}

export function updateProjectBrief(customerId: string, projectId: string, content: string): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/project-brief`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

// ── Brand Voice ──────────────────────────────────────────────────

export function getBrandVoice(customerId: string): Promise<{ content: string }> {
  return fetchJson(`/customers/${customerId}/brand-voice`);
}

export function updateBrandVoice(customerId: string, content: string): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/brand-voice`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

// ── Authors ──────────────────────────────────────────────────────

export function updateAuthors(customerId: string, authors: Author[]): Promise<{ message: string; authors: Author[] }> {
  return fetchJson(`/customers/${customerId}/authors`, {
    method: "PUT",
    body: JSON.stringify({ authors }),
  });
}

// ── Topics ────────────────────────────────────────────────────────

export function getTopics(customerId: string, projectId: string): Promise<Topic[]> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics`);
}

export function approveTopic(customerId: string, projectId: string, topicId: string): Promise<{ message: string; topic: Topic }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/approve`, { method: "POST" });
}

export function rejectTopic(customerId: string, projectId: string, topicId: string, reason?: string): Promise<{ message: string; topic: Topic }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ── Pipeline ──────────────────────────────────────────────────────

export function getPipelineRuns(customerId: string, projectId: string): Promise<PipelineRun[]> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/pipeline/runs`);
}

export function getPipelineRun(customerId: string, projectId: string, runId: string): Promise<PipelineRun> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/pipeline/runs/${runId}`);
}

export function startStrategy(customerId: string, projectId: string): Promise<{ message: string; runId: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/pipeline/strategy`, { method: "POST" });
}

export function startProduction(customerId: string, projectId: string, topicId: string): Promise<{ message: string; runId: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/pipeline/produce`, {
    method: "POST",
    body: JSON.stringify({ topicId }),
  });
}

// ── Content ──────────────────────────────────────────────────────

export function getContent(
  customerId: string,
  projectId: string,
  filters?: { type?: ContentType; status?: ContentItemStatus; category?: string },
): Promise<{ total: number; items: ContentItem[] }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);
  const qs = params.toString();
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content${qs ? `?${qs}` : ""}`);
}

export function getContentItem(
  customerId: string,
  projectId: string,
  contentId: string,
): Promise<ContentItem> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}`);
}

export function createContent(
  customerId: string,
  projectId: string,
  data: { type: ContentType; title: string; description?: string; category?: string; tags?: string[]; keywords?: string[] },
): Promise<ContentItem> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateContent(
  customerId: string,
  projectId: string,
  contentId: string,
  data: Partial<Pick<ContentItem, "title" | "description" | "category" | "tags" | "keywords" | "translationKey">>,
): Promise<ContentItem> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteContent(
  customerId: string,
  projectId: string,
  contentId: string,
  hard?: boolean,
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}${hard ? "?hard=true" : ""}`, {
    method: "DELETE",
  });
}

export function getContentVersions(
  customerId: string,
  projectId: string,
  contentId: string,
): Promise<ContentVersion[]> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/versions`);
}

export async function getContentFile(
  customerId: string,
  projectId: string,
  contentId: string,
  versionId: string,
  lang: string,
): Promise<string> {
  const res = await fetch(
    `${API_URL}/customers/${customerId}/projects/${projectId}/content/${contentId}/versions/${versionId}/file?lang=${lang}`,
  );
  if (!res.ok) throw new Error(`Failed to load content file: ${res.status}`);
  return res.text();
}

// Lifecycle transitions
export function submitContent(customerId: string, projectId: string, contentId: string): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/submit`, { method: "POST" });
}

export function approveContent(customerId: string, projectId: string, contentId: string): Promise<{ message: string; published?: boolean; ref?: string; url?: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/approve`, { method: "POST" });
}

export function rejectContent(customerId: string, projectId: string, contentId: string, reason?: string): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function publishContent(customerId: string, projectId: string, contentId: string, ref?: string): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/publish`, {
    method: "POST",
    body: JSON.stringify({ ref }),
  });
}

export function requestContentUpdate(customerId: string, projectId: string, contentId: string): Promise<{ message: string; published?: boolean; ref?: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/update`, { method: "POST" });
}

export function archiveContent(customerId: string, projectId: string, contentId: string): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/archive`, { method: "POST" });
}

export function restoreContent(customerId: string, projectId: string, contentId: string): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/restore`, { method: "POST" });
}

// ── GitHub ────────────────────────────────────────────────────────

export function getGitHubStatus(): Promise<{ configured: boolean }> {
  return fetchJson("/github/status");
}

export function getGitHubRepos(installationId: number): Promise<{ fullName: string; name: string; owner: string; defaultBranch: string; private: boolean }[]> {
  return fetchJson(`/github/installations/${installationId}/repos`);
}

export function getGitHubBranches(installationId: number, owner: string, repo: string): Promise<string[]> {
  return fetchJson(`/github/repos/${owner}/${repo}/branches?installation_id=${installationId}`);
}

// ── Connector Sync ───────────────────────────────────────────────

export interface ConnectorSyncResult {
  categories?: { id: string; name: Record<string, string>; slug?: Record<string, string>; description?: Record<string, string>; order?: number }[];
  authors?: { id: string; name: string; slug?: string; title?: Record<string, string>; bio?: Record<string, string>; image?: string }[];
  errors: string[];
}

export function syncConnectorData(customerId: string, projectId: string): Promise<ConnectorSyncResult> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/sync`, { method: "POST" });
}

export async function getGitHubFile(installationId: number, owner: string, repo: string, path: string, ref?: string): Promise<string> {
  const params = new URLSearchParams({ installation_id: String(installationId), path });
  if (ref) params.set("ref", ref);
  const res = await fetch(`${API_URL}/github/repos/${owner}/${repo}/file?${params}`);
  if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
  return res.text();
}
