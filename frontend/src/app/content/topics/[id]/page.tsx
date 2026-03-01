"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TopicStatusBadge } from "@/components/status-badge";
import { useProject } from "@/lib/project-context";
import {
  getTopic,
  updateTopic,
  approveTopic,
  rejectTopic,
  restoreTopic,
  startProduction,
  scheduleTopic,
  enrichTopic,
  getContent,
} from "@/lib/api";
import type { Topic, ContentItem } from "@/lib/types";
import { TopicChat } from "@/components/topic-chat";
import {
  ArrowLeft,
  Check,
  X,
  Play,
  Loader2,
  CalendarIcon,
  Sparkles,
  FileText,
  MessageSquare,
  RotateCcw,
} from "lucide-react";

export default function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: topicId } = use(params);
  const router = useRouter();
  const { customerId, projectId, categories } = useProject();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [linkedContent, setLinkedContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Editable fields
  const [editTitle, setEditTitle] = useState("");
  const [editAngle, setEditAngle] = useState("");
  const [notes, setNotes] = useState("");
  const [schedValue, setSchedValue] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  // Keyword inputs per group
  const [newPrimary, setNewPrimary] = useState("");
  const [newSecondary, setNewSecondary] = useState("");
  const [newLongTail, setNewLongTail] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);

  const loadTopic = useCallback(async () => {
    if (!customerId || !projectId) return;
    setLoading(true);
    try {
      const t = await getTopic(customerId, projectId, topicId);
      setTopic(t);
      if (t) {
        setEditTitle(t.title);
        setEditAngle(t.suggestedAngle ?? "");
        setNotes(t.userNotes ?? "");
        if (t.scheduledDate) {
          // datetime-local expects "YYYY-MM-DDTHH:mm"
          setSchedValue(t.scheduledDate.includes("T") ? t.scheduledDate : `${t.scheduledDate}T09:00`);
        }
      }
      // Find linked content
      if (t?.articleId) {
        const { items } = await getContent(customerId, projectId);
        const linked = items.find(
          (c) => c.topicId === topicId || c.id === t.articleId,
        );
        setLinkedContent(linked ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId, topicId]);

  useEffect(() => {
    loadTopic();
  }, [loadTopic]);

  // ── Auto-save helper ──────────────────────────────────────────
  const saveField = async (field: string, value: unknown) => {
    if (!topic) return;
    setSaving(field);
    try {
      const { topic: updated } = await updateTopic(
        customerId,
        projectId,
        topic.id,
        { [field]: value } as Partial<Topic>,
      );
      setTopic(updated);
    } finally {
      setSaving(null);
    }
  };

  // ── Title ─────────────────────────────────────────────────────
  const handleTitleBlur = () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === topic?.title) return;
    saveField("title", trimmed);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      titleRef.current?.blur();
    }
    if (e.key === "Escape") {
      setEditTitle(topic?.title ?? "");
      titleRef.current?.blur();
    }
  };

  // ── Angle ─────────────────────────────────────────────────────
  const handleAngleBlur = () => {
    const trimmed = editAngle.trim();
    if (trimmed === (topic?.suggestedAngle ?? "")) return;
    saveField("suggestedAngle", trimmed);
  };

  // ── Notes ─────────────────────────────────────────────────────
  const handleNotesBlur = () => {
    if (notes === (topic?.userNotes ?? "")) return;
    saveField("userNotes", notes);
  };

  // ── Keywords ──────────────────────────────────────────────────
  const removeKeyword = (type: "secondary" | "longTail", kw: string) => {
    if (!topic?.keywords) return;
    const updated = {
      ...topic.keywords,
      [type]: topic.keywords[type]?.filter((k) => k !== kw) ?? [],
    };
    saveField("keywords", updated);
  };

  const addKeywordToGroup = (type: "secondary" | "longTail", kw: string) => {
    if (!topic?.keywords) return;
    const list = topic.keywords[type] ?? [];
    if (list.includes(kw)) return;
    saveField("keywords", { ...topic.keywords, [type]: [...list, kw] });
  };

  const handlePrimaryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = newPrimary.trim();
      if (!val || !topic?.keywords) return;
      saveField("keywords", { ...topic.keywords, primary: val });
      setNewPrimary("");
    }
  };

  const removePrimary = () => {
    if (!topic?.keywords) return;
    saveField("keywords", { ...topic.keywords, primary: "" });
  };

  const handleSecondaryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = newSecondary.trim();
      if (!val) return;
      addKeywordToGroup("secondary", val);
      setNewSecondary("");
    }
    if (e.key === "Backspace" && !newSecondary && topic?.keywords?.secondary?.length) {
      removeKeyword("secondary", topic.keywords.secondary[topic.keywords.secondary.length - 1]);
    }
  };

  const handleLongTailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = newLongTail.trim();
      if (!val) return;
      addKeywordToGroup("longTail", val);
      setNewLongTail("");
    }
    if (e.key === "Backspace" && !newLongTail && topic?.keywords?.longTail?.length) {
      removeKeyword("longTail", topic.keywords.longTail[topic.keywords.longTail.length - 1]);
    }
  };

  // ── Actions ───────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!topic) return;
    setActionLoading(true);
    try {
      const { topic: updated } = await approveTopic(customerId, projectId, topic.id);
      setTopic(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!topic) return;
    setActionLoading(true);
    try {
      const { topic: updated } = await rejectTopic(customerId, projectId, topic.id);
      setTopic(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handleProduce = async () => {
    if (!topic) return;
    setActionLoading(true);
    try {
      await startProduction(customerId, projectId, topic.id);
      await loadTopic();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!topic) return;
    setActionLoading(true);
    try {
      const { topic: updated } = await restoreTopic(customerId, projectId, topic.id);
      setTopic(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnrich = async () => {
    if (!topic) return;
    setActionLoading(true);
    try {
      await enrichTopic(customerId, projectId, topic.id);
      setTimeout(() => loadTopic(), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleChange = async (value: string) => {
    setSchedValue(value);
    if (!topic) return;
    // Send YYYY-MM-DDTHH:mm or null to clear
    const dateStr = value || null;
    setSaving("scheduledDate");
    try {
      const { topic: updated } = await scheduleTopic(customerId, projectId, topic.id, dateStr);
      setTopic(updated);
    } finally {
      setSaving(null);
    }
  };

  const catLabel = topic?.category
    ? categories.find((c) => c.id === topic.category)?.labels?.de ??
      topic.category
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Topic not found.</p>
        <Link href="/content" className="text-sm text-primary hover:underline">
          Back to Articles
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/content">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <TopicStatusBadge status={topic.status} />
        </div>
        <div className="flex items-center gap-2">
          {topic.source === "user" && !topic.enriched && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleEnrich}
              disabled={actionLoading}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Analyze
            </Button>
          )}
          {topic.status === "proposed" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReject}
                disabled={actionLoading}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Approve
              </Button>
            </>
          )}
          {topic.status === "approved" && (
            <Button
              size="sm"
              onClick={handleProduce}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              Produce
            </Button>
          )}
          {topic.status === "rejected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestore}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Restore
            </Button>
          )}
          {linkedContent && (
            <Link href={`/content/${linkedContent.id}`}>
              <Button size="sm" variant="outline">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Open in Editor
              </Button>
            </Link>
          )}
          <Button
            size="sm"
            variant={chatOpen ? "default" : "outline"}
            onClick={() => setChatOpen(!chatOpen)}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            AI Chat
          </Button>
        </div>
      </div>

      {/* Editable Title + Angle */}
      <div className="rounded-xl bg-muted/40 px-5 py-4 space-y-1">
        <div className="relative">
          <input
            ref={titleRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="w-full text-2xl font-bold bg-transparent border-none outline-none rounded px-1 -mx-1 hover:bg-muted/50 focus:bg-muted/50 transition-colors"
          />
          {saving === "title" && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="relative">
          <input
            value={editAngle}
            onChange={(e) => setEditAngle(e.target.value)}
            onBlur={handleAngleBlur}
            placeholder="Add a suggested angle..."
            className="w-full text-sm text-muted-foreground bg-transparent border-none outline-none rounded px-1 -mx-1 hover:bg-muted/50 focus:bg-muted/50 transition-colors"
          />
          {saving === "suggestedAngle" && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm rounded-xl bg-muted/40 px-5 py-3">
        {/* Category */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Category</span>
          {categories.length > 0 ? (
            <>
              <Select
                value={topic.category || ""}
                onValueChange={(v) => saveField("category", v)}
              >
                <SelectTrigger size="sm" className="h-7 text-xs border-dashed">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.labels?.de ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {saving === "category" && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </>
          ) : (
            <span className="font-medium">{catLabel ?? "—"}</span>
          )}
        </div>

        <span className="text-border">|</span>

        {/* Scheduling */}
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="datetime-local"
            value={schedValue}
            onChange={(e) => handleScheduleChange(e.target.value)}
            className="h-7 text-xs border-dashed w-auto"
          />
          {saving === "scheduledDate" && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>

        <span className="text-border">|</span>

        {/* Created */}
        {topic.createdAt && (
          <span className="text-xs text-muted-foreground">
            Created {new Date(topic.createdAt).toLocaleDateString("de-DE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}

        {/* Linked Article */}
        {linkedContent && (
          <>
            <span className="text-border">|</span>
            <Link
              href={`/content/${linkedContent.id}`}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              {linkedContent.title || "Untitled"}
            </Link>
          </>
        )}
      </div>

      {/* Content — single column */}
      <div className="space-y-6">
        {/* Keywords */}
        {topic.keywords && (
          <div className="rounded-xl bg-muted/40 px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Keywords</h3>
              {saving === "keywords" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Primary */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Primary</p>
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/60 px-2 py-1.5 min-h-[34px]">
                {topic.keywords.primary && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 pr-1">
                    {topic.keywords.primary}
                    <button onClick={removePrimary} className="ml-0.5 hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {!topic.keywords.primary && (
                  <input
                    value={newPrimary}
                    onChange={(e) => setNewPrimary(e.target.value)}
                    onKeyDown={handlePrimaryKeyDown}
                    placeholder="Type and press Enter..."
                    className="flex-1 min-w-[120px] text-xs bg-transparent border-none outline-none"
                  />
                )}
              </div>
            </div>

            {/* Secondary */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Secondary</p>
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/60 px-2 py-1.5 min-h-[34px]">
                {topic.keywords.secondary?.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs gap-1 pr-1">
                    {kw}
                    <button onClick={() => removeKeyword("secondary", kw)} className="ml-0.5 hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  value={newSecondary}
                  onChange={(e) => setNewSecondary(e.target.value)}
                  onKeyDown={handleSecondaryKeyDown}
                  placeholder={topic.keywords.secondary?.length ? "" : "Type and press Enter..."}
                  className="flex-1 min-w-[120px] text-xs bg-transparent border-none outline-none"
                />
              </div>
            </div>

            {/* Long-tail */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Long-tail</p>
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/60 px-2 py-1.5 min-h-[34px]">
                {topic.keywords.longTail?.map((kw) => (
                  <Badge key={kw} variant="outline" className="text-xs text-muted-foreground gap-1 pr-1">
                    {kw}
                    <button onClick={() => removeKeyword("longTail", kw)} className="ml-0.5 hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  value={newLongTail}
                  onChange={(e) => setNewLongTail(e.target.value)}
                  onKeyDown={handleLongTailKeyDown}
                  placeholder={topic.keywords.longTail?.length ? "" : "Type and press Enter..."}
                  className="flex-1 min-w-[120px] text-xs bg-transparent border-none outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Competitor Analysis */}
        {(topic.competitorInsights || topic.reasoning) && (
          <div className="rounded-xl bg-muted/40 px-5 py-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              AI Research
            </h3>
            {topic.competitorInsights && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Competitor Analysis</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {topic.competitorInsights}
                </p>
              </div>
            )}
            {topic.reasoning && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Strategic Fit</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {topic.reasoning}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="rounded-xl bg-muted/40 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notes</h3>
            {saving === "userNotes" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add your notes..."
            className="min-h-[100px] resize-y bg-background/60 shadow-none"
          />
        </div>
      </div>

      {/* AI Chat Sidebar */}
      <TopicChat
        customerId={customerId}
        projectId={projectId}
        topicId={topicId}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onTopicUpdated={(updated) => {
          setTopic(updated);
          setEditTitle(updated.title);
          setEditAngle(updated.suggestedAngle ?? "");
          setNotes(updated.userNotes ?? "");
        }}
      />
    </div>
  );
}
