"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopicStatusBadge, ContentStatusBadge, ContentTypeBadge } from "@/components/status-badge";
import { useProject } from "@/lib/project-context";
import {
  getTopics,
  getContent,
  approveTopic,
  rejectTopic,
  restoreTopic,
  startProduction,
  enrichTopic,
} from "@/lib/api";
import type { Topic, ContentItem, ContentItemStatus } from "@/lib/types";
import { format } from "date-fns";
import {
  Play,
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Check,
  Plus,
  FileText,
  Calendar,
  List,
  LayoutGrid,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { NewContentWizard } from "@/components/new-content-wizard";

// ── Tab configuration ──────────────────────────────────────────

type TabKey = "ideas" | "rejected" | "in_production" | "review" | "published" | "archived" | "all";

const IDEA_TOPIC_STATUSES = ["proposed", "approved"] as const;

const CONTENT_TAB_MAP: Record<ContentItemStatus, TabKey> = {
  planned: "in_production",
  producing: "in_production",
  draft: "in_production",
  review: "review",
  approved: "review",
  delivered: "review",
  published: "published",
  updating: "published",
  archived: "archived",
};

// ── Page ───────────────────────────────────────────────────────

export default function ContentPage() {
  const router = useRouter();
  const { customerId, projectId, categories, loading: projectLoading } = useProject();

  // Data
  const [topics, setTopics] = useState<Topic[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs + filter
  const [activeTab, setActiveTab] = useState<TabKey>("ideas");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "board">("board");

  // Topic interaction (from Research)
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  // New Content wizard
  const [wizardOpen, setWizardOpen] = useState(false);

  // ── Data loading ─────────────────────────────────────────────

  const loadData = async () => {
    if (!customerId || !projectId) return;
    try {
      const [t, res] = await Promise.all([
        getTopics(customerId, projectId),
        getContent(customerId, projectId),
      ]);
      setTopics(t);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  };

  useEffect(() => {
    if (!customerId || !projectId) return;
    setLoading(true);
    setError(null);
    loadData().finally(() => setLoading(false));
  }, [customerId, projectId]);

  // ── Topic handlers (from Research, verbatim) ─────────────────

  const toggleExpanded = (id: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async (topicId: string) => {
    setActionLoading(topicId);
    try {
      await approveTopic(customerId, projectId, topicId);
      setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, status: "approved" as const } : t));
    } catch (err) {
      console.error("Failed to approve topic:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (topicId: string) => {
    setActionLoading(topicId);
    try {
      await rejectTopic(customerId, projectId, topicId);
      setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, status: "rejected" as const } : t));
    } catch (err) {
      console.error("Failed to reject topic:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (topicId: string) => {
    setActionLoading(topicId);
    try {
      await restoreTopic(customerId, projectId, topicId);
      setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, status: "proposed" as const } : t));
    } catch (err) {
      console.error("Failed to restore topic:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleProduce = async (topicId: string) => {
    setActionLoading(topicId);
    try {
      await startProduction(customerId, projectId, topicId);
      // Refresh both datasets so the item appears in In Production tab
      await loadData();
      setActiveTab("in_production");
    } catch (err) {
      console.error("Failed to start production:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const startEnrichmentPolling = (topicId: string) => {
    setEnrichingIds((prev) => new Set(prev).add(topicId));
    const poll = setInterval(async () => {
      try {
        const updated = await getTopics(customerId, projectId);
        const enriched = updated.find((t) => t.id === topicId);
        if (enriched?.enriched) {
          clearInterval(poll);
          setTopics(updated);
          setEnrichingIds((prev) => {
            const next = new Set(prev);
            next.delete(topicId);
            return next;
          });
        }
      } catch {
        clearInterval(poll);
        setEnrichingIds((prev) => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
      }
    }, 3000);
    setTimeout(() => {
      clearInterval(poll);
      setEnrichingIds((prev) => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }, 120_000);
  };

  const handleTopicCreated = (topic: Topic) => {
    setTopics((prev) => [topic, ...prev]);
    startEnrichmentPolling(topic.id);
  };

  const handleEnrich = async (topicId: string) => {
    if (!customerId || !projectId) return;
    try {
      await enrichTopic(customerId, projectId, topicId);
      startEnrichmentPolling(topicId);
    } catch {
      // silent
    }
  };

  // ── Derived data ─────────────────────────────────────────────

  const ideaTopics = topics.filter(
    (t) => (IDEA_TOPIC_STATUSES as readonly string[]).includes(t.status),
  );

  const rejectedTopics = topics.filter((t) => t.status === "rejected");

  const topicById = new Map(topics.map((t) => [t.id, t]));

  const tabCounts: Record<TabKey, number> = {
    ideas: ideaTopics.length,
    rejected: rejectedTopics.length,
    in_production: items.filter((i) => CONTENT_TAB_MAP[i.status] === "in_production").length,
    review: items.filter((i) => CONTENT_TAB_MAP[i.status] === "review").length,
    published: items.filter((i) => CONTENT_TAB_MAP[i.status] === "published").length,
    archived: items.filter((i) => CONTENT_TAB_MAP[i.status] === "archived").length,
    all: ideaTopics.length + items.length,
  };

  // Filtered topics for Ideas tab
  const visibleTopics = ideaTopics
    .filter((t) => t.status !== "rejected")
    .filter((t) => filterCategory === "all" || t.category === filterCategory)
    .sort((a, b) => a.priority - b.priority);

  // Filtered content items for other tabs
  const visibleItems = items
    .filter((i) => {
      if (activeTab !== "all" && CONTENT_TAB_MAP[i.status] !== activeTab) return false;
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // ── Loading / error ──────────────────────────────────────────

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">Make sure the backend is running on port 6100</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────

  const fmt = (iso: string) => format(new Date(iso), "dd.MM.yy");

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Articles</h1>
          <p className="text-muted-foreground text-sm">
            {tabCounts.ideas > 0 && (
              <><span className="text-primary font-medium">{tabCounts.ideas} ideas</span> &middot; </>
            )}
            Full content lifecycle
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.labels.de ?? cat.labels.en ?? cat.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="sm"
              className={`h-9 px-2.5 rounded-r-none ${viewMode === "list" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-9 px-2.5 rounded-l-none ${viewMode === "board" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setViewMode("board")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Content
          </Button>
        </div>
      </div>

      <NewContentWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onTopicCreated={handleTopicCreated}
      />

      {/* Board View */}
      {viewMode === "board" && (
        <BoardView
          topics={ideaTopics.filter((t) => t.status !== "rejected").filter((t) => filterCategory === "all" || t.category === filterCategory)}
          items={items.filter((i) => filterCategory === "all" || i.category === filterCategory)}
          categories={categories}
          topicById={topicById}
          expandedTopics={expandedTopics}
          enrichingIds={enrichingIds}
          actionLoading={actionLoading}
          toggleExpanded={toggleExpanded}
          handleApprove={handleApprove}
          handleReject={handleReject}
          handleProduce={handleProduce}
          handleEnrich={handleEnrich}
          fmt={fmt}
        />
      )}

      {/* List View (Tabs) */}
      {viewMode === "list" && (
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="ideas">
            Ideas
            {tabCounts.ideas > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({tabCounts.ideas})</span>}
          </TabsTrigger>
          {rejectedTopics.length > 0 && (
            <TabsTrigger value="rejected">
              Rejected
              <span className="ml-1.5 text-xs text-muted-foreground">({tabCounts.rejected})</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="in_production">
            In Production
            {tabCounts.in_production > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({tabCounts.in_production})</span>}
          </TabsTrigger>
          <TabsTrigger value="review">
            Review
            {tabCounts.review > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({tabCounts.review})</span>}
          </TabsTrigger>
          <TabsTrigger value="published">
            Published
            {tabCounts.published > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({tabCounts.published})</span>}
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived
            {tabCounts.archived > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({tabCounts.archived})</span>}
          </TabsTrigger>
          <TabsTrigger value="all">
            All
            {tabCounts.all > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({tabCounts.all})</span>}
          </TabsTrigger>
        </TabsList>

        {/* Ideas Tab */}
        <TabsContent value="ideas" className="mt-4">
          <TopicList
            topics={visibleTopics}
            categories={categories}
            expandedTopics={expandedTopics}
            enrichingIds={enrichingIds}
            actionLoading={actionLoading}
            toggleExpanded={toggleExpanded}
            handleApprove={handleApprove}
            handleReject={handleReject}
            handleProduce={handleProduce}
            handleEnrich={handleEnrich}
          />
          {visibleTopics.length === 0 && (
            <EmptyState
              icon={<Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />}
              title="No content ideas yet"
              description="Discover new topics or submit your own"
              action={<Button className="mt-4" onClick={() => setWizardOpen(true)}><Plus className="mr-2 h-4 w-4" />New Content</Button>}
            />
          )}
        </TabsContent>

        {/* Rejected Tab */}
        <TabsContent value="rejected" className="mt-4">
          <TopicList
            topics={rejectedTopics.filter((t) => filterCategory === "all" || t.category === filterCategory)}
            categories={categories}
            expandedTopics={expandedTopics}
            enrichingIds={enrichingIds}
            actionLoading={actionLoading}
            toggleExpanded={toggleExpanded}
            handleApprove={handleApprove}
            handleReject={handleReject}
            handleProduce={handleProduce}
            handleEnrich={handleEnrich}
            handleRestore={handleRestore}
          />
        </TabsContent>

        {/* In Production Tab */}
        <TabsContent value="in_production" className="mt-4">
          <ContentTable items={visibleItems} categories={categories} topicById={topicById} fmt={fmt} />
          {visibleItems.length === 0 && (
            <EmptyState
              icon={<FileText className="mb-3 h-8 w-8 text-muted-foreground" />}
              title="No content in production"
              description="Approve an idea and hit Produce to start"
            />
          )}
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review" className="mt-4">
          <ContentTable items={visibleItems} categories={categories} topicById={topicById} fmt={fmt} />
          {visibleItems.length === 0 && (
            <EmptyState
              icon={<FileText className="mb-3 h-8 w-8 text-muted-foreground" />}
              title="No content pending review"
              description="Content moves here after production completes"
            />
          )}
        </TabsContent>

        {/* Published Tab */}
        <TabsContent value="published" className="mt-4">
          <ContentTable items={visibleItems} categories={categories} topicById={topicById} fmt={fmt} />
          {visibleItems.length === 0 && (
            <EmptyState
              icon={<FileText className="mb-3 h-8 w-8 text-muted-foreground" />}
              title="No published content yet"
              description="Published content will appear here"
            />
          )}
        </TabsContent>

        {/* Archived Tab */}
        <TabsContent value="archived" className="mt-4">
          <ContentTable items={visibleItems} categories={categories} topicById={topicById} fmt={fmt} />
          {visibleItems.length === 0 && (
            <EmptyState
              icon={<FileText className="mb-3 h-8 w-8 text-muted-foreground" />}
              title="No archived content"
              description="Archived content will appear here"
            />
          )}
        </TabsContent>

        {/* All Tab */}
        <TabsContent value="all" className="mt-4 space-y-6">
          {visibleTopics.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ideas</h3>
              <TopicList
                topics={visibleTopics}
                categories={categories}
                expandedTopics={expandedTopics}
                enrichingIds={enrichingIds}
                actionLoading={actionLoading}
                toggleExpanded={toggleExpanded}
                handleApprove={handleApprove}
                handleReject={handleReject}
                handleProduce={handleProduce}
                handleEnrich={handleEnrich}
              />
            </div>
          )}
          {visibleItems.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Content</h3>
              <ContentTable items={visibleItems} categories={categories} topicById={topicById} fmt={fmt} />
            </div>
          )}
          {visibleTopics.length === 0 && visibleItems.length === 0 && (
            <EmptyState
              icon={<FileText className="mb-3 h-8 w-8 text-muted-foreground" />}
              title="No content yet"
              description="Start by discovering topics or creating content manually"
              action={<Button className="mt-4" onClick={() => setWizardOpen(true)}><Plus className="mr-2 h-4 w-4" />New Content</Button>}
            />
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      {action}
    </div>
  );
}

function TopicList({
  topics,
  categories,
  expandedTopics,
  enrichingIds,
  actionLoading,
  toggleExpanded,
  handleApprove,
  handleReject,
  handleProduce,
  handleEnrich,
  handleRestore,
}: {
  topics: Topic[];
  categories: { id: string; labels: Record<string, string> }[];
  expandedTopics: Set<string>;
  enrichingIds: Set<string>;
  actionLoading: string | null;
  toggleExpanded: (id: string) => void;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleProduce: (id: string) => void;
  handleEnrich: (id: string) => void;
  handleRestore?: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {topics.map((topic) => {
        const isExpanded = expandedTopics.has(topic.id);
        const isEnriching = enrichingIds.has(topic.id);
        const isActionLoading = actionLoading === topic.id;
        const categoryLabel = categories.find((c) => c.id === topic.category)?.labels.de ?? topic.category;
        const isNew = topic.createdAt && (Date.now() - new Date(topic.createdAt).getTime()) < 86400000;

        return (
          <div
            key={topic.id}
            className="rounded-lg border overflow-hidden hover:border-primary/30 transition-colors"
          >
            {/* Main Row */}
            <div
              className="flex items-center gap-4 px-4 py-3 cursor-pointer"
              onClick={() => toggleExpanded(topic.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isEnriching && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                  )}
                  <Link
                    href={`/content/topics/${topic.id}`}
                    className="text-sm font-semibold truncate hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {topic.title}
                  </Link>
                  {isNew && !isEnriching && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                      New
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {categoryLabel && (
                    <span className="text-xs text-muted-foreground">{categoryLabel}</span>
                  )}
                  {topic.keywords?.primary && (
                    <>
                      <span className="text-xs text-muted-foreground">&middot;</span>
                      <span className="text-xs text-muted-foreground/70">{topic.keywords.primary}</span>
                    </>
                  )}
                  {topic.createdAt && (
                    <>
                      <span className="text-xs text-muted-foreground">&middot;</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(topic.createdAt), "dd.MM.yyyy")}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <TopicStatusBadge status={topic.status} />
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
                {topic.userNotes && (
                  <div className="rounded-md bg-background border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{topic.userNotes}</p>
                  </div>
                )}

                {topic.suggestedAngle && (
                  <div className="rounded-md bg-background border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Angle</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{topic.suggestedAngle}</p>
                  </div>
                )}

                {topic.reasoning && (
                  <div className="rounded-md bg-background border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Analysis
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{topic.reasoning}</p>
                  </div>
                )}

                {topic.competitorInsights && (
                  <div className="rounded-md bg-background border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      Competition
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{topic.competitorInsights}</p>
                  </div>
                )}

                {topic.keywords?.primary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium">
                        {topic.keywords.primary}
                      </span>
                      {topic.keywords.secondary?.map((kw) => (
                        <span key={kw} className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {kw}
                        </span>
                      ))}
                      {topic.keywords.longTail?.map((kw) => (
                        <span key={kw} className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground/70">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Link href={`/content/topics/${topic.id}`} onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="h-7">
                      <Eye className="mr-1 h-3 w-3" />
                      Open
                    </Button>
                  </Link>
                  {topic.source === "user" && !topic.enriched && !isEnriching && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={(e) => { e.stopPropagation(); handleEnrich(topic.id); }}
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      Analyze
                    </Button>
                  )}
                  {topic.status === "proposed" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-muted-foreground hover:text-red-600"
                        onClick={(e) => { e.stopPropagation(); handleReject(topic.id); }}
                        disabled={isActionLoading}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-7"
                        onClick={(e) => { e.stopPropagation(); handleApprove(topic.id); }}
                        disabled={isActionLoading}
                      >
                        {isActionLoading ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="mr-1 h-3 w-3" />
                        )}
                        Approve
                      </Button>
                    </>
                  )}
                  {topic.status === "approved" && (
                    <Button
                      size="sm"
                      className="h-7"
                      onClick={(e) => { e.stopPropagation(); handleProduce(topic.id); }}
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3 w-3" />
                      )}
                      Produce
                    </Button>
                  )}
                  {topic.status === "rejected" && handleRestore && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={(e) => { e.stopPropagation(); handleRestore(topic.id); }}
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-1 h-3 w-3" />
                      )}
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContentTable({
  items,
  categories,
  topicById,
  fmt,
}: {
  items: ContentItem[];
  categories: { id: string; labels: Record<string, string> }[];
  topicById: Map<string, Topic>;
  fmt: (iso: string) => string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
        <div className="flex-1">Content</div>
        <div className="w-20 hidden md:block">Type</div>
        <div className="w-32 hidden md:block">Scheduled</div>
        <div className="w-24 hidden lg:block">Updated</div>
        <div className="w-24">Status</div>
        <div className="w-10"></div>
      </div>

      {items.map((item, idx) => {
        const cat = categories.find((c) => c.id === item.category);
        const topic = item.topicId ? topicById.get(item.topicId) : undefined;
        const schedDate = topic?.scheduledDate;

        return (
          <Link
            key={item.id}
            href={`/content/${item.id}`}
            className={`flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors ${
              idx < items.length - 1 ? "border-b" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.title || "Untitled"}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {item.category && (
                  <span className="text-xs text-muted-foreground">
                    {cat?.labels.de ?? item.category}
                  </span>
                )}
                {item.tags && item.tags.length > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">&middot;</span>
                    <span className="text-xs text-muted-foreground">
                      {item.tags.slice(0, 2).join(", ")}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="w-20 hidden md:block">
              <ContentTypeBadge type={item.type} />
            </div>

            <div className="w-32 hidden md:block">
              {schedDate ? (
                <div className="flex items-center gap-1.5 text-xs tabular-nums">
                  <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>{fmt(schedDate)}</span>
                  {schedDate.includes("T") && (
                    <span className="text-muted-foreground">{schedDate.split("T")[1]}</span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">&mdash;</span>
              )}
            </div>

            <div className="w-24 hidden lg:block">
              <p className="text-xs text-muted-foreground tabular-nums">
                {fmt(item.updatedAt)}
              </p>
            </div>

            <div className="w-24">
              <ContentStatusBadge status={item.status} />
            </div>

            <div className="w-10 text-right">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Board View ──────────────────────────────────────────────────

function BoardView({
  topics,
  items,
  categories,
  topicById,
  expandedTopics,
  enrichingIds,
  actionLoading,
  toggleExpanded,
  handleApprove,
  handleReject,
  handleProduce,
  handleEnrich,
  fmt,
}: {
  topics: Topic[];
  items: ContentItem[];
  categories: { id: string; labels: Record<string, string> }[];
  topicById: Map<string, Topic>;
  expandedTopics: Set<string>;
  enrichingIds: Set<string>;
  actionLoading: string | null;
  toggleExpanded: (id: string) => void;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleProduce: (id: string) => void;
  handleEnrich: (id: string) => void;
  fmt: (iso: string) => string;
}) {
  const inProduction = items.filter((i) => i.status === "planned" || i.status === "producing" || i.status === "draft");
  const inReview = items.filter((i) => i.status === "review" || i.status === "approved" || i.status === "delivered");
  const published = items.filter((i) => i.status === "published" || i.status === "updating");

  const columns = [
    { key: "ideas", label: "Ideas", topics, items: undefined as ContentItem[] | undefined },
    { key: "in_production", label: "In Production", topics: undefined as Topic[] | undefined, items: inProduction },
    { key: "review", label: "Review", topics: undefined as Topic[] | undefined, items: inReview },
    { key: "published", label: "Published", topics: undefined as Topic[] | undefined, items: published },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {columns.map((col) => {
        const count = (col.topics?.length ?? 0) + (col.items?.length ?? 0);
        return (
          <div key={col.key} className="space-y-2">
            {/* Column Header */}
            <div className="flex items-center justify-between px-1 pb-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.label}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
            </div>

            {/* Cards */}
            <div className="space-y-2 min-h-[200px]">
              {col.topics?.map((topic) => (
                <TopicBoardCard
                  key={topic.id}
                  topic={topic}
                  categories={categories}
                  isExpanded={expandedTopics.has(topic.id)}
                  isEnriching={enrichingIds.has(topic.id)}
                  isActionLoading={actionLoading === topic.id}
                  toggleExpanded={toggleExpanded}
                  handleApprove={handleApprove}
                  handleReject={handleReject}
                  handleProduce={handleProduce}
                  handleEnrich={handleEnrich}
                />
              ))}
              {col.items?.map((item) => (
                <ContentBoardCard
                  key={item.id}
                  item={item}
                  categories={categories}
                  topicById={topicById}
                  fmt={fmt}
                />
              ))}
              {count === 0 && (
                <div className="flex items-center justify-center rounded-md border border-dashed p-6 text-center">
                  <p className="text-xs text-muted-foreground">Empty</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopicBoardCard({
  topic,
  categories,
  isExpanded,
  isEnriching,
  isActionLoading,
  toggleExpanded,
  handleApprove,
  handleReject,
  handleProduce,
  handleEnrich,
}: {
  topic: Topic;
  categories: { id: string; labels: Record<string, string> }[];
  isExpanded: boolean;
  isEnriching: boolean;
  isActionLoading: boolean;
  toggleExpanded: (id: string) => void;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleProduce: (id: string) => void;
  handleEnrich: (id: string) => void;
}) {
  const categoryLabel = categories.find((c) => c.id === topic.category)?.labels.de ?? topic.category;

  return (
    <div className="rounded-lg border bg-card overflow-hidden hover:border-primary/30 transition-colors">
      {/* Collapsed Row */}
      <div
        className="flex items-start gap-2 p-3 cursor-pointer"
        onClick={() => toggleExpanded(topic.id)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isEnriching && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
            <p className="text-sm font-medium line-clamp-2">{topic.title}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {categoryLabel && <span className="text-[11px] text-muted-foreground">{categoryLabel}</span>}
            {topic.keywords?.primary && (
              <>
                <span className="text-[11px] text-muted-foreground">&middot;</span>
                <span className="text-[11px] text-muted-foreground/70 truncate">{topic.keywords.primary}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <TopicStatusBadge status={topic.status} />
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t bg-muted/20 px-3 py-2.5 space-y-2">
          {topic.suggestedAngle && (
            <p className="text-xs text-foreground/80 leading-relaxed">{topic.suggestedAngle}</p>
          )}

          {topic.keywords?.primary && (
            <div className="flex flex-wrap gap-1">
              <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
                {topic.keywords.primary}
              </span>
              {topic.keywords.secondary.slice(0, 3).map((kw) => (
                <span key={kw} className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Link href={`/content/topics/${topic.id}`} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2">
                <Eye className="mr-1 h-3 w-3" />Details
              </Button>
            </Link>
            {topic.source === "user" && !topic.enriched && !isEnriching && (
              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                onClick={(e) => { e.stopPropagation(); handleEnrich(topic.id); }}>
                <Sparkles className="mr-1 h-3 w-3" />Analyze
              </Button>
            )}
            {topic.status === "proposed" && (
              <>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-muted-foreground hover:text-red-600"
                  onClick={(e) => { e.stopPropagation(); handleReject(topic.id); }} disabled={isActionLoading}>
                  <X className="mr-1 h-3 w-3" />Reject
                </Button>
                <Button size="sm" className="h-6 text-[11px] px-2"
                  onClick={(e) => { e.stopPropagation(); handleApprove(topic.id); }} disabled={isActionLoading}>
                  {isActionLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                  Approve
                </Button>
              </>
            )}
            {topic.status === "approved" && (
              <Button size="sm" className="h-6 text-[11px] px-2"
                onClick={(e) => { e.stopPropagation(); handleProduce(topic.id); }} disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                Produce
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContentBoardCard({
  item,
  categories,
  topicById,
  fmt,
}: {
  item: ContentItem;
  categories: { id: string; labels: Record<string, string> }[];
  topicById: Map<string, Topic>;
  fmt: (iso: string) => string;
}) {
  const cat = categories.find((c) => c.id === item.category);
  const topic = item.topicId ? topicById.get(item.topicId) : undefined;
  const schedDate = topic?.scheduledDate;

  return (
    <Link
      href={`/content/${item.id}`}
      className="block rounded-lg border bg-card p-3 hover:border-primary/30 transition-colors"
    >
      {/* Type + Status */}
      <div className="flex items-center justify-between mb-1.5">
        <ContentTypeBadge type={item.type} />
        <ContentStatusBadge status={item.status} />
      </div>

      {/* Title */}
      <p className="text-sm font-medium line-clamp-2">{item.title || "Untitled"}</p>

      {/* Description snippet */}
      {item.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
      )}

      {/* Footer: Category + Date */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-muted-foreground">
          {cat?.labels.de ?? item.category ?? ""}
        </span>
        {schedDate ? (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <Calendar className="h-3 w-3" />
            {fmt(schedDate)}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground tabular-nums">{fmt(item.updatedAt)}</span>
        )}
      </div>
    </Link>
  );
}
