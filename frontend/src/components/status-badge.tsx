import type { TopicStatus, PhaseStatus, ContentItemStatus, ContentType } from "@/lib/types";

// ── Topic Status Badge ───────────────────────────────────────────

const topicStatusConfig: Record<
  TopicStatus,
  { label: string; className: string; dot: string }
> = {
  proposed: {
    label: "Proposed",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  approved: {
    label: "Approved",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    dot: "bg-cyan-500",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    dot: "bg-red-400",
  },
  in_production: {
    label: "Producing",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    dot: "bg-blue-500 animate-pulse",
  },
  produced: {
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

// ── Content Status Badge (V3) ────────────────────────────────────

const contentStatusConfig: Record<
  ContentItemStatus,
  { label: string; className: string; dot: string }
> = {
  planned: {
    label: "Planned",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  producing: {
    label: "Producing",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    dot: "bg-blue-500 animate-pulse",
  },
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  review: {
    label: "Review",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    dot: "bg-cyan-500",
  },
  delivered: {
    label: "Delivered",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  published: {
    label: "Published",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    dot: "bg-green-500",
  },
  updating: {
    label: "Updating",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    dot: "bg-orange-500 animate-pulse",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    dot: "bg-gray-400",
  },
};

export function ContentStatusBadge({ status }: { status: ContentItemStatus }) {
  const config = contentStatusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── Content Type Badge ───────────────────────────────────────────

const contentTypeConfig: Record<ContentType, { label: string; className: string }> = {
  article: { label: "Article", className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  guide: { label: "Guide", className: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  landing_page: { label: "Landing", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  video: { label: "Video", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  audio: { label: "Audio", className: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  social_post: { label: "Social", className: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
};

export function ContentTypeBadge({ type }: { type: ContentType }) {
  const config = contentTypeConfig[type];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config.className}`}>
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
  skipped: { label: "Skipped", className: "bg-muted text-muted-foreground" },
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

