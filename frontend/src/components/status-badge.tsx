import type { ArticleStage, ArticleCondition, TopicStatus, PhaseStatus } from "@/lib/types";

// ── Article Stage Badge ──────────────────────────────────────────

const stageConfig: Record<
  ArticleStage,
  { label: string; className: string; dot: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  producing: {
    label: "Producing",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    dot: "bg-blue-500 animate-pulse",
  },
  ready: {
    label: "Ready",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    dot: "bg-cyan-500",
  },
  live: {
    label: "Live",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    dot: "bg-green-500",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    dot: "bg-gray-400",
  },
};

export function StageBadge({ stage }: { stage: ArticleStage }) {
  const config = stageConfig[stage];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── Article Condition Badge ──────────────────────────────────────

const conditionConfig: Record<
  Exclude<ArticleCondition, "ok">,
  { label: string; className: string }
> = {
  needs_review: {
    label: "Needs Review",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  editing: {
    label: "Editing",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
};

export function ConditionBadge({ condition }: { condition: ArticleCondition }) {
  if (condition === "ok") return null;
  const config = conditionConfig[condition];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ── Topic Status Badge ───────────────────────────────────────────

const topicStatusConfig: Record<
  TopicStatus,
  { label: string; className: string; dot: string }
> = {
  researched: {
    label: "Researched",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  approved: {
    label: "Approved",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    dot: "bg-cyan-500",
  },
  producing: {
    label: "Producing",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    dot: "bg-blue-500 animate-pulse",
  },
  done: {
    label: "Done",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    dot: "bg-green-500",
  },
};

export function TopicStatusBadge({ status }: { status: TopicStatus }) {
  const config = topicStatusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── Pipeline Phase Status Badge ──────────────────────────────────

const phaseStatusConfig: Record<PhaseStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  running: { label: "Running", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  completed: { label: "Done", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

export function PhaseStatusBadge({ status }: { status: PhaseStatus }) {
  const config = phaseStatusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {status === "running" && (
        <span className="inline-flex items-center gap-[3px] mr-0.5">
          <span className="thinking-dot h-1 w-1 rounded-full bg-current opacity-70" />
          <span className="thinking-dot h-1 w-1 rounded-full bg-current opacity-70" />
          <span className="thinking-dot h-1 w-1 rounded-full bg-current opacity-70" />
        </span>
      )}
      {config.label}
    </span>
  );
}
