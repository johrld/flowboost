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
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ContentStatusBadge, TopicStatusBadge } from "@/components/status-badge";
import { useProject } from "@/lib/project-context";
import { getTopics, getContent, scheduleTopic } from "@/lib/api";
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

interface Week {
  kw: number;
  days: Date[];
}

// ── Helpers ─────────────────────────────────────────────────────

function getWeeksOfMonth(date: Date): Week[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks: Week[] = [];
  let cursor = calStart;
  while (cursor <= calEnd) {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(cursor, i));
    weeks.push({ kw: getISOWeek(cursor), days });
    cursor = addDays(cursor, 7);
  }
  return weeks;
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

// ── Draggable Item (compact inline) ─────────────────────────────

const LOCKED_STATUSES: ContentItemStatus[] = ["published", "delivered", "archived"];

function DraggableItem({
  item,
  locked,
  onTimeChange,
  onUnschedule,
}: {
  item: CalendarItem;
  locked: boolean;
  onTimeChange?: (newTime: string) => void;
  onUnschedule?: () => void;
}) {
  const isLocked = locked || (item.contentStatus && LOCKED_STATUSES.includes(item.contentStatus));
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
    disabled: !!isLocked,
  });

  const statusColor = item.contentStatus === "published" ? "bg-green-500"
    : item.contentStatus === "approved" || item.contentStatus === "delivered" ? "bg-blue-500"
    : item.contentStatus === "review" ? "bg-amber-500"
    : item.type === "topic" ? "bg-violet-400"
    : "bg-muted-foreground/50";

  const time = item.scheduledDate.includes("T")
    ? item.scheduledDate.split("T")[1]
    : null;
  const datePrefix = item.scheduledDate.split("T")[0];

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 flex-1 min-w-0 transition-opacity ${isDragging ? "opacity-30" : ""}`}
    >
      {!isLocked && (
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab shrink-0 touch-none opacity-0 group-hover/day:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
      <span className={`h-2 w-2 rounded-full shrink-0 ${statusColor}`} />
      {!isLocked && onTimeChange ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 tabular-nums hover:text-foreground transition-colors rounded px-1 -ml-1 hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <Clock className="h-3 w-3" />
              {time ?? "—"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Change time</p>
              <input
                type="time"
                defaultValue={time ?? "09:00"}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                onChange={(e) => {
                  if (e.target.value) {
                    onTimeChange(`${datePrefix}T${e.target.value}`);
                  }
                }}
              />
            </div>
          </PopoverContent>
        </Popover>
      ) : time ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 tabular-nums">
          <Clock className="h-3 w-3" />
          {time}
        </span>
      ) : null}
      <span className="truncate text-sm">{item.title}</span>
      <div className="shrink-0 ml-auto flex items-center gap-1">
        {item.contentStatus && <ContentStatusBadge status={item.contentStatus} />}
        {item.topicStatus && <TopicStatusBadge status={item.topicStatus} />}
        {!isLocked && onUnschedule && (
          <button
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/day:opacity-100 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onUnschedule();
            }}
            title="Unschedule"
          >
            <X className="h-3 w-3" />
          </button>
        )}
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

// ── Droppable Day Slot ──────────────────────────────────────────

function DroppableDaySlot({
  dateStr,
  children,
}: {
  dateStr: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dateStr}` });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 px-3 py-1.5 min-h-[36px] flex items-center transition-colors ${
        isOver ? "bg-primary/10" : ""
      }`}
    >
      {children}
    </div>
  );
}

// ── Detail Sheet: Shows topic/content details ───────────────────

function DetailDialog({
  item,
  topic,
  content,
  categories,
  onClose,
  onUnschedule,
}: {
  item: CalendarItem | null;
  topic: Topic | null;
  content: ContentItem | null;
  categories: { id: string; labels: Record<string, string> }[];
  onClose: () => void;
  onUnschedule: (item: CalendarItem) => void;
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

        {/* Metadata as compact list */}
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
          {topic?.priority != null && (
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Priority</span>
              <span className="font-medium">P{topic.priority}</span>
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

        {/* Agent Reasoning */}
        {topic?.reasoning && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Agent Reasoning</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{topic.reasoning}</p>
          </div>
        )}

        {/* Competitor Insights */}
        {topic?.competitorInsights && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Competitor Insights</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{topic.competitorInsights}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {item.type === "content" && (
            <Link href={`/create/${item.id}`} className="flex-1">
              <Button className="w-full gap-1.5">
                Open in Editor
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          {item.type === "topic" && (
            <Button variant="outline" className="flex-1" disabled>
              Not yet produced
            </Button>
          )}
          {!(item.contentStatus && LOCKED_STATUSES.includes(item.contentStatus)) && (
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

// ── Assign Sheet: Full topic selector ───────────────────────────

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
  const [topicData, setTopicData] = useState<Topic[]>([]);
  const [contentData, setContentData] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<CalendarItem | null>(null);

  // Sheet state
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

  const weeks = getWeeksOfMonth(currentDate);
  const today = new Date();
  const calendarItems = buildCalendarItems(contentData, topicData);

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

  // Resolve topic/content for detail sheet
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

    // Block dropping on past dates
    const targetDate = new Date(targetDateStr);
    if (isBefore(startOfDay(targetDate), startOfDay(today))) return;

    // Calculate default time: if day has items, use last time + 1h, else 09:00
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
    // Preserve original time if dragging between days
    const originalTime = item.scheduledDate.includes("T") ? item.scheduledDate.split("T")[1] : defaultTime;
    const newScheduledDate = `${targetDateStr}T${originalTime}`;

    const topicId = item.type === "topic"
      ? item.id
      : contentData.find((c) => c.id === item.id)?.topicId;

    if (topicId && customerId && projectId) {
      // Optimistic UI update
      setTopicData((prev) =>
        prev.map((t) =>
          t.id === topicId ? { ...t, scheduledDate: newScheduledDate } : t
        )
      );
      // Persist to backend
      scheduleTopic(customerId, projectId, topicId, newScheduledDate).catch(() => {
        // Revert on failure
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
    // Optimistic
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
    // Optimistic
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
    // Optimistic UI update
    setTopicData((prev) =>
      prev.map((t) =>
        t.id === topicId
          ? { ...t, scheduledDate: dateStr, status: "approved" as const }
          : t
      )
    );
    // Persist to backend
    scheduleTopic(customerId, projectId, topicId, dateStr).catch(() => {
      setTopicData((prev) =>
        prev.map((t) =>
          t.id === topicId ? { ...t, scheduledDate: undefined } : t
        )
      );
    });
  }

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan</h1>
          <p className="text-muted-foreground">Editorial calendar</p>
        </div>
        <Link href="/create/new">
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
        <div className="space-y-6">
          {/* Month Navigation */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center min-w-[180px]">
              <p className="text-lg font-semibold">
                {format(currentDate, "MMMM yyyy", { locale: de })}
              </p>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
          </div>

          {/* Month View grouped by KW */}
          <div className="space-y-4">
            {weeks.map((week) => (
              <div
                key={week.kw}
                className="rounded-lg border overflow-hidden"
              >
                <div className="bg-muted/60 px-4 py-1.5 border-b">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    KW {week.kw}
                  </span>
                </div>

                {week.days.map((day, idx) => {
                  const dayItems = getItemsForDate(day);
                  const isToday = isSameDay(day, today);
                  const isPast = isBefore(startOfDay(day), startOfDay(today));
                  const isWeekend =
                    day.getDay() === 0 || day.getDay() === 6;
                  const isOutsideMonth = !isSameMonth(day, currentDate);
                  const dateStr = format(day, "yyyy-MM-dd");

                  return (
                    <div
                      key={day.toISOString()}
                      className={`group/day flex items-stretch transition-colors ${
                        idx < 6 ? "border-b" : ""
                      } ${isToday ? "bg-primary/5" : ""} ${
                        isWeekend && !isPast ? "bg-muted/20" : ""
                      } ${isOutsideMonth ? "opacity-40" : ""} ${
                        isPast && !isToday
                          ? "bg-muted/40 text-muted-foreground/60"
                          : "cursor-pointer hover:bg-muted/40"
                      }`}
                      onClick={() => {
                        if (isPast && dayItems.length === 0) return;
                        if (dayItems.length === 1) {
                          setSelectedItem(dayItems[0]);
                        } else if (dayItems.length === 0 && !isPast && unscheduled.length > 0) {
                          setAssignDate(dateStr);
                        }
                      }}
                    >
                      <div
                        className={`w-16 shrink-0 flex flex-col items-center justify-center py-2 border-r ${
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : isPast
                              ? "text-muted-foreground/50"
                              : ""
                        }`}
                      >
                        <span className="text-[10px] font-medium uppercase leading-none">
                          {format(day, "EEE", { locale: de })}
                        </span>
                        <span className={`text-base font-bold leading-tight ${isPast && !isToday ? "line-through decoration-muted-foreground/30" : ""}`}>
                          {format(day, "dd")}
                        </span>
                      </div>

                      <DroppableDaySlot dateStr={dateStr}>
                        {dayItems.length > 0 ? (
                          <div className="flex items-center gap-2 flex-1 py-0.5">
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              {dayItems.map((item) => (
                                <div
                                  key={item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item);
                                  }}
                                >
                                  <DraggableItem
                                    item={item}
                                    locked={isPast}
                                    onTimeChange={(newDate) => handleTimeChange(item, newDate)}
                                    onUnschedule={() => handleUnschedule(item)}
                                  />
                                </div>
                              ))}
                            </div>
                            {!isPast && unscheduled.length > 0 && (
                              <button
                                className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted opacity-0 group-hover/day:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssignDate(dateStr);
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ) : isPast ? (
                          <span className="text-xs text-muted-foreground/40 italic">—</span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground opacity-0 group-hover/day:opacity-100 transition-opacity">
                            <Plus className="h-3 w-3" />
                            Schedule
                          </span>
                        )}
                      </DroppableDaySlot>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
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
            Approve topics in Research to schedule them here
          </p>
        </div>
      )}

      {/* Detail Dialog — click on scheduled item */}
      <DetailDialog
        item={selectedItem}
        topic={selectedTopic}
        content={selectedContent}
        categories={categories}
        onClose={() => setSelectedItem(null)}
        onUnschedule={handleUnschedule}
      />

      {/* Assign Dialog — click on empty day */}
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
