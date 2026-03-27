"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  getISOWeek,
  isSameDay,
  isSameMonth,
  isBefore,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  GripVertical,
  Loader2,
  FileText,
  Calendar,
  ArrowRight,
  Search,
  Clock,
  Check,
  X,
  Eye,
  Activity,
  Layers,
  Image as ImageIcon,
  Share2,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ContentStatusBadge, TopicStatusBadge } from "@/components/status-badge";
import { useProject } from "@/lib/project-context";
import {
  getTopics,
  getContent,
  getPipelineRuns,
  updateContent,
  approveTopic,
  startProduction,
} from "@/lib/api";
import type {
  Topic,
  ContentItem,
  ContentItemStatus,
  TopicStatus,
  PipelineRun,
} from "@/lib/types";
import Link from "next/link";
import { NewContentWizard } from "@/components/new-content-wizard";

// ── Types ───────────────────────────────────────────────────────

interface CalendarItem {
  id: string;
  title: string;
  subtitle: string;
  type: "content" | "topic";
  scheduledDate: string;
  contentStatus?: ContentItemStatus;
  topicStatus?: TopicStatus;
  topicId?: string;
  heroImageUrl?: string;
}

type CalendarView = "month" | "week";

// ── Helpers ─────────────────────────────────────────────────────

function getWeeksOfMonth(date: Date): Date[][] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks: Date[][] = [];
  let cursor = calStart;
  while (cursor <= calEnd) {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(cursor, i));
    weeks.push(days);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function buildCalendarItems(
  contentItems: ContentItem[],
  topics: Topic[]
): CalendarItem[] {
  const items: CalendarItem[] = [];
  const topicMap = new Map<string, Topic>();
  for (const t of topics) topicMap.set(t.id, t);

  // 1. Content items with their own scheduledDate
  for (const c of contentItems) {
    if (c.scheduledDate) {
      const platformLabels: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", x: "X", tiktok: "TikTok" };
      const subtitle = c.type === "social_post" && c.category
        ? platformLabels[c.category] ?? c.category
        : c.type.replace("_", " ");
      items.push({
        id: c.id,
        title: c.title,
        subtitle,
        type: "content",
        scheduledDate: c.scheduledDate,
        contentStatus: c.status,
        topicId: c.flowId ?? c.topicId,
      });
    }
  }

  return items;
}

// ── Shared Constants ─────────────────────────────────────────────

const LOCKED_STATUSES: ContentItemStatus[] = ["published", "delivered", "archived"];
const DAY_HEADERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getStatusColor(item: CalendarItem): string {
  if (item.contentStatus === "published") return "bg-green-500";
  if (item.contentStatus === "approved" || item.contentStatus === "delivered") return "bg-blue-500";
  if (item.contentStatus === "review") return "bg-amber-500";
  if (item.type === "topic") return "bg-violet-400";
  return "bg-muted-foreground/50";
}

// ── Droppable Day Cell ──────────────────────────────────────────

function DroppableDayCell({
  dateStr,
  children,
  className,
}: {
  dateStr: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dateStr}` });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""} transition-colors ${isOver ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""}`}
    >
      {children}
    </div>
  );
}

// ── Month View: Compact Chip ────────────────────────────────────

function DraggableChip({
  item,
  onClick,
}: {
  item: CalendarItem;
  onClick: () => void;
}) {
  const isLocked = item.contentStatus && LOCKED_STATUSES.includes(item.contentStatus);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
    disabled: !!isLocked,
  });

  const time = item.scheduledDate.includes("T") ? item.scheduledDate.split("T")[1] : null;

  return (
    <div
      ref={setNodeRef}
      {...(!isLocked ? { ...listeners, ...attributes } : {})}
      className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-xs cursor-pointer hover:bg-accent/50 transition-opacity ${
        isDragging ? "opacity-30" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${getStatusColor(item)}`} />
      <span className="truncate">{item.title}</span>
      {time && <span className="text-muted-foreground tabular-nums shrink-0">{time}</span>}
    </div>
  );
}

// ── Week View: Rich Card ────────────────────────────────────────

function DraggableCard({
  item,
  topic,
  categories,
  onClick,
}: {
  item: CalendarItem;
  topic?: Topic;
  categories: { id: string; labels: Record<string, string> }[];
  onClick: () => void;
}) {
  const isLocked = item.contentStatus && LOCKED_STATUSES.includes(item.contentStatus);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
    disabled: !!isLocked,
  });

  const time = item.scheduledDate.includes("T") ? item.scheduledDate.split("T")[1] : null;
  const catLabel = topic?.category
    ? categories.find((c) => c.id === topic.category)?.labels.de ?? topic.category
    : null;

  return (
    <div
      ref={setNodeRef}
      className={`group/card rounded-lg border bg-card overflow-hidden cursor-pointer hover:border-primary/30 transition-all ${
        isDragging ? "opacity-30" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Hero Image / Placeholder */}
      {item.heroImageUrl ? (
        <img
          src={item.heroImageUrl}
          alt=""
          className="w-full h-20 object-cover"
        />
      ) : (
        <div className="w-full h-16 bg-muted/40 border-b border-dashed flex items-center justify-center">
          <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {!isLocked && (
              <div
                {...listeners}
                {...attributes}
                className="cursor-grab touch-none opacity-0 group-hover/card:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {time && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
              <Clock className="h-3 w-3" />
              {time}
            </span>
          )}
        </div>
        <p className="text-sm font-medium line-clamp-2">{item.title}</p>
        {topic?.direction && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{topic.direction}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {item.contentStatus && <ContentStatusBadge status={item.contentStatus} />}
          {item.topicStatus && <TopicStatusBadge status={item.topicStatus} />}
          {catLabel && (
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {catLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Drag Overlay ────────────────────────────────────────────────

function DragOverlayCard({ item }: { item: CalendarItem }) {
  return (
    <div className="flex items-center gap-2 w-72 rounded-md border px-3 py-1.5 bg-card shadow-lg">
      <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="truncate text-sm">{item.title}</span>
      <div className="flex items-center gap-1 shrink-0 ml-auto">
        {item.contentStatus && <ContentStatusBadge status={item.contentStatus} />}
        {item.topicStatus && <TopicStatusBadge status={item.topicStatus} />}
      </div>
    </div>
  );
}

// ── Detail Dialog ───────────────────────────────────────────────

function DetailDialog({
  item,
  topic,
  content,
  categories,
  onClose,
  onUnschedule,
  onReschedule,
  onApprove,
  onProduce,
}: {
  item: CalendarItem | null;
  topic: Topic | null;
  content: ContentItem | null;
  categories: { id: string; labels: Record<string, string> }[];
  onClose: () => void;
  onUnschedule: (item: CalendarItem) => void;
  onReschedule: (item: CalendarItem, newDate: string) => void;
  onApprove: (topicId: string) => void;
  onProduce: (topicId: string) => void;
}) {
  if (!item) return null;

  const catLabel = (catId?: string) => {
    if (!catId) return null;
    const c = categories.find((cat) => cat.id === catId);
    return c?.labels.de ?? c?.labels.en ?? catId;
  };

  const seoKeywords = topic?.enrichment?.seo?.keywords;
  const keywords = content?.keywords
    ?? (seoKeywords
      ? [seoKeywords.primary, ...seoKeywords.secondary, ...seoKeywords.longTail]
      : []);

  const datePrefix = item.scheduledDate.split("T")[0];
  const time = item.scheduledDate.includes("T")
    ? item.scheduledDate.split("T")[1]
    : null;
  const isLocked = item.contentStatus && LOCKED_STATUSES.includes(item.contentStatus);
  const hasAnalysis = topic?.enrichment?.reasoning || topic?.enrichment?.seo?.competitorInsights;

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {item.contentStatus && <ContentStatusBadge status={item.contentStatus} />}
            {item.topicStatus && <TopicStatusBadge status={item.topicStatus} />}
            <Badge variant="outline" className="text-[10px]">
              {item.type === "content" ? "Content" : "Topic"}
            </Badge>
          </div>
          <DialogTitle className="text-lg leading-snug pr-6">
            {item.title}
          </DialogTitle>
          {(content?.description || topic?.direction) && (
            <DialogDescription>
              {content?.description ?? topic?.direction}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="divide-y text-sm">
          {topic?.category && (
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Category</span>
              <span className="font-medium">{catLabel(topic.category)}</span>
            </div>
          )}
          {topic?.enrichment?.seo?.searchIntent && (
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Search Intent</span>
              <span className="font-medium capitalize">{topic.enrichment.seo.searchIntent}</span>
            </div>
          )}
          {topic?.enrichment?.seo?.suggestedSections && (
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Sections</span>
              <span className="font-medium">~{topic.enrichment.seo.suggestedSections}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Scheduled</span>
            <span className="font-medium">
              {item.scheduledDate.includes("T")
                ? format(new Date(item.scheduledDate), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de })
                : format(new Date(item.scheduledDate), "dd. MMMM yyyy", { locale: de })}
            </span>
          </div>
          {(topic?.createdAt || content?.createdAt) && (
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">
                {format(new Date((topic?.createdAt ?? content?.createdAt)!), "dd.MM.yyyy")}
              </span>
            </div>
          )}
        </div>

        {keywords.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Keywords</p>
            <div className="flex flex-wrap gap-1">
              {keywords.map((kw, i) => (
                <Badge key={kw} variant={i === 0 ? "default" : "outline"} className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {content?.tags && content.tags.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1">
              {content.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </div>
        )}

        {hasAnalysis && (
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none py-1">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              AI Analysis
            </summary>
            <div className="space-y-3 pt-2 pl-5">
              {topic?.enrichment?.reasoning && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Agent Reasoning</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{topic.enrichment.reasoning}</p>
                </div>
              )}
              {topic?.enrichment?.seo?.competitorInsights && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Competitor Insights</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{topic.enrichment.seo.competitorInsights}</p>
                </div>
              )}
            </div>
          </details>
        )}

        {!isLocked && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const d = fd.get("date") as string;
              const t = fd.get("time") as string;
              if (d && t) {
                onReschedule(item, `${d}T${t}`);
                onClose();
              }
            }}
          >
            <p className="text-xs font-medium text-muted-foreground">Reschedule</p>
            <div className="flex gap-2">
              <input
                name="date"
                type="date"
                defaultValue={datePrefix}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                name="time"
                type="time"
                defaultValue={time ?? "09:00"}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button type="submit" size="sm" variant="outline">
                Apply
              </Button>
            </div>
          </form>
        )}

        <div className="flex gap-2 pt-2 border-t">
          {item.type === "content" && (
            <Link href={`/content/${item.id}`} className="flex-1">
              <Button className="w-full gap-1.5">
                Open in Editor
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          {item.type === "topic" && (
            <Link href={`/flows/${item.topicId}`} className="flex-1">
              <Button variant="outline" className="w-full gap-1.5">
                View Details
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          {item.type === "topic" && item.topicStatus === "proposed" && (
            <Button
              className="flex-1 gap-1.5"
              onClick={() => {
                if (item.topicId) onApprove(item.topicId);
                onClose();
              }}
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
          )}
          {item.type === "topic" && item.topicStatus === "approved" && (
            <Button
              className="flex-1 gap-1.5"
              onClick={() => {
                if (item.topicId) onProduce(item.topicId);
                onClose();
              }}
            >
              Produce
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {!isLocked && (
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                onUnschedule(item);
                onClose();
              }}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Unschedule
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Dialog ───────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  article: "Article",
  guide: "Guide",
  newsletter: "Newsletter",
  social_post: "Social Post",
};

function AssignDialog({
  dateStr,
  open,
  contentItems,
  onAssign,
  onClose,
}: {
  dateStr: string;
  open: boolean;
  contentItems: ContentItem[];
  onAssign: (contentId: string, date: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState("all");

  // Build type counts for filter dropdown
  const typeCounts: Record<string, number> = {};
  for (const c of contentItems) {
    const key = c.type === "social_post" && c.category ? c.category : c.type;
    typeCounts[key] = (typeCounts[key] ?? 0) + 1;
  }

  // Filter by type
  const typeFiltered = typeFilter === "all"
    ? contentItems
    : contentItems.filter((c) => {
        const key = c.type === "social_post" && c.category ? c.category : c.type;
        return key === typeFilter;
      });

  // Filter by search
  const query = search.toLowerCase().trim();
  const filtered = query
    ? typeFiltered.filter((c) => c.title.toLowerCase().includes(query))
    : typeFiltered;

  const getLabel = (item: ContentItem) => {
    if (item.type === "social_post" && item.category) return PLATFORM_LABELS[item.category] ?? item.category;
    return CONTENT_TYPE_LABELS[item.type] ?? item.type;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setSearch(""); setTimes({}); setTypeFilter("all"); } }}>
      <DialogContent className="sm:max-w-3xl h-[70vh] flex flex-col gap-0 p-0">
        <div className="px-6 pt-6 pb-4 space-y-4 shrink-0">
          <DialogHeader>
            <DialogTitle>
              Schedule for {dateStr ? format(new Date(dateStr), "EEEE, d. MMMM", { locale: de }) : ""}
            </DialogTitle>
            <DialogDescription>
              Choose content to schedule for this day
            </DialogDescription>
          </DialogHeader>

          {/* Filter + Search */}
          <div className="flex items-center justify-between gap-4">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Types ({contentItems.length})</option>
              {Object.entries(typeCounts).map(([key, count]) => (
                <option key={key} value={key}>
                  {PLATFORM_LABELS[key] ?? CONTENT_TYPE_LABELS[key] ?? key} ({count})
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-52 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-2">
          <div className="divide-y">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 py-3.5 group/row hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    <ContentStatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{getLabel(item)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="time"
                    defaultValue="09:00"
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setTimes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="opacity-60 group-hover/row:opacity-100 transition-opacity"
                    onClick={() => {
                      const time = times[item.id] ?? "09:00";
                      onAssign(item.id, `${dateStr}T${time}`);
                    }}
                  >
                    <Calendar className="mr-1.5 h-3 w-3" />
                    Schedule
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && contentItems.length > 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No content matches your filter</p>
              </div>
            )}
            {contentItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No unscheduled content</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  All content is scheduled. Create new content in your Flows.
                </p>
                <Button size="sm" asChild>
                  <Link href="/flows">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Go to Flows
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard Page ─────────────────────────────────────────

export default function DashboardPage() {
  const { customerId, projectId, project, categories, loading: projectLoading } = useProject();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [topicData, setTopicData] = useState<Topic[]>([]);
  const [contentData, setContentData] = useState<ContentItem[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<CalendarItem | null>(null);

  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [assignDate, setAssignDate] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!customerId || !projectId) return;
    setLoading(true);
    try {
      const [t, c, r] = await Promise.all([
        getTopics(customerId, projectId),
        getContent(customerId, projectId).then((res) => res.items),
        getPipelineRuns(customerId, projectId),
      ]);
      setTopicData(t);
      setContentData(c);
      setRuns(r);
    } catch { /* ignore */ }
    setLoading(false);
  }, [customerId, projectId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";
  const calendarItems = buildCalendarItems(contentData, topicData);
  const topicById = new Map(topicData.map((t) => [t.id, t]));

  // Topics that have at least one scheduled content item
  const scheduledTopicIds = new Set(
    contentData.filter((c) => c.scheduledDate && (c.flowId ?? c.topicId)).map((c) => c.flowId ?? c.topicId!),
  );
  const unscheduled = topicData.filter(
    (t) =>
      !scheduledTopicIds.has(t.id) &&
      (["proposed", "approved"] as string[]).includes(t.status)
  );

  const unscheduledContent = contentData.filter((c) => !c.scheduledDate);

  // Stats
  const reviewCount = contentData.filter((i) => i.status === "review").length;
  const activeRunCount = runs.filter((r) => r.status === "running" || r.status === "pending").length;
  const publishedCount = contentData.filter((i) => i.status === "published").length;
  const topicsReady = topicData.filter((t) => t.status === "approved").length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getItemsForDate = useCallback(
    (date: Date): CalendarItem[] => {
      const dateStr = format(date, "yyyy-MM-dd");
      return calendarItems
        .filter((item) => item.scheduledDate.startsWith(dateStr))
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    },
    [calendarItems]
  );

  const selectedTopic = selectedItem?.topicId
    ? topicData.find((t) => t.id === selectedItem.topicId) ?? null
    : null;
  const selectedContent = selectedItem?.type === "content"
    ? contentData.find((c) => c.id === selectedItem.id) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(event.active.data.current as CalendarItem);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const targetDateStr = String(over.id).replace("day-", "");
    const item = active.data.current as CalendarItem;
    if (!item || item.scheduledDate.startsWith(targetDateStr)) return;

    const targetDate = new Date(targetDateStr);
    if (isBefore(startOfDay(targetDate), startOfDay(today))) return;

    const existingItems = calendarItems.filter(
      (ci) => ci.scheduledDate.startsWith(targetDateStr) && ci.id !== item.id
    );
    let defaultTime = "09:00";
    if (existingItems.length > 0) {
      const sorted = [...existingItems].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
      const lastTime = sorted[sorted.length - 1].scheduledDate.split("T")[1] ?? "09:00";
      const [h] = lastTime.split(":").map(Number);
      defaultTime = `${String(Math.min(h + 1, 23)).padStart(2, "0")}:00`;
    }
    const originalTime = item.scheduledDate.includes("T") ? item.scheduledDate.split("T")[1] : defaultTime;
    const newScheduledDate = `${targetDateStr}T${originalTime}`;

    if (item.type === "content") {
      // Update content item's scheduledDate
      if (customerId && projectId) {
        setContentData((prev) =>
          prev.map((c) =>
            c.id === item.id ? { ...c, scheduledDate: newScheduledDate } : c
          )
        );
        updateContent(customerId, projectId, item.id, { scheduledDate: newScheduledDate }).catch(() => {
          setContentData((prev) =>
            prev.map((c) =>
              c.id === item.id ? { ...c, scheduledDate: item.scheduledDate } : c
            )
          );
        });
      }
    }
  }

  function handleUnschedule(item: CalendarItem) {
    if (!customerId || !projectId || item.type !== "content") return;
    const oldDate = item.scheduledDate;
    setContentData((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, scheduledDate: undefined } : c))
    );
    updateContent(customerId, projectId, item.id, { scheduledDate: null as unknown as string }).catch(() => {
      setContentData((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, scheduledDate: oldDate } : c))
      );
    });
  }

  function handleTimeChange(item: CalendarItem, newScheduledDate: string) {
    if (!customerId || !projectId || item.type !== "content") return;
    const oldDate = item.scheduledDate;
    setContentData((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, scheduledDate: newScheduledDate } : c))
    );
    updateContent(customerId, projectId, item.id, { scheduledDate: newScheduledDate }).catch(() => {
      setContentData((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, scheduledDate: oldDate } : c))
      );
    });
  }

  function handleAssignContent(contentId: string, dateStr: string) {
    if (!customerId || !projectId) return;
    setContentData((prev) =>
      prev.map((c) => c.id === contentId ? { ...c, scheduledDate: dateStr } : c)
    );
    updateContent(customerId, projectId, contentId, { scheduledDate: dateStr }).catch(() => {
      setContentData((prev) =>
        prev.map((c) => c.id === contentId ? { ...c, scheduledDate: undefined } : c)
      );
    });
  }

  async function handleApproveTopic(topicId: string) {
    if (!customerId || !projectId) return;
    setTopicData((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, status: "approved" as const } : t))
    );
    try {
      await approveTopic(customerId, projectId, topicId);
    } catch {
      setTopicData((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, status: "proposed" as const } : t))
      );
    }
  }

  async function handleProduceTopic(topicId: string) {
    if (!customerId || !projectId) return;
    try {
      await startProduction(customerId, projectId, topicId);
      const [t, c] = await Promise.all([
        getTopics(customerId, projectId),
        getContent(customerId, projectId).then((r) => r.items),
      ]);
      setTopicData(t);
      setContentData(c);
    } catch {}
  }

  // Navigation
  function navigateBack() {
    if (calendarView === "month") setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  }

  function navigateForward() {
    if (calendarView === "month") setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  }

  function navigateToday() {
    setCurrentDate(new Date());
  }

  function getNavigationLabel(): string {
    if (calendarView === "month") {
      return format(currentDate, "MMMM yyyy", { locale: de });
    }
    const weekDays = getWeekDays(currentDate);
    const kw = getISOWeek(weekDays[0]);
    const start = format(weekDays[0], "d.", { locale: de });
    const end = format(weekDays[6], "d. MMM", { locale: de });
    return `KW ${kw} · ${start} – ${end}`;
  }

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Month View ─────────────────────────────────────────────────

  const monthWeeks = getWeeksOfMonth(currentDate);

  function renderMonthView() {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {DAY_HEADERS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        {monthWeeks.map((weekDays, weekIdx) => (
          <div key={weekIdx} className={`grid grid-cols-7 ${weekIdx < monthWeeks.length - 1 ? "border-b" : ""}`}>
            {weekDays.map((day, dayIdx) => {
              const dayItems = getItemsForDate(day);
              const isToday = isSameDay(day, today);
              const isPast = isBefore(startOfDay(day), startOfDay(today));
              const isOutside = !isSameMonth(day, currentDate);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const dateStr = format(day, "yyyy-MM-dd");

              return (
                <DroppableDayCell
                  key={day.toISOString()}
                  dateStr={dateStr}
                  className={`min-h-[120px] p-1.5 ${dayIdx < 6 ? "border-r" : ""} ${
                    isOutside ? "opacity-40 bg-muted/10" : ""
                  } ${isWeekend && !isPast && !isOutside ? "bg-muted/10" : ""} ${
                    isPast && !isToday ? "bg-muted/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 text-xs font-medium rounded-full ${
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : isPast
                            ? "text-muted-foreground/50"
                            : ""
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {!isPast && !isOutside && (
                      <button
                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignDate(dateStr);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.map((item) => (
                      <DraggableChip
                        key={item.id}
                        item={item}
                        onClick={() => setSelectedItem(item)}
                      />
                    ))}
                  </div>
                  {dayItems.length === 0 && !isPast && !isOutside && (
                    <div
                      className="flex-1 min-h-[60px] cursor-pointer"
                      onClick={() => setAssignDate(dateStr)}
                    />
                  )}
                </DroppableDayCell>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ── Week View ──────────────────────────────────────────────────

  const weekDays = getWeekDays(currentDate);

  function renderWeekView() {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-7 divide-x">
          {weekDays.map((day) => {
            const dayItems = getItemsForDate(day);
            const isToday = isSameDay(day, today);
            const isPast = isBefore(startOfDay(day), startOfDay(today));
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const dateStr = format(day, "yyyy-MM-dd");

            return (
              <DroppableDayCell
                key={day.toISOString()}
                dateStr={dateStr}
                className={`min-h-[500px] flex flex-col ${
                  isWeekend && !isPast ? "bg-muted/10" : ""
                } ${isPast && !isToday ? "bg-muted/20" : ""}`}
              >
                <div className={`px-2 py-2 border-b text-center ${isToday ? "bg-primary/10" : "bg-muted/40"}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {format(day, "EEE", { locale: de })}
                  </p>
                  <p className={`text-lg font-bold ${
                    isToday
                      ? "text-primary"
                      : isPast
                        ? "text-muted-foreground/50"
                        : ""
                  }`}>
                    {format(day, "d")}
                  </p>
                  {!isPast && (
                    <button
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignDate(dateStr);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {dayItems.map((item) => (
                    <DraggableCard
                      key={item.id}
                      item={item}
                      topic={item.topicId ? topicById.get(item.topicId) : undefined}
                      categories={categories}
                      onClick={() => setSelectedItem(item)}
                    />
                  ))}
                  {dayItems.length === 0 && !isPast && (
                    <div
                      className="flex-1 min-h-[100px] flex items-center justify-center rounded-md border border-dashed cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => setAssignDate(dateStr)}
                    >
                      <span className="text-xs text-muted-foreground">+ Schedule</span>
                    </div>
                  )}
                </div>
              </DroppableDayCell>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-5">
      {/* Header: Greeting + Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting}</h1>
          <p className="text-muted-foreground text-sm">
            {project?.name ?? "FlowBoost"} · {format(today, "EEEE, d. MMMM yyyy", { locale: de })}
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Content
        </Button>
      </div>

      <NewContentWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onTopicCreated={(topic) => setTopicData((prev) => [topic, ...prev])}
      />

      {/* Compact Stats */}
      <div className="flex items-center gap-3 flex-wrap">
        {reviewCount > 0 && (
          <Link href="/content">
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5 cursor-pointer hover:bg-accent/50 transition-colors">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {reviewCount} Review
            </Badge>
          </Link>
        )}
        {activeRunCount > 0 && (
          <Link href="/monitor">
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5 cursor-pointer hover:bg-accent/50 transition-colors">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              {activeRunCount} Running
            </Badge>
          </Link>
        )}
        {topicsReady > 0 && (
          <Link href="/content">
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5 cursor-pointer hover:bg-accent/50 transition-colors">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              {topicsReady} Topics Ready
            </Badge>
          </Link>
        )}
        <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
          <Layers className="h-3 w-3" />
          {contentData.length} Content
        </Badge>
        <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
          <Check className="h-3 w-3" />
          {publishedCount} Published
        </Badge>
      </div>

{/* Calendar */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={navigateToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateForward}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold ml-2">
                {getNavigationLabel()}
              </span>
            </div>
            <div className="flex items-center rounded-md border">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-3 rounded-r-none text-xs ${calendarView === "month" ? "bg-muted font-medium" : "text-muted-foreground"}`}
                onClick={() => setCalendarView("month")}
              >
                Month
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-3 rounded-l-none text-xs ${calendarView === "week" ? "bg-muted font-medium" : "text-muted-foreground"}`}
                onClick={() => setCalendarView("week")}
              >
                Week
              </Button>
            </div>
          </div>

          {calendarView === "month" ? renderMonthView() : renderWeekView()}
        </div>

        <DragOverlay>
          {activeItem ? <DragOverlayCard item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>

      {calendarItems.length === 0 && topicData.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No scheduled content</p>
          <p className="text-xs text-muted-foreground">
            Approve topics in Articles to schedule them here
          </p>
        </div>
      )}

      <DetailDialog
        item={selectedItem}
        topic={selectedTopic}
        content={selectedContent}
        categories={categories}
        onClose={() => setSelectedItem(null)}
        onUnschedule={handleUnschedule}
        onReschedule={handleTimeChange}
        onApprove={handleApproveTopic}
        onProduce={handleProduceTopic}
      />

      <AssignDialog
        dateStr={assignDate ?? ""}
        open={!!assignDate}
        contentItems={unscheduledContent}
        onAssign={handleAssignContent}
        onClose={() => setAssignDate(null)}
      />
    </div>
  );
}
