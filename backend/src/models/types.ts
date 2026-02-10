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

  // Connector configuration
  connector: ConnectorConfig;

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
  type: "git" | "github" | "filesystem" | "api";
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
}

export interface PipelineSettings {
  defaultModel: string;
  maxRetriesPerPhase: number;
  maxBudgetPerArticle: number;
  imagenModel: string;
}

export interface ApiKeys {
  anthropicApiKey?: string;
  googleAiApiKey?: string;
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
  totalArticles: number;
  byCategory: Record<string, number>;
  byLanguage: Record<string, number>;
  gaps: string[];
}

export interface Topic {
  id: string;
  status: "proposed" | "approved" | "rejected" | "in_production" | "produced";
  title: string;
  category: string;
  priority: number;

  keywords: {
    primary: string;
    secondary: string[];
    longTail: string[];
  };

  searchIntent: "informational" | "how-to" | "transactional" | "navigational";
  competitorInsights: string;
  suggestedAngle: string;
  estimatedSections: number;
  reasoning: string;

  createdAt?: string;
  runId?: string;

  // Set after production
  articleId?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

// ─── Articles ───────────────────────────────────────────────────

export interface Article {
  id: string;
  customerId: string;
  projectId: string;
  topicId: string;
  translationKey: string;
  status: "draft" | "review" | "approved" | "delivered";
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  lang: string;
  slug: string;
  wordCount: number;
  seoScore?: number;
  contentPath: string;  // relative path within version dir
  assetsPath?: string;  // hero image path
  createdAt: string;
}

// ─── Pipeline Runs ──────────────────────────────────────────────

export type PipelineType = "strategy" | "production";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type PhaseStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface PipelineRun {
  id: string;
  customerId: string;
  projectId: string;
  type: PipelineType;
  status: RunStatus;
  topicId?: string; // only for production runs

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
