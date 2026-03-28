// ── Chat ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

// FlowBoost Dashboard Types (mirrors backend models)

// ── Content V3 ──────────────────────────────────────────────────

export type ContentType = "article" | "guide" | "landing_page" | "video" | "audio" | "social_post" | "newsletter";

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
  status: ContentItemStatus;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  author?: string;
  flowId?: string;
  originFlowId?: string;
  topicId?: string;
  briefingId?: string;
  translationKey?: string;
  parentId?: string;
  currentVersionId?: string;
  lastPublishedVersionId?: string;
  deliveryRef?: string;
  deliveryUrl?: string;
  heroImageId?: string;
  scheduledDate?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  deliveredAt?: string;
  publishedAt?: string;
  archivedAt?: string;
  // Populated by GET /content/:id
  versions?: ContentVersion[];
}

export interface ContentVersion {
  id: string;
  contentId: string;
  versionNumber: number;
  languages: LanguageVariant[];
  assets: MediaAssetRef[];
  text?: TextVersionMeta;
  video?: VideoVersionMeta;
  audio?: AudioVersionMeta;
  social?: SocialVersionMeta;
  newsletter?: NewsletterVersionMeta;
  customFields?: Record<string, unknown>;
  connectorSchemaId?: string;
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

export interface MediaAssetRef {
  assetId: string;
  role: "hero" | "thumbnail" | "inline" | "attachment" | "social_media";
  lang?: string;
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
}

export interface AudioVersionMeta {
  durationSeconds: number;
  format: string;
  sampleRate: number;
  hasTranscript: boolean;
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

// ── Content Media ───────────────────────────────────────────────

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
  usedBy: { contentId: string; role: string; addedAt: string }[];
  durationSeconds?: number;
  resolution?: string;
  thumbnailPath?: string;
  generationPrompt?: string;
  generationModel?: string;
  generationCostUsd?: number;
  createdAt: string;
  updatedAt: string;
}

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

// ── Topic Status ────────────────────────────────────────────────

export type TopicStatus = "proposed" | "approved" | "rejected" | "in_production" | "produced" | "archived";

// ── Pipeline ────────────────────────────────────────────────────

export type PhaseStatus = "pending" | "running" | "completed" | "failed" | "skipped";

// ── Models ──────────────────────────────────────────────────────

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

export interface ApiKeys {
  anthropicApiKey?: string;
  googleAiApiKey?: string;
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
    contentPath: string;
    assetsPath: string;
  };
  github?: {
    installationId: number;
    owner: string;
    repo: string;
    branch: string;
    framework?: string;
    contentPath: string;
    assetsPath: string;
    categoriesPath?: string;
    authorsPath?: string;
  };
  filesystem?: {
    outputDir: string;
  };
  shopware?: {
    shopUrl: string;
    clientId: string;
    clientSecret: string;
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
  enabledStreams?: string[];
}

export interface PipelineSettings {
  defaultModel: string;
  maxRetriesPerPhase?: number;
  maxBudgetPerArticle?: number;
  imagenModel?: string;
}

export interface Project {
  id: string;
  customerId: string;
  name: string;
  slug: string;
  description: string;
  defaultLanguage: string;
  languages: { code: string; name: string; enabled: boolean }[];
  categories: Category[];
  keywords: Record<string, string[]>;
  competitors?: Competitor[];
  connector?: ConnectorConfig;
  connectors: ConnectorInstance[];
  pipeline: PipelineSettings;
  publishFrequency?: {
    articlesPerWeek: number;
    preferredDays: number[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  status: TopicStatus;
  title: string;
  category: string;
  briefing?: string;
  direction?: string;
  userNotes?: string;
  priority: number;
  source?: "pipeline" | "user";

  // Flow extensions
  inputs?: FlowInput[];
  outputIds?: string[];
  chatDistillation?: ChatDistillation;

  // Optional cached research
  enrichment?: FlowEnrichment;

  // Lifecycle
  createdAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface FlowEnrichment {
  seo?: {
    keywords: { primary: string; secondary: string[]; longTail: string[] };
    searchIntent: string;
    competitorInsights: string;
    suggestedSections?: number;
  };
  reasoning?: string;
  targetAudience?: string;
  enrichedAt: string;
  enrichedBy: "pipeline" | "user" | "agent";
}

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
  content: string;
  fileName?: string;
  mimeType?: string;
  createdAt: string;
  processed?: ProcessedInputData;
}

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


export interface PipelineRun {
  id: string;
  customerId: string;
  projectId: string;
  type: "strategy" | "production" | "video_production" | "audio_production" | "social_production" | "email_production" | "update" | "translation";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  topicId?: string;
  flowId?: string;
  contentId?: string;
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
  input?: string;
  text?: string;
}

export interface Author {
  id: string;
  name: string;
  role: string | Record<string, string>;
  image?: string;
}

export interface Category {
  id: string;
  labels: Record<string, string>; // lang -> label
}

// ── Content Index ────────────────────────────────────────────────

export type ContentStatus = "planned" | "producing" | "review" | "delivered" | "live" | "archived";

export interface SiteContentLangMeta {
  lang: string;
  slug: string;
  title: string;
  description: string;
  wordCount: number;
  filePath: string;
  sha: string;
}

export interface SiteContentMeta {
  type: "blog" | "landing" | "guide" | "page";
  translationKey: string;
  languages: SiteContentLangMeta[];
  category?: string;
  tags?: string[];
  keywords?: string[];
  canonicalUrl?: string;
}

export interface ContentIndexEntry {
  id: string;
  channel: "website" | "social";
  source: "flowboost" | "external";
  status: ContentStatus;
  site?: SiteContentMeta;
  parentId?: string;
  articleId?: string;
  topicId?: string;
  createdAt: string;
  firstPublishedAt?: string;
  lastUpdatedAt?: string;
  lastSyncedAt: string;
  publications: { platform: string; status: string; url?: string; publishedAt?: string }[];
}

export interface ContentIndex {
  projectId: string;
  lastSyncedAt: string;
  total: number;
  entries: ContentIndexEntry[];
}


