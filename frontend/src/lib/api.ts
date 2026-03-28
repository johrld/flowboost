import type { Customer, Project, Topic, Category, Author, PipelineRun, ContentItem, ContentVersion, ContentType, ContentItemStatus, ContentIndex, ChatMessage, FlowInput, MediaAsset } from "./types";

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

export function createProject(
  customerId: string,
  data: {
    name: string;
    description?: string;
    defaultLanguage: string;
    languages?: { code: string; name: string; enabled: boolean }[];
    categories?: { id: string; labels: Record<string, string> }[];
  },
): Promise<Project> {
  return fetchJson(`/customers/${customerId}/projects`, {
    method: "POST",
    body: JSON.stringify(data),
  });
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

export function restoreTopic(customerId: string, projectId: string, topicId: string): Promise<{ message: string; topic: Topic }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/restore`, { method: "POST" });
}

export function createTopic(
  customerId: string,
  projectId: string,
  data: { title: string; category?: string; userNotes?: string; direction?: string },
): Promise<Topic> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTopic(
  customerId: string,
  projectId: string,
  topicId: string,
): Promise<Topic | null> {
  try {
    return await fetchJson<Topic>(`/customers/${customerId}/projects/${projectId}/topics/${topicId}`);
  } catch {
    return null;
  }
}

export function updateTopic(
  customerId: string,
  projectId: string,
  topicId: string,
  data: Partial<Topic>,
): Promise<{ message: string; topic: Topic }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateTopicNotes(
  customerId: string,
  projectId: string,
  topicId: string,
  userNotes: string,
): Promise<{ message: string; topic: Topic }> {
  return updateTopic(customerId, projectId, topicId, { userNotes });
}

export function deleteTopic(
  customerId: string,
  projectId: string,
  topicId: string,
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}`, {
    method: "DELETE",
  });
}

// ── Topic Chat ───────────────────────────────────────────────────

export function getTopicChat(
  customerId: string,
  projectId: string,
  topicId: string,
): Promise<ChatMessage[]> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/chat`);
}

export function sendTopicChat(
  customerId: string,
  projectId: string,
  topicId: string,
  message: string,
): Promise<{ reply: string; topic: Topic; suggestedUpdates?: Partial<Topic> }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function applyTopicChatUpdates(
  customerId: string,
  projectId: string,
  topicId: string,
  updates: Partial<Topic>,
): Promise<{ message: string; topic: Topic }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/chat/apply`, {
    method: "POST",
    body: JSON.stringify({ updates }),
  });
}

// ── Flow Inputs ──────────────────────────────────────────────

export function addFlowInput(
  customerId: string,
  projectId: string,
  topicId: string,
  data: { type: string; content: string; fileName?: string },
): Promise<FlowInput> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/inputs`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function uploadFlowFile(
  customerId: string,
  projectId: string,
  topicId: string,
  file: File,
): Promise<FlowInput> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(
    `${API_URL}/customers/${customerId}/projects/${projectId}/topics/${topicId}/inputs/upload`,
    { method: "POST", body: formData },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Upload failed: ${res.status}`);
  }
  return res.json() as Promise<FlowInput>;
}

export function deleteFlowInput(
  customerId: string,
  projectId: string,
  topicId: string,
  inputId: string,
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/inputs/${inputId}`, {
    method: "DELETE",
  });
}

export function getFlowInputFileUrl(
  customerId: string,
  projectId: string,
  topicId: string,
  inputId: string,
): string {
  return `${API_URL}/customers/${customerId}/projects/${projectId}/topics/${topicId}/inputs/${inputId}/file`;
}

// ── Input Processing ─────────────────────────────────────────────

export function reprocessFlowInput(
  customerId: string,
  projectId: string,
  topicId: string,
  inputId: string,
  note?: string,
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/inputs/${inputId}/reprocess`, {
    method: "POST",
    body: JSON.stringify(note ? { note } : {}),
  });
}

export function distillTopicChat(
  customerId: string,
  projectId: string,
  topicId: string,
): Promise<{ message: string; distillation: unknown }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/distill`, {
    method: "POST",
  });
}

// ── Flow Produce ────────────────────────────────────────────

export function produceFlowOutput(
  customerId: string,
  projectId: string,
  topicId: string,
  data: { contentTypeId: string } | { type: string; platform?: string },
): Promise<{ message: string; contentItemId: string; contentTypeId?: string; flowId: string; runId: string; type: string; platform?: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/topics/${topicId}/produce`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Content Types ───────────────────────────────────────────────

export interface ContentTypeDefinition {
  id: string;
  label: string;
  description?: string;
  category: "site" | "social" | "email" | "media";
  source: "builtin" | "connector" | "custom";
  connectorType?: string;
  connectorRef?: string;
  icon?: string;
  fields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    sortOrder: number;
    constraints?: Record<string, unknown>;
  }>;
  agent?: {
    role: string;
    guidelines: string;
  };
}

export function getContentTypes(
  customerId: string,
  projectId: string,
): Promise<ContentTypeDefinition[]> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content-types`);
}

export function createContentType(
  customerId: string,
  projectId: string,
  data: { label: string; description?: string; category?: string; fields?: ContentTypeDefinition["fields"]; agent?: ContentTypeDefinition["agent"] },
): Promise<ContentTypeDefinition> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content-types`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateContentType(
  customerId: string,
  projectId: string,
  typeId: string,
  data: Partial<ContentTypeDefinition>,
): Promise<ContentTypeDefinition> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content-types/${typeId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteContentType(
  customerId: string,
  projectId: string,
  typeId: string,
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content-types/${typeId}`, {
    method: "DELETE",
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
  data: Partial<Pick<ContentItem, "title" | "description" | "category" | "tags" | "keywords" | "author" | "translationKey" | "heroImageId" | "scheduledDate">>,
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

export async function getContentJson(
  customerId: string,
  projectId: string,
  contentId: string,
  versionId: string,
  lang: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${API_URL}/customers/${customerId}/projects/${projectId}/content/${contentId}/versions/${versionId}/file?lang=${lang}`,
  );
  if (!res.ok) throw new Error(`Failed to load content data: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

export function createContentVersion(
  customerId: string,
  projectId: string,
  contentId: string,
  files: Record<string, string>,
  createdByName?: string,
  forceNew?: boolean,
): Promise<ContentVersion> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/versions`, {
    method: "POST",
    body: JSON.stringify({ files, createdBy: "user", ...(createdByName ? { createdByName } : {}), ...(forceNew ? { forceNew: true } : {}) }),
  });
}

export function deleteContentVersion(
  customerId: string,
  projectId: string,
  contentId: string,
  versionId: string,
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/versions/${versionId}`, {
    method: "DELETE",
  });
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

// ── Content Media ────────────────────────────────────────────────

export function getContentMedia(
  customerId: string,
  projectId: string,
  contentId: string,
): Promise<{ total: number; assets: MediaAsset[] }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/media`);
}

export function generateHeroImage(
  customerId: string,
  projectId: string,
  contentId: string,
  prompt: string,
  aspectRatio?: "16:9" | "1:1" | "9:16" | "4:3" | "3:4",
): Promise<MediaAsset> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/media/generate`, {
    method: "POST",
    body: JSON.stringify({ prompt, aspectRatio }),
  });
}

export function generateContentImage(
  customerId: string,
  projectId: string,
  contentId: string,
  prompt: string,
  options?: { aspectRatio?: "16:9" | "1:1" | "9:16" | "4:3" | "3:4"; role?: "hero" | "inline" },
): Promise<MediaAsset> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/media/generate`, {
    method: "POST",
    body: JSON.stringify({ prompt, aspectRatio: options?.aspectRatio, role: options?.role ?? "hero" }),
  });
}

export async function uploadContentMedia(
  customerId: string,
  projectId: string,
  contentId: string,
  file: File,
  role: "hero" | "inline" = "hero",
): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("role", role);
  const res = await fetch(
    `${API_URL}/customers/${customerId}/projects/${projectId}/content/${contentId}/media/upload`,
    { method: "POST", body: formData },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Upload failed: ${res.status}`);
  }
  return res.json() as Promise<MediaAsset>;
}

export function linkMediaToContent(
  customerId: string,
  projectId: string,
  contentId: string,
  assetId: string,
  role: "hero" | "inline" = "inline",
): Promise<{ assetId: string; contentId: string; role: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/media/link`, {
    method: "POST",
    body: JSON.stringify({ assetId, role }),
  });
}

export function reconcileContentMedia(
  customerId: string,
  projectId: string,
  contentId: string,
  inlineAssetIds: string[],
): Promise<{ added: number; removed: number }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/media/reconcile`, {
    method: "POST",
    body: JSON.stringify({ inlineAssetIds }),
  });
}

export function setHeroImage(
  customerId: string,
  projectId: string,
  contentId: string,
  assetId: string | null,
): Promise<{ contentId: string; heroImageId: string | null }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/hero`, {
    method: "PUT",
    body: JSON.stringify({ assetId }),
  });
}

export function deleteContentMedia(
  customerId: string,
  projectId: string,
  contentId: string,
  assetId: string,
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content/${contentId}/media/${assetId}`, {
    method: "DELETE",
  });
}

// ── Content Index ────────────────────────────────────────────────

export function getContentIndex(
  customerId: string,
  projectId: string,
  filters?: { channel?: string; status?: string; source?: string; lang?: string },
): Promise<ContentIndex> {
  const params = new URLSearchParams();
  if (filters?.channel) params.set("channel", filters.channel);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.source) params.set("source", filters.source);
  if (filters?.lang) params.set("lang", filters.lang);
  const qs = params.toString();
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content-index${qs ? `?${qs}` : ""}`);
}

export function syncContentIndex(
  customerId: string,
  projectId: string,
): Promise<{ added: number; updated: number; removed: number; total: number }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content-index/sync`, { method: "POST" });
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

// ── Media Library ────────────────────────────────────────────────

export function getMedia(
  customerId: string,
  projectId: string,
  filters?: { type?: string; source?: string; tags?: string; search?: string; unused?: boolean; page?: number; limit?: number },
): Promise<{ total: number; assets: MediaAsset[] }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.source) params.set("source", filters.source);
  if (filters?.tags) params.set("tags", filters.tags);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.unused) params.set("unused", "true");
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return fetchJson(`/customers/${customerId}/projects/${projectId}/media${qs ? `?${qs}` : ""}`);
}

export function getMediaTags(
  customerId: string,
  projectId: string,
): Promise<{ tags: { tag: string; count: number }[] }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/media/tags`);
}

export function getMediaAsset(
  customerId: string,
  projectId: string,
  assetId: string,
): Promise<MediaAsset> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/media/${assetId}`);
}

export function updateMediaAsset(
  customerId: string,
  projectId: string,
  assetId: string,
  data: { title?: string; description?: string; tags?: string[]; altText?: string },
): Promise<MediaAsset> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/media/${assetId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteMediaAsset(
  customerId: string,
  projectId: string,
  assetId: string,
  force?: boolean,
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/media/${assetId}${force ? "?force=true" : ""}`, {
    method: "DELETE",
  });
}

export async function uploadMedia(
  customerId: string,
  projectId: string,
  file: File,
  metadata?: { title?: string; description?: string; tags?: string[] },
): Promise<{ asset: MediaAsset; thumbnailGenerated: boolean }> {
  const formData = new FormData();
  formData.append("file", file);
  if (metadata?.title) formData.append("title", metadata.title);
  if (metadata?.description) formData.append("description", metadata.description);
  if (metadata?.tags) formData.append("tags", JSON.stringify(metadata.tags));
  const res = await fetch(
    `${API_URL}/customers/${customerId}/projects/${projectId}/media/upload`,
    { method: "POST", body: formData },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function bulkUpdateMedia(
  customerId: string,
  projectId: string,
  data: { assetIds: string[]; addTags?: string[]; removeTags?: string[] },
): Promise<{ updated: string[]; notFound: string[] }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/media/bulk/update`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function bulkDeleteMedia(
  customerId: string,
  projectId: string,
  assetIds: string[],
  force?: boolean,
): Promise<{ deleted: string[]; notFound: string[]; inUse: string[] }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/media/bulk/delete`, {
    method: "POST",
    body: JSON.stringify({ assetIds, force }),
  });
}

export function getMediaFileUrl(customerId: string, projectId: string, assetId: string): string {
  return `${API_URL}/customers/${customerId}/projects/${projectId}/media/${assetId}/file`;
}

export function getMediaThumbnailUrl(customerId: string, projectId: string, assetId: string): string {
  return `${API_URL}/customers/${customerId}/projects/${projectId}/media/${assetId}/thumbnail`;
}

export function addMediaUsage(
  customerId: string,
  projectId: string,
  assetId: string,
  contentId: string,
  role: "hero" | "inline" | "thumbnail" | "attachment" | "social_media",
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/media/${assetId}/usage`, {
    method: "POST",
    body: JSON.stringify({ contentId, role }),
  });
}

export function removeMediaUsage(
  customerId: string,
  projectId: string,
  assetId: string,
  contentId: string,
): Promise<{ message: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/media/${assetId}/usage/${contentId}`, {
    method: "DELETE",
  });
}

// ── Connectors ───────────────────────────────────────────────────

export function testConnector(
  customerId: string,
  projectId: string,
  data: { type: string; config: Record<string, string | undefined> },
): Promise<{ success: boolean; error?: string; shopName?: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/connectors/test`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getConnectorSchemas(
  customerId: string,
  projectId: string,
): Promise<{ schemas: Array<{ id: string; label: string; description: string; slots: unknown[] }> }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/connectors/schemas`);
}

export function importConnectorSchemas(
  customerId: string,
  projectId: string,
  schemaIds?: string[],
): Promise<{ types: Array<{ id: string; label: string }> }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/content-types/import`, {
    method: "POST",
    body: JSON.stringify(schemaIds ? { schemaIds } : {}),
  });
}

export function browseConnector(
  customerId: string,
  projectId: string,
  query: { entity?: string; search?: string; categoryId?: string; page?: number; limit?: number },
): Promise<{ total: number; items: Array<{ id: string; name: string; productNumber?: string; description?: string }> }> {
  const params = new URLSearchParams();
  if (query.entity) params.set("entity", query.entity);
  if (query.search) params.set("search", query.search);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return fetchJson(`/customers/${customerId}/projects/${projectId}/connectors/browse${qs ? `?${qs}` : ""}`);
}

export function browseConnectorDetail(
  customerId: string,
  projectId: string,
  refId: string,
  entity = "products",
): Promise<{ id: string; name: string; structuredText: string; imageUrl?: string }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/connectors/browse/${refId}?entity=${entity}`);
}

export function getConnectorTemplates(
  customerId: string,
  projectId: string,
): Promise<{ templates: Array<{ id: number; name: string; type: string; isDefault: boolean }> }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/connectors/templates`);
}

export function getConnectorLists(
  customerId: string,
  projectId: string,
): Promise<{ lists: Array<{ id: number; name: string; type: string; subscriberCount: number }> }> {
  return fetchJson(`/customers/${customerId}/projects/${projectId}/connectors/lists`);
}
