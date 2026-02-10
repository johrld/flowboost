// FlowBoost Dashboard Types (mirrors backend models)

// ── Article Status (2 dimensions) ───────────────────────────────

export type ArticleStage = "draft" | "producing" | "ready" | "live" | "archived";
export type ArticleCondition = "ok" | "needs_review" | "editing";

// ── Topic Status ────────────────────────────────────────────────

export type TopicStatus = "proposed" | "approved" | "rejected" | "in_production" | "produced";

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
  type: "git" | "github" | "filesystem" | "api";
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
  connector: ConnectorConfig;
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
  priority: number;
  keywords: {
    primary: string;
    secondary: string[];
    longTail: string[];
  };
  searchIntent: string;
  competitorInsights: string;
  suggestedAngle: string;
  estimatedSections: number;
  reasoning: string;
  createdAt?: string;
  runId?: string;
  scheduledDate?: string;
  articleId?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface Article {
  id: string;
  projectId: string;
  topicId: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  stage: ArticleStage;
  condition: ArticleCondition;
  lang: string;
  createdAt: string;
  scheduledDate?: string;
  publishedAt?: string;
  lastEditedAt?: string;
  versions: ArticleVersion[];
}

export interface ArticleVersion {
  id: string;
  lang: string;
  content: string; // markdown
  frontmatter: Record<string, unknown>;
  createdAt: string;
}

export interface PipelineRun {
  id: string;
  customerId: string;
  projectId: string;
  type: "strategy" | "production";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  topicId?: string;
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

// ── Brief ─────────────────────────────────────────────────────────

export interface Brief {
  id: string;
  projectId: string;
  topicId: string;
  topicTitle: string;
  status: "draft" | "ready" | "in_production" | "completed";
  createdAt: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  wordCountTarget: { min: number; max: number };
  contentType: "blog" | "guide" | "landing";
  serpIntent: "informational" | "transactional" | "navigational" | "commercial";
  featuredSnippetTarget: boolean;
  suggestedStructure: { heading: string; level: "h2" | "h3" }[];
  questionsToAnswer: string[];
  internalLinks: { url: string; anchor: string }[];
  competitors: { domain: string; position: number; wordCount: number; score: number }[];
}

// ── Dashboard Actions ─────────────────────────────────────────────

export type ActionType = "opportunity" | "review" | "completed";

export interface DashboardAction {
  type: ActionType;
  message: string;
  count?: number;
  link: string;
}
