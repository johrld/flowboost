// FlowBoost Dashboard Types (mirrors backend models)

// ── Article Status (2 dimensions) ───────────────────────────────

export type ArticleStage = "draft" | "producing" | "ready" | "live" | "archived";
export type ArticleCondition = "ok" | "needs_review" | "editing";

// ── Topic Status ────────────────────────────────────────────────

export type TopicStatus = "researched" | "approved" | "producing" | "done";

// ── Pipeline ────────────────────────────────────────────────────

export type PipelinePhase =
  | "outline"
  | "writing"
  | "assembly"
  | "image"
  | "quality"
  | "translation";

export type PhaseStatus = "pending" | "running" | "completed" | "failed";

// ── Models ──────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  languages: string[];
  connector: "git" | "wordpress" | "filesystem";
  publishFrequency?: {
    articlesPerWeek: number;
    preferredDays: number[]; // 0=Sun, 1=Mon, ...
  };
}

export interface Topic {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  category: string;
  keywords: string[];
  priority: "high" | "medium" | "low";
  status: TopicStatus;
  scheduledDate?: string; // ISO date
  searchVolume?: number;
  difficulty?: number; // 0-100
  confidence?: "high" | "medium" | "low";
  reasoning?: string; // why this topic was suggested
}

export interface ContentGap {
  id: string;
  projectId: string;
  topic: string;
  competitors: string[]; // domains that cover this topic
  searchVolume: number;
  difficulty: number;
  category: string;
  suggestedType: "blog" | "guide" | "landing";
  opportunity: "high" | "medium" | "low";
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
  projectId: string;
  topicId: string;
  topicTitle: string;
  type: "strategy" | "production";
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  phases: PipelinePhaseInfo[];
}

export interface PipelinePhaseInfo {
  name: PipelinePhase;
  status: PhaseStatus;
  startedAt?: string;
  completedAt?: string;
  agents: AgentInfo[];
}

export interface AgentInfo {
  name: string;
  status: "running" | "completed" | "failed";
  toolCalls: ToolCall[];
}

export interface ToolCall {
  tool: string;
  summary: string;
  timestamp: string;
}

export interface Author {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface Category {
  id: string;
  labels: Record<string, string>; // lang -> label
}
