"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TopicStatusBadge } from "@/components/status-badge";
import { useProject } from "@/lib/project-context";
import {
  getTopic,
  updateTopicNotes,
  approveTopic,
  rejectTopic,
  startProduction,
  scheduleTopic,
  enrichTopic,
  getContent,
} from "@/lib/api";
import type { Topic, ContentItem } from "@/lib/types";
import {
  ArrowLeft,
  Check,
  X,
  Play,
  Loader2,
  CalendarIcon,
  Clock,
  Save,
  ArrowRight,
  Sparkles,
  Search,
  FileText,
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
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");

  const loadTopic = useCallback(async () => {
    if (!customerId || !projectId) return;
    setLoading(true);
    try {
      const t = await getTopic(customerId, projectId, topicId);
      setTopic(t);
      if (t) {
        setNotes(t.userNotes ?? "");
        if (t.scheduledDate) {
          const [d, time] = t.scheduledDate.split("T");
          setSchedDate(d);
          setSchedTime(time ?? "");
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

  const handleApprove = async () => {
    if (!topic) return;
    setActionLoading(true);
    try {
      const { topic: updated } = await approveTopic(
        customerId,
        projectId,
        topic.id,
      );
      setTopic(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!topic) return;
    setActionLoading(true);
    try {
      const { topic: updated } = await rejectTopic(
        customerId,
        projectId,
        topic.id,
      );
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

  const handleEnrich = async () => {
    if (!topic) return;
    setActionLoading(true);
    try {
      await enrichTopic(customerId, projectId, topic.id);
      // Poll for completion
      setTimeout(() => loadTopic(), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!topic) return;
    setNotesSaving(true);
    try {
      const { topic: updated } = await updateTopicNotes(
        customerId,
        projectId,
        topic.id,
        notes,
      );
      setTopic(updated);
      setNotesDirty(false);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!topic) return;
    const dateStr = schedDate
      ? schedTime
        ? `${schedDate}T${schedTime}`
        : schedDate
      : null;
    setActionLoading(true);
    try {
      const { topic: updated } = await scheduleTopic(
        customerId,
        projectId,
        topic.id,
        dateStr,
      );
      setTopic(updated);
    } finally {
      setActionLoading(false);
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
          <Badge variant="outline" className="text-xs">
            Topic
          </Badge>
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
          {linkedContent && (
            <Link href={`/content/${linkedContent.id}`}>
              <Button size="sm" variant="outline">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Open in Editor
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold">{topic.title}</h1>
        {topic.suggestedAngle && (
          <p className="text-muted-foreground mt-1">{topic.suggestedAngle}</p>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Keywords */}
          {topic.keywords && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Keywords</h3>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    {topic.keywords.primary}
                  </Badge>
                </div>
                {topic.keywords.secondary.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {topic.keywords.secondary.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                )}
                {topic.keywords.longTail.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {topic.keywords.longTail.map((kw) => (
                      <Badge
                        key={kw}
                        variant="outline"
                        className="text-xs text-muted-foreground"
                      >
                        {kw}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Competitor Insights */}
          {topic.competitorInsights && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Competitor Insights</h3>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground whitespace-pre-wrap">
                {topic.competitorInsights}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          {topic.reasoning && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">AI Analysis</h3>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground whitespace-pre-wrap">
                {topic.reasoning}
              </div>
            </div>
          )}

          {/* User Notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notes</h3>
              {notesDirty && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                >
                  {notesSaving ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  Save
                </Button>
              )}
            </div>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesDirty(true);
              }}
              placeholder="Add your notes..."
              className="min-h-[100px] resize-y"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Category */}
          {catLabel && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Category
              </p>
              <p className="text-sm font-medium">{catLabel}</p>
            </div>
          )}

          {/* Search Intent */}
          {topic.searchIntent && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Search Intent
              </p>
              <div className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium capitalize">
                  {topic.searchIntent}
                </p>
              </div>
            </div>
          )}

          {/* Estimated Sections */}
          {topic.estimatedSections > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Sections
              </p>
              <p className="text-sm font-medium">~{topic.estimatedSections}</p>
            </div>
          )}

          {/* Scheduling */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Scheduling
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="relative w-24">
                <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-xs w-full"
              onClick={handleSchedule}
              disabled={actionLoading}
            >
              Apply
            </Button>
          </div>

          {/* Created */}
          {topic.createdAt && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Created
              </p>
              <p className="text-sm">
                {new Date(topic.createdAt).toLocaleDateString("de-DE", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          )}

          {/* Linked Article */}
          {linkedContent && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Article
              </p>
              <Link
                href={`/content/${linkedContent.id}`}
                className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {linkedContent.title || "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {linkedContent.status}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
