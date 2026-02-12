"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  getISOWeek,
  isSameDay,
  isSameMonth,
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
  Tag,
  Target,
  Sparkles,
  Eye,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ContentStatusBadge, TopicStatusBadge } from "@/components/status-badge";
import { useProject } from "@/lib/project-context";
import { getTopics, getContent } from "@/lib/api";
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

// ── Draggable Item Card ─────────────────────────────────────────

function DraggableItem({
  item,
  onClickItem,
}: {
  item: CalendarItem;
  onClickItem: (item: CalendarItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 w-full rounded-md border px-3 py-2 bg-card transition-opacity ${
        isDragging ? "opacity-30" : ""
      } ${item.type === "topic" ? "border-dashed" : ""}`}
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab shrink-0 touch-none"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <button
        onClick={() => onClickItem(item)}
        className="flex items-center justify-between gap-3 flex-1 min-w-0 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.contentStatus && <ContentStatusBadge status={item.contentStatus} />}
          {item.topicStatus && <TopicStatusBadge status={item.topicStatus} />}
        </div>
      </button>
    </div>
  );
}

// ── Drag Overlay (ghost while dragging) ─────────────────────────

function DragOverlayCard({ item }: { item: CalendarItem }) {
  return (
    <div className="flex items-center gap-2 w-80 rounded-md border px-3 py-2 bg-card shadow-lg">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
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
      className={`flex-1 px-3 py-2 min-h-[52px] flex items-center transition-colors ${
        isOver ? "bg-primary/10" : ""
      }`}
    >
      {children}
    </div>
  );
}

// ── Detail Sheet: Shows topic/content details ───────────────────

function DetailSheet({
  item,
  topic,
  content,
  categories,
  onClose,
  onOpenEditor,
}: {
  item: CalendarItem | null;
  topic: Topic | null;
  content: ContentItem | null;
  categories: { id: string; labels: Record<string, string> }[];
  onClose: () => void;
  onOpenEditor?: () => void;
}) {
  if (!item) return null;

  const catLabel = (catId?: string) => {
    if (!catId) return null;
    const c = categories.find((cat) => cat.id === catId);
    return c?.labels.de ?? c?.labels.en ?? catId;
  };

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {item.contentStatus && <ContentStatusBadge status={item.contentStatus} />}
            {item.topicStatus && <TopicStatusBadge status={item.topicStatus} />}
            <Badge variant="outline" className="text-[10px]">
              {item.type === "content" ? "Content" : "Topic"}
            </Badge>
          </div>
          <SheetTitle className="text-lg leading-snug pr-6">
            {item.title}
          </SheetTitle>
          {content?.description && (
            <SheetDescription>{content.description}</SheetDescription>
          )}
          {!content?.description && topic?.suggestedAngle && (
            <SheetDescription>{topic.suggestedAngle}</SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3">
            {topic?.category && (
              <div className="rounded-md border p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Category</p>
                <p className="text-sm font-medium">{catLabel(topic.category)}</p>
              </div>
            )}
            {topic?.searchIntent && (
              <div className="rounded-md border p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Search Intent</p>
                <p className="text-sm font-medium capitalize">{topic.searchIntent}</p>
              </div>
            )}
            {topic?.priority != null && (
              <div className="rounded-md border p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Priority</p>
                <p className="text-sm font-medium">P{topic.priority}</p>
              </div>
            )}
            {topic?.estimatedSections && (
              <div className="rounded-md border p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Sections</p>
                <p className="text-sm font-medium">~{topic.estimatedSections} sections</p>
              </div>
            )}
            <div className="rounded-md border p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Scheduled</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {format(new Date(item.scheduledDate), "dd. MMMM yyyy", { locale: de })}
              </p>
            </div>
            {(topic?.createdAt || content?.createdAt) && (
              <div className="rounded-md border p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                <p className="text-sm font-medium">
                  {format(new Date((topic?.createdAt ?? content?.createdAt)!), "dd.MM.yyyy")}
                </p>
              </div>
            )}
          </div>

          {/* Content-specific info */}
          {content && (
            <div className="space-y-3">
              {content.tags && content.tags.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {content.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {content.keywords && content.keywords.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Target className="h-3 w-3" /> Keywords
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {content.keywords.map((kw, i) => (
                      <Badge
                        key={kw}
                        variant={i === 0 ? "default" : "outline"}
                        className="text-xs"
                      >
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Topic Keywords (when no content yet) */}
          {!content && topic?.keywords && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Target className="h-3 w-3" /> Keywords
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="default" className="text-xs">
                  {topic.keywords.primary}
                </Badge>
                {topic.keywords.secondary.map((kw) => (
                  <Badge key={kw} variant="outline" className="text-xs">
                    {kw}
                  </Badge>
                ))}
                {topic.keywords.longTail.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs font-normal">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Agent Reasoning */}
          {topic?.reasoning && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Agent Reasoning
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {topic.reasoning}
              </p>
            </div>
          )}

          {/* Competitor Insights */}
          {topic?.competitorInsights && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Eye className="h-3 w-3" /> Competitor Insights
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {topic.competitorInsights}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
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
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Assign Sheet: Full topic selector ───────────────────────────

function AssignSheet({
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
  const catLabel = (catId: string) => {
    const c = categories.find((cat) => cat.id === catId);
    return c?.labels.de ?? c?.labels.en ?? catId;
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Schedule for {dateStr ? format(new Date(dateStr), "EEEE, d. MMMM", { locale: de }) : ""}
          </SheetTitle>
          <SheetDescription>
            {unscheduled.length} unscheduled topic{unscheduled.length !== 1 ? "s" : ""} available
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 mt-6">
          {unscheduled.map((topic) => (
            <div
              key={topic.id}
              className="rounded-lg border p-4 space-y-3 hover:border-primary/40 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm leading-snug">{topic.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{catLabel(topic.category)}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground capitalize">{topic.searchIntent}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">~{topic.estimatedSections} sections</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px]">P{topic.priority}</Badge>
                  <TopicStatusBadge status={topic.status} />
                </div>
              </div>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1">
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  {topic.keywords.primary}
                </Badge>
                {topic.keywords.secondary.slice(0, 3).map((kw) => (
                  <Badge key={kw} variant="outline" className="text-[10px] px-1.5 py-0">
                    {kw}
                  </Badge>
                ))}
              </div>

              {/* Suggested Angle */}
              {topic.suggestedAngle && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {topic.suggestedAngle}
                </p>
              )}

              {/* Created + Assign */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {topic.createdAt && `Created ${format(new Date(topic.createdAt), "dd.MM.yyyy")}`}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    onAssign(topic.id, dateStr);
                    onClose();
                  }}
                >
                  <Calendar className="mr-1.5 h-3 w-3" />
                  Schedule
                </Button>
              </div>
            </div>
          ))}

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
      </SheetContent>
    </Sheet>
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

  const getItemForDate = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return calendarItems.find((item) => item.scheduledDate === dateStr);
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
    if (!item || item.scheduledDate === targetDateStr) return;

    const targetOccupied = calendarItems.some(
      (ci) => ci.scheduledDate === targetDateStr && ci.id !== item.id
    );
    if (targetOccupied) return;

    const topicId = item.type === "topic"
      ? item.id
      : contentData.find((c) => c.id === item.id)?.topicId;

    if (topicId) {
      setTopicData((prev) =>
        prev.map((t) =>
          t.id === topicId ? { ...t, scheduledDate: targetDateStr } : t
        )
      );
    }
  }

  function handleAssign(topicId: string, dateStr: string) {
    setTopicData((prev) =>
      prev.map((t) =>
        t.id === topicId
          ? { ...t, scheduledDate: dateStr, status: "approved" as const }
          : t
      )
    );
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
                  const item = getItemForDate(day);
                  const isToday = isSameDay(day, today);
                  const isWeekend =
                    day.getDay() === 0 || day.getDay() === 6;
                  const isOutsideMonth = !isSameMonth(day, currentDate);
                  const dateStr = format(day, "yyyy-MM-dd");

                  return (
                    <div
                      key={day.toISOString()}
                      className={`flex items-stretch ${
                        idx < 6 ? "border-b" : ""
                      } ${isToday ? "bg-primary/5" : ""} ${
                        isWeekend ? "bg-muted/30" : ""
                      } ${isOutsideMonth ? "opacity-40" : ""}`}
                    >
                      <div
                        className={`w-20 shrink-0 flex flex-col items-center justify-center py-2.5 border-r ${
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : ""
                        }`}
                      >
                        <span className="text-[10px] font-medium uppercase leading-none">
                          {format(day, "EEE", { locale: de })}
                        </span>
                        <span className="text-lg font-bold leading-tight">
                          {format(day, "dd")}
                        </span>
                      </div>

                      <DroppableDaySlot dateStr={dateStr}>
                        {item ? (
                          <DraggableItem
                            item={item}
                            onClickItem={setSelectedItem}
                          />
                        ) : isWeekend ? null : (
                          <button
                            onClick={() => unscheduled.length > 0 ? setAssignDate(dateStr) : undefined}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group w-full py-1"
                          >
                            <Plus className={`h-3 w-3 transition-opacity ${unscheduled.length > 0 ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`} />
                            <span>No article scheduled</span>
                          </button>
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

      {/* Detail Sheet — click on scheduled item */}
      <DetailSheet
        item={selectedItem}
        topic={selectedTopic}
        content={selectedContent}
        categories={categories}
        onClose={() => setSelectedItem(null)}
      />

      {/* Assign Sheet — click on empty day */}
      <AssignSheet
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
