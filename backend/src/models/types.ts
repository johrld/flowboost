// ─── Chat ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

// ─── Core Entities ───────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  slug: string;
  email?: string;
  plan: "free" | "pro" | "enterprise";
  authors: Author[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  customerId: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;

  // Content configuration
  defaultLanguage: string;
  languages: Language[];
  categories: Category[];
  keywords: Record<string, string[]>;

  // Publishing
  publishFrequency?: {
    articlesPerWeek: number;
    preferredDays: number[]; // 0=Sun, 1=Mon, ...
  };

  // Competitors
  competitors?: Competitor[];

  // Connector configuration (V1 — kept for backward compatibility, auto-migrated to connectors[])
  connector?: ConnectorConfig;

  // Multi-Connector configuration — array of independent connector instances
  connectors: ConnectorInstance[];

  // Pipeline settings
  pipeline: PipelineSettings;
}

export interface Language {
  code: string;
  name: string;
  enabled: boolean;
}

export interface Category {
  id: string;
  labels: Record<string, string>; // { de: "Atemtechniken", en: "Breathing Techniques" }
}

export interface Author {
  id: string;
  name: string;
  role: Record<string, string>; // { de: "Meditationslehrerin", en: "Meditation Teacher" }
  image?: string;
}

export interface Competitor {
  domain: string;
  name: string;
  notes?: string;
}

export interface ConnectorConfig {
  type: "git" | "github" | "filesystem" | "shopware" | "wordpress" | "listmonk" | "api";
  useAsSource?: boolean;
  git?: {
    repoUrl: string;
    branch: string;
    contentPath: string; // e.g. "src/content/posts"
    assetsPath: string;  // e.g. "src/assets/posts"
  };
  github?: {
    installationId: number;
    owner: string;
    repo: string;
    branch: string;
    contentPath: string;
    assetsPath: string;
  };
  filesystem?: {
    outputDir: string;
  };
  shopware?: {
    shopUrl: string;
    clientId: string;
    clientSecret: string;
  };
  wordpress?: {
    siteUrl: string;
    username: string;
    applicationPassword: string;
  };
  listmonk?: {
    baseUrl: string;
    username: string;
    password: string;
  };
}

export type ConnectorType = ConnectorConfig["type"];

export type SourceStreamDataType = "content" | "reference" | "metrics" | "mixed";

export interface SourceStreamDef {
  id: string;
  label: string;
  dataType: SourceStreamDataType;
  defaultEnabled: boolean;
}

export interface ConnectorInstance extends ConnectorConfig {
  id: string;
  label?: string;
  /** IDs of enabled source streams (null/undefined = use defaults from definition) */
  enabledStreams?: string[];
}

// ─── Connector Helpers ──────────────────────────────────────────

/** Migrate V1 single connector to connectors array (idempotent) */
export function migrateConnectors(project: Project): ConnectorInstance[] {
  if (project.connectors?.length > 0) return project.connectors;
  if (project.connector?.type) {
    return [{ id: crypto.randomUUID(), ...project.connector }];
  }
  return [];
}

/** Find a connector by type in the connectors array */
export function findConnector(project: Project, type: ConnectorType): ConnectorInstance | undefined {
  return project.connectors.find((c) => c.type === type);
}

/** Find a connector by ID in the connectors array */
export function findConnectorById(project: Project, id: string): ConnectorInstance | undefined {
  return project.connectors.find((c) => c.id === id);
}

/** Get the primary site delivery connector (first git/github/filesystem/shopware/wordpress) */
export function getSiteConnector(project: Project): ConnectorInstance | undefined {
  return project.connectors.find((c) =>
    ["git", "github", "filesystem", "shopware", "wordpress"].includes(c.type),
  );
}

export interface PipelineSettings {
  defaultModel: string;
  maxRetriesPerPhase: number;
  maxBudgetPerArticle: number;
  imagenModel: string;

  // Video/Audio AI models
  videoModel?: string;
  audioModel?: string;
  preferredVoice?: string;

  // Budgets per content type
  maxBudgetPerVideo?: number;
  maxBudgetPerAudio?: number;
  maxBudgetPerSocialPost?: number;
}

export interface ApiKeys {
  anthropicApiKey?: string;
  googleAiApiKey?: string;
  runwayApiKey?: string;
  elevenLabsApiKey?: string;
}

// ─── Content Plan (Strategy Pipeline Output) ────────────────────

export interface ContentPlan {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  runId?: string;

  audit: ContentAudit;
}

export interface ContentAudit {
  totalContent: number;
  byCategory: Record<string, number>;
  byLanguage: Record<string, number>;
  gaps: string[];
}

export interface Topic {
  id: string;
  status: "proposed" | "approved" | "rejected" | "in_production" | "produced" | "archived";
  title: string;
  category: string;
  briefing?: string;          // Free-form briefing text — the central "what is this about" document
  direction?: string;         // Creative direction / angle (generic, applies to any content type)
  userNotes?: string;
  priority: number;
  source?: "pipeline" | "user";

  // Flow extensions — sources, chat, outputs
  inputs?: FlowInput[];
  outputIds?: string[];
  chatDistillation?: ChatDistillation;

  // Optional cached research (from strategy pipeline or enricher agent)
  enrichment?: FlowEnrichment;

  // Lifecycle timestamps
  createdAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

// ─── Flow Enrichment (optional research cache) ────────────────

export interface FlowEnrichment {
  // SEO research — relevant for articles, guides, landing pages
  seo?: {
    keywords: { primary: string; secondary: string[]; longTail: string[] };
    searchIntent: "informational" | "how-to" | "transactional" | "navigational";
    competitorInsights: string;
    suggestedSections?: number;
  };

  // AI analysis — generically useful
  reasoning?: string;
  targetAudience?: string;

  // Metadata
  enrichedAt: string;
  enrichedBy: "pipeline" | "user" | "agent";
}

// ─── Flow Input ─────────────────────────────────────────────

export type FlowInputType = "text" | "transcript" | "image" | "url" | "document";

export type InputProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface ProcessedInputData {
  status: InputProcessingStatus;
  summary?: string;
  keyPoints?: string[];
  transcript?: string;
  description?: string;
  extractedText?: string;
  fetchedContent?: string;
  userNote?: string;
  processedAt?: string;
  error?: string;
}

export interface FlowInput {
  id: string;
  type: FlowInputType;
  content: string;              // Text content or relative file path
  fileName?: string;
  mimeType?: string;
  createdAt: string;
  processed?: ProcessedInputData;
}

// ─── Chat Distillation ─────────────────────────────────────

export interface ChatDistillation {
  keyDecisions: string[];
  contentDirection: string;
  mustInclude: string[];
  rejectedIdeas: string[];
  rejectedApproaches: string[];
  contentReferences: string[];
  toneNotes: string;
  distilledAt: string;
}

// ─── Content Items ──────────────────────────────────────────────

export type ContentType =
  | "article"
  | "guide"
  | "landing_page"
  | "video"
  | "audio"
  | "social_post"
  | "newsletter";

export type ContentItemStatus =
  | "planned"
  | "producing"
  | "draft"
  | "review"
  | "approved"
  | "delivered"
  | "published"
  | "updating"
  | "archived";

export interface ContentItem {
  id: string;
  customerId: string;
  projectId: string;

  type: ContentType;
  contentTypeId?: string;
  status: ContentItemStatus;

  // Metadata
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  author?: string;

  // Flow references
  flowId?: string;              // Active link to originating flow (nullable — cleared when flow archived + content published)
  originFlowId?: string;        // Immutable provenance (set once at creation, never cleared)
  topicId?: string;             // @deprecated — use flowId
  briefingId?: string;          // @deprecated — use flowId
  translationKey?: string;
  parentId?: string;

  // Version tracking
  currentVersionId?: string;
  lastPublishedVersionId?: string;

  // Delivery tracking
  deliveryRef?: string;
  deliveryUrl?: string;

  // Hero image
  heroImageId?: string;

  // Scheduling
  scheduledDate?: string; // ISO: "2025-02-14T09:00" or "2025-02-14"

  // Timestamps
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  deliveredAt?: string;
  publishedAt?: string;
  archivedAt?: string;
}

export interface ContentVersion {
  id: string;
  contentId: string;
  versionNumber: number;

  languages: LanguageVariant[];
  assets: MediaAssetRef[];

  // Type-specific metadata
  text?: TextVersionMeta;
  video?: VideoVersionMeta;
  audio?: AudioVersionMeta;
  social?: SocialVersionMeta;
  newsletter?: NewsletterVersionMeta;

  // Connector-specific data (for platforms with custom slot structures)
  customFields?: Record<string, unknown>;
  connectorSchemaId?: string;

  // Pipeline tracking
  pipelineRunId?: string;
  seoScore?: number;
  qualityScore?: number;

  createdAt: string;
  createdBy: "pipeline" | "user" | "sync";
  createdByName?: string;
  publishedAt?: string;
}

export interface LanguageVariant {
  lang: string;
  slug: string;
  title: string;
  description: string;
  contentPath: string;
  wordCount?: number;
}

export interface TextVersionMeta {
  wordCount: number;
  headingCount: number;
  hasFaq: boolean;
  hasAnswerCapsule: boolean;
  readabilityScore?: number;
}

export interface VideoVersionMeta {
  durationSeconds: number;
  resolution: string;
  format: string;
  hasSubtitles: boolean;
  scriptPath?: string;
}

export interface AudioVersionMeta {
  durationSeconds: number;
  format: string;
  sampleRate: number;
  hasTranscript: boolean;
  transcriptPath?: string;
}

export interface SocialVersionMeta {
  platform: "linkedin" | "instagram" | "x" | "tiktok";
  characterCount: number;
  hashtagCount: number;
  hasMedia: boolean;
  format?: "text" | "carousel" | "thread" | "reel" | "story" | "poll";
  slideCount?: number;
}

export interface NewsletterVersionMeta {
  subject: string;
  previewText: string;
  wordCount: number;
  sectionCount: number;
}

// ─── Media Assets ───────────────────────────────────────────────

export type MediaType = "image" | "video" | "audio" | "document";
export type MediaSource = "generated" | "uploaded" | "extracted";

export interface MediaAsset {
  id: string;
  customerId: string;
  projectId: string;

  type: MediaType;
  source: MediaSource;
  mimeType: string;
  fileName: string;
  fileSize: number;

  localPath: string;
  cdnUrl?: string;

  width?: number;
  height?: number;
  altText?: string;

  title?: string;
  description?: string;
  tags: string[];
  usedBy: MediaUsageRef[];

  durationSeconds?: number;
  resolution?: string;
  thumbnailPath?: string;

  generationPrompt?: string;
  generationModel?: string;
  generationCostUsd?: number;

  createdAt: string;
  updatedAt: string;
}

export interface MediaUsageRef {
  contentId: string;
  role: "hero" | "inline" | "thumbnail" | "attachment" | "social_media";
  addedAt: string;
}

export interface MediaFilter {
  type?: MediaType;
  source?: MediaSource;
  tags?: string[];
  search?: string;
  unused?: boolean;
  page?: number;
  limit?: number;
}

export interface MediaAssetRef {
  assetId: string;
  role: "hero" | "thumbnail" | "inline" | "attachment" | "social_media";
  lang?: string;
}

// ─── Content Media (per-content-item) ────────────────────────────

export interface ContentMediaAsset {
  id: string;
  contentId: string;
  type: MediaType;
  source: MediaSource;
  role: "hero" | "inline";
  mimeType: string;
  fileName: string;         // on disk: "{uuid}.png"
  seoFilename: string;      // for delivery: "{slug}-hero"
  altText?: string;
  fileSize: number;
  width?: number;
  height?: number;
  generationPrompt?: string;
  generationModel?: string;
  generationCostUsd?: number;
  createdAt: string;
}

// ─── Pipeline Runs ──────────────────────────────────────────────

export type PipelineType =
  | "strategy"
  | "production"
  | "video_production"
  | "audio_production"
  | "social_production"
  | "email_production"
  | "update"
  | "translation";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type PhaseStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface PipelineRun {
  id: string;
  customerId: string;
  projectId: string;
  type: PipelineType;
  status: RunStatus;
  topicId?: string;     // @deprecated — use flowId
  flowId?: string;      // Flow that triggered this run
  contentId?: string;   // Content piece produced by this run

  phases: PipelinePhase[];
  totalCostUsd: number;
  totalTokens: { input: number; output: number };

  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface PipelinePhase {
  name: string;
  status: PhaseStatus;
  agentCalls: AgentCall[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface AgentCall {
  agent: string;
  model: string;
  status: "running" | "completed" | "failed";
  costUsd: number;
  tokens: { input: number; output: number };
  durationMs: number;
  result?: string;
  error?: string;
  events?: AgentEvent[];
}

export interface AgentEvent {
  type: "tool_call" | "text" | "error";
  timestamp: string;
  tool?: string;
  input?: string;  // truncated summary of tool input
  text?: string;
}

// ─── Content Index ──────────────────────────────────────────────

export interface ContentIndex {
  projectId: string;
  lastSyncedAt: string;
  schemaVersion: number;
  entries: ContentIndexEntry[];
}

export interface ContentIndexEntry {
  id: string;
  channel: "website" | "social";
  source: "flowboost" | "external";
  status: ContentStatus;

  // Website-specific
  site?: SiteContentMeta;

  // Social-specific (Phase 4)
  social?: SocialContentMeta;

  // Links
  parentId?: string;
  articleId?: string;
  topicId?: string;

  // Timestamps
  createdAt: string;
  firstPublishedAt?: string;
  lastUpdatedAt?: string;
  lastSyncedAt: string;

  // Multi-platform publishing status
  publications: Publication[];
}

export type ContentStatus =
  | "planned"
  | "producing"
  | "review"
  | "delivered"
  | "live"
  | "archived";

export interface SiteContentMeta {
  type: "blog" | "landing" | "guide" | "page";
  translationKey: string;
  languages: SiteContentLangMeta[];
  category?: string;
  tags?: string[];
  keywords?: string[];
  canonicalUrl?: string;
}

export interface SiteContentLangMeta {
  lang: string;
  slug: string;
  title: string;
  description: string;
  wordCount: number;
  filePath: string;
  sha: string;
}

export interface Publication {
  platform: string;
  status: "queued" | "publishing" | "published" | "failed" | "retrying";
  ref?: string;
  url?: string;
  publishedAt?: string;
  lastAttemptAt?: string;
  retryCount: number;
  error?: string;
}

export interface ContentRevision {
  id: string;
  contentId: string;
  version: number;
  changes: {
    field: string;
    oldValue?: string;
    newValue?: string;
  }[];
  changedBy: "flowboost" | "external_sync" | "user";
  changedAt: string;
  snapshotPath?: string;
}

// Placeholder for Phase 4 — Social Content
export interface SocialContentMeta {
  platform: string;
  contentType: string;
  platformPostId?: string;
  platformUrl?: string;
  scheduledAt?: string;
}

// ─── Multi-Connector Config ─────────────────────────────────────

export type SiteConnectorType = "github" | "git" | "filesystem" | "wordpress" | "shopify" | "webflow";

export interface SiteConnectorConfig {
  type: SiteConnectorType;
  git?: {
    repoUrl: string;
    branch: string;
    contentPath: string;
    assetsPath: string;
  };
  github?: {
    installationId: number;
    owner: string;
    repo: string;
    branch: string;
    contentPath: string;
    assetsPath: string;
  };
  filesystem?: {
    outputDir: string;
  };
}

export type SocialPlatform = "linkedin" | "instagram" | "tiktok" | "x" | "facebook";

export interface SocialChannelConfig {
  platform: SocialPlatform;
  enabled: boolean;
  accountId: string;
  accountName: string;
  autoPublish: boolean;
  syndicationDelay?: number;
}

// ─── Agent SDK Types ────────────────────────────────────────────

export interface AgentOptions {
  model?: string;
  tools?: string[];
  maxTurns?: number;
  maxBudget?: number;
}

export interface AgentResult {
  text: string;
  costUsd: number;
  tokens: { input: number; output: number };
  durationMs: number;
  sessionId: string;
}
