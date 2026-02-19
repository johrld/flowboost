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
import { getTopics, getContent, scheduleTopic, approveTopic, startProduction } from "@/lib/api";
import type { Topic, ContentItem, ContentItemStatus, TopicStatus } from "@/lib/types";
import Link from "next/link";

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
  const contentByTopicId = new Map<string, ContentItem>();
  for (const c of contentItems) {
    if (c.topicId) contentByTopicId.set(c.topicId, c);
  }

  for (const t of topics) {
    if (!t.scheduledDate) continue;
    const content = contentByTopicId.get(t.id);
    if (content) {
      items.push({
        id: content.id,
        title: content.title,
        subtitle: `${content.category ?? content.type} · ${t.category}`,
        type: "content",
        scheduledDate: t.scheduledDate,
        contentStatus: content.status,
        topicId: t.id,
      });
    } else {
      items.push({
        id: t.id,
        title: t.title,
        subtitle: t.category,
        type: "topic",
        scheduledDate: t.scheduledDate,
        topicStatus: t.status,
        topicId: t.id,
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

// ── Droppable Day Cell (shared by Month + Week) ──────────────────

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

// ── Month View: Compact Chip (draggable) ──────────────────────

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

// ── Week View: Rich Card (draggable) ──────────────────────────

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
      className={`group/card rounded-lg border bg-card p-3 cursor-pointer hover:border-primary/30 transition-all ${
        isDragging ? "opacity-30" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Drag Handle + Type + Time */}
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
          <span className="text-[11px] text-muted-foreground capitalize">
            {item.type === "content" ? "article" : "topic"}
          </span>
        </div>
        {time && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <Clock className="h-3 w-3" />
            {time}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium line-clamp-2">{item.title}</p>

      {/* Description */}
      {topic?.suggestedAngle && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{topic.suggestedAngle}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {topic?.keywords?.primary && (
            <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium truncate">
              {topic.keywords.primary}
            </span>
          )}
          {catLabel && (
            <span className="text-[10px] text-muted-foreground truncate">{catLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.contentStatus && <ContentStatusBadge status={item.contentStatus} />}
          {item.topicStatus && <TopicStatusBadge status={item.topicStatus} />}
        </div>
      </div>
    </div>
  );
}

// ── Drag Overlay (ghost while dragging) ─────────────────────────

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

  const keywords = content?.keywords
    ?? (topic?.keywords
      ? [topic.keywords.primary, ...topic.keywords.secondary, ...topic.keywords.longTail]
      : []);

  const datePrefix = item.scheduledDate.split("T")[0];
  const time = item.scheduledDate.includes("T")
    ? item.scheduledDate.split("T")[1]
    : null;
  const isLocked = item.contentStatus && LOCKED_STATUSES.includes(item.contentStatus);
  const hasAnalysis = topic?.reasoning || topic?.competitorInsights;

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
          {(content?.description || topic?.suggestedAngle) && (
            <DialogDescription>
              {content?.description ?? topic?.suggestedAngle}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Metadata */}
        <div className="divide-y text-sm">
          {topic?.category && (
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Category</span>
              <span className="font-medium">{catLabel(topic.category)}</span>
            </div>
          )}
          {topic?.searchIntent && (
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Search Intent</span>
              <span className="font-medium capitalize">{topic.searchIntent}</span>
            </div>
          )}
{topic?.estimatedSections && (
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Sections</span>
              <span className="font-medium">~{topic.estimatedSections}</span>
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

        {/* Keywords */}
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

        {/* Tags */}
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

        {/* AI Analysis (collapsible) */}
        {hasAnalysis && (
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none py-1">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              AI Analysis
            </summary>
            <div className="space-y-3 pt-2 pl-5">
              {topic?.reasoning && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Agent Reasoning</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{topic.reasoning}</p>
                </div>
              )}
              {topic?.competitorInsights && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Competitor Insights</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{topic.competitorInsights}</p>
                </div>
              )}
            </div>
          </details>
        )}

        {/* Reschedule */}
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

        {/* Actions */}
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
            <Link href={`/content/topics/${item.topicId}`} className="flex-1">
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

function AssignDialog({
  dateStr,
  open,
  unscheduled,
  categories,
  onAssign,
  onClose,
}: {
  dateStr: string;
  open: boolean;
  unscheduled: Topic[];
  categories: { id: string; labels: Record<string, string> }[];
  onAssign: (topicId: string, date: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [times, setTimes] = useState<Record<string, string>>({});

  const catLabel = (catId: string) => {
    const c = categories.find((cat) => cat.id === catId);
    return c?.labels.de ?? c?.labels.en ?? catId;
  };

  const sorted = [...unscheduled].sort((a, b) => a.priority - b.priority);
  const query = search.toLowerCase().trim();
  const filtered = query
    ? sorted.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query) ||
          catLabel(t.category).toLowerCase().includes(query) ||
          t.keywords.primary.toLowerCase().includes(query) ||
          t.keywords.secondary.some((kw) => kw.toLowerCase().includes(query)) ||
          t.keywords.longTail.some((kw) => kw.toLowerCase().includes(query)),
      )
    : sorted;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setSearch(""); setTimes({}); } }}>
      <DialogContent className="sm:max-w-4xl h-[70vh] flex flex-col gap-0 p-0">
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-4 space-y-4 border-b shrink-0">
          <DialogHeader>
            <DialogTitle>
              Schedule for {dateStr ? format(new Date(dateStr), "EEEE, d. MMMM", { locale: de }) : ""}
            </DialogTitle>
            <DialogDescription>
              {unscheduled.length} unscheduled topic{unscheduled.length !== 1 ? "s" : ""} available — sorted by priority
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, category, or keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 px-6 py-2">
          <div className="divide-y">
            {filtered.map((topic) => (
              <div
                key={topic.id}
                className="flex items-start gap-4 py-3.5 group/row hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
              >
                {/* Main info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0">P{topic.priority}</Badge>
                    <p className="font-medium text-sm">{topic.title}</p>
                    <TopicStatusBadge status={topic.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{catLabel(topic.category)}</span>
                    <span>·</span>
                    <span className="capitalize">{topic.searchIntent}</span>
                    <span>·</span>
                    <span>~{topic.estimatedSections} sections</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[topic.keywords.primary, ...topic.keywords.secondary.slice(0, 3)].map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Time + Schedule */}
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  <input
                    type="time"
                    defaultValue="09:00"
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setTimes((prev) => ({ ...prev, [topic.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="opacity-60 group-hover/row:opacity-100 transition-opacity"
                    onClick={() => {
                      const time = times[topic.id] ?? "09:00";
                      onAssign(topic.id, `${dateStr}T${time}`);
                      onClose();
                      setSearch("");
                      setTimes({});
                    }}
                  >
                    <Calendar className="mr-1.5 h-3 w-3" />
                    Schedule
                  </Button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && unscheduled.length > 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No topics match &ldquo;{search}&rdquo;</p>
              </div>
            )}

            {unscheduled.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No unscheduled topics</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Run Research to discover new topics
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function PlanPage() {
  const { customerId, projectId, categories, loading: projectLoading } = useProject();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [topicData, setTopicData] = useState<Topic[]>([]);
  const [contentData, setContentData] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<CalendarItem | null>(null);

  // Dialog state
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [assignDate, setAssignDate] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId || !projectId) return;
    setLoading(true);
    Promise.all([
      getTopics(customerId, projectId),
      getContent(customerId, projectId).then((r) => r.items),
    ])
      .then(([t, c]) => {
        setTopicData(t);
        setContentData(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId, projectId]);

  const today = new Date();
  const calendarItems = buildCalendarItems(contentData, topicData);
  const topicById = new Map(topicData.map((t) => [t.id, t]));

  const scheduledTopicIds = new Set(
    topicData.filter((t) => t.scheduledDate).map((t) => t.id),
  );
  const unscheduled = topicData.filter(
    (t) =>
      !t.scheduledDate &&
      !scheduledTopicIds.has(t.id) &&
      (["proposed", "approved"] as string[]).includes(t.status)
  );

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

  // Resolve topic/content for detail dialog
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

    const topicId = item.type === "topic"
      ? item.id
      : contentData.find((c) => c.id === item.id)?.topicId;

    if (topicId && customerId && projectId) {
      setTopicData((prev) =>
        prev.map((t) =>
          t.id === topicId ? { ...t, scheduledDate: newScheduledDate } : t
        )
      );
      scheduleTopic(customerId, projectId, topicId, newScheduledDate).catch(() => {
        setTopicData((prev) =>
          prev.map((t) =>
            t.id === topicId ? { ...t, scheduledDate: item.scheduledDate } : t
          )
        );
      });
    }
  }

  function handleUnschedule(item: CalendarItem) {
    if (!customerId || !projectId) return;
    const topicId = item.type === "topic"
      ? item.id
      : contentData.find((c) => c.id === item.id)?.topicId;
    if (!topicId) return;
    const oldDate = item.scheduledDate;
    setTopicData((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, scheduledDate: undefined } : t))
    );
    scheduleTopic(customerId, projectId, topicId, null).catch(() => {
      setTopicData((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, scheduledDate: oldDate } : t))
      );
    });
  }

  function handleTimeChange(item: CalendarItem, newScheduledDate: string) {
    if (!customerId || !projectId) return;
    const topicId = item.type === "topic"
      ? item.id
      : contentData.find((c) => c.id === item.id)?.topicId;
    if (!topicId) return;
    const oldDate = item.scheduledDate;
    setTopicData((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, scheduledDate: newScheduledDate } : t))
    );
    scheduleTopic(customerId, projectId, topicId, newScheduledDate).catch(() => {
      setTopicData((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, scheduledDate: oldDate } : t))
      );
    });
  }

  function handleAssign(topicId: string, dateStr: string) {
    if (!customerId || !projectId) return;
    setTopicData((prev) =>
      prev.map((t) =>
        t.id === topicId
          ? { ...t, scheduledDate: dateStr, status: "approved" as const }
          : t
      )
    );
    scheduleTopic(customerId, projectId, topicId, dateStr).catch(() => {
      setTopicData((prev) =>
        prev.map((t) =>
          t.id === topicId ? { ...t, scheduledDate: undefined } : t
        )
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

  // ── Navigation helpers ──────────────────────────────────────────

  function navigateBack() {
    if (calendarView === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  }

  function navigateForward() {
    if (calendarView === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
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

  // ── Month View Grid ─────────────────────────────────────────────

  const monthWeeks = getWeeksOfMonth(currentDate);

  function renderMonthView() {
    return (
      <div className="rounded-lg border overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {DAY_HEADERS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Week Rows */}
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
                  {/* Day Number + Plus */}
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
                    {!isPast && !isOutside && unscheduled.length > 0 && (
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

                  {/* Items as Chips */}
                  <div className="space-y-0.5">
                    {dayItems.map((item) => (
                      <DraggableChip
                        key={item.id}
                        item={item}
                        onClick={() => setSelectedItem(item)}
                      />
                    ))}
                  </div>

                  {/* Empty day click → assign */}
                  {dayItems.length === 0 && !isPast && !isOutside && (
                    <div
                      className="flex-1 min-h-[60px] cursor-pointer"
                      onClick={() => {
                        if (unscheduled.length > 0) setAssignDate(dateStr);
                      }}
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

  // ── Week View Grid ──────────────────────────────────────────────

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
                {/* Day Header */}
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
                  {!isPast && unscheduled.length > 0 && (
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

                {/* Cards */}
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
                      onClick={() => {
                        if (unscheduled.length > 0) setAssignDate(dateStr);
                      }}
                    >
                      <span className="text-xs text-muted-foreground">
                        {unscheduled.length > 0 ? "+ Schedule" : "—"}
                      </span>
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

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan</h1>
          <p className="text-muted-foreground">Editorial calendar</p>
        </div>
        <Link href="/content/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Content
          </Button>
        </Link>
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

            {/* View Toggle */}
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

          {/* Calendar Body */}
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
            Approve topics in Content to schedule them here
          </p>
        </div>
      )}

      {/* Detail Dialog */}
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

      {/* Assign Dialog */}
      <AssignDialog
        dateStr={assignDate ?? ""}
        open={!!assignDate}
        unscheduled={unscheduled}
        categories={categories}
        onAssign={handleAssign}
        onClose={() => setAssignDate(null)}
      />
    </div>
  );
}
