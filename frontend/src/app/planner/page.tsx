"use client";

import { useState, useCallback } from "react";
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
import { ChevronLeft, ChevronRight, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StageBadge, ConditionBadge, TopicStatusBadge } from "@/components/status-badge";
import {
  articles as initialArticles,
  topics as initialTopics,
} from "@/lib/mock-data";
import type { Article, Topic, ArticleStage, ArticleCondition, TopicStatus } from "@/lib/types";
import Link from "next/link";

// ── Types ───────────────────────────────────────────────────────

interface CalendarItem {
  id: string;
  title: string;
  subtitle: string;
  type: "article" | "topic";
  scheduledDate: string;
  // Articles have stage + condition, topics have topicStatus
  stage?: ArticleStage;
  condition?: ArticleCondition;
  topicStatus?: TopicStatus;
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
  articles: Article[],
  topics: Topic[]
): CalendarItem[] {
  const items: CalendarItem[] = [];
  const articleTopicIds = new Set(articles.map((a) => a.topicId));

  for (const a of articles) {
    if (!a.scheduledDate) continue;
    items.push({
      id: a.id,
      title: a.title,
      subtitle: `${a.author} · ${a.category}`,
      type: "article",
      scheduledDate: a.scheduledDate,
      stage: a.stage,
      condition: a.condition,
    });
  }

  for (const t of topics) {
    if (!t.scheduledDate || articleTopicIds.has(t.id)) continue;
    items.push({
      id: t.id,
      title: t.title,
      subtitle: t.category,
      type: "topic",
      scheduledDate: t.scheduledDate,
      topicStatus: t.status,
    });
  }

  return items;
}

// ── Draggable Article Card ──────────────────────────────────────

function DraggableItem({ item }: { item: CalendarItem }) {
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
      <Link
        href={item.type === "article" ? `/articles/${item.id}` : "#"}
        className="flex items-center justify-between gap-3 flex-1 min-w-0"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.stage && <StageBadge stage={item.stage} />}
          {item.condition && <ConditionBadge condition={item.condition} />}
          {item.topicStatus && <TopicStatusBadge status={item.topicStatus} />}
        </div>
      </Link>
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
        {item.stage && <StageBadge stage={item.stage} />}
        {item.condition && <ConditionBadge condition={item.condition} />}
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

// ── Assign Popover (click empty day → pick topic) ───────────────

function AssignPopover({
  dateStr,
  unscheduled,
  onAssign,
}: {
  dateStr: string;
  unscheduled: Topic[];
  onAssign: (topicId: string, date: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (unscheduled.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        No article scheduled
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group w-full py-1">
          <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span>No article scheduled</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <p className="text-xs font-medium text-muted-foreground px-2 pb-2">
          Assign topic to {dateStr}
        </p>
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {unscheduled.map((topic) => (
            <button
              key={topic.id}
              onClick={() => {
                onAssign(topic.id, dateStr);
                setOpen(false);
              }}
              className="flex items-center justify-between w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{topic.title}</p>
                <p className="text-xs text-muted-foreground">
                  {topic.category} · {topic.priority}
                </p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function CreatorPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [articleData, setArticleData] = useState(initialArticles);
  const [topicData, setTopicData] = useState(initialTopics);
  const [activeItem, setActiveItem] = useState<CalendarItem | null>(null);

  const weeks = getWeeksOfMonth(currentDate);
  const today = new Date();
  const calendarItems = buildCalendarItems(articleData, topicData);

  // Unscheduled topics (for the assign popover)
  const scheduledTopicIds = new Set([
    ...articleData.map((a) => a.topicId),
    ...topicData.filter((t) => t.scheduledDate).map((t) => t.id),
  ]);
  const unscheduled = topicData.filter(
    (t) =>
      !t.scheduledDate &&
      !scheduledTopicIds.has(t.id) &&
      (["researched", "approved"] as string[]).includes(t.status)
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

    // Check if target date already has an item
    const targetOccupied = calendarItems.some(
      (ci) => ci.scheduledDate === targetDateStr && ci.id !== item.id
    );
    if (targetOccupied) return;

    if (item.type === "article") {
      setArticleData((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, scheduledDate: targetDateStr } : a
        )
      );
    } else {
      setTopicData((prev) =>
        prev.map((t) =>
          t.id === item.id ? { ...t, scheduledDate: targetDateStr } : t
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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Creator</h1>
            <p className="text-muted-foreground">Editorial Calendar</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Article
          </Button>
        </div>

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
              {/* KW Header */}
              <div className="bg-muted/60 px-4 py-1.5 border-b">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  KW {week.kw}
                </span>
              </div>

              {/* Days */}
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
                    {/* Date Column */}
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

                    {/* Content Column (droppable) */}
                    <DroppableDaySlot dateStr={dateStr}>
                      {item ? (
                        <DraggableItem item={item} />
                      ) : isWeekend ? null : (
                        <AssignPopover
                          dateStr={dateStr}
                          unscheduled={unscheduled}
                          onAssign={handleAssign}
                        />
                      )}
                    </DroppableDaySlot>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeItem ? <DragOverlayCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
