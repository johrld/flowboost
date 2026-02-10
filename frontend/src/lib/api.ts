import type { Customer, Project, Topic, Category, Author, PipelineRun } from "./types";

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
