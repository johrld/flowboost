"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  getTopics,
  approveTopic,
  rejectTopic,
  startStrategy,
  startProduction,
} from "@/lib/api";
import type { Topic } from "@/lib/types";
import { format } from "date-fns";
import {
  Search,
  Play,
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Check,
} from "lucide-react";

function IntentBadge({ intent }: { intent: string }) {
  const config: Record<string, { label: string; className: string }> = {
    informational: { label: "Informational", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" },
    "how-to": { label: "How-To", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200" },
    transactional: { label: "Transactional", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" },
    navigational: { label: "Navigational", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  };
  const c = config[intent] ?? config.informational;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

export default function ResearchPage() {
  const router = useRouter();
  const { customerId, projectId, categories, loading: projectLoading } = useProject();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);

  useEffect(() => {
    if (!customerId || !projectId) return;
    setLoading(true);
    setError(null);
    getTopics(customerId, projectId)
      .then(setTopics)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load data"))
      .finally(() => setLoading(false));
  }, [customerId, projectId]);

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

  const handleProduce = async (topicId: string) => {
    setActionLoading(topicId);
    try {
      const { runId } = await startProduction(customerId, projectId, topicId);
      setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, status: "in_production" as const } : t));
      console.log("Production started, runId:", runId);
    } catch (err) {
      console.error("Failed to start production:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleNewResearch = async () => {
    setResearchLoading(true);
    try {
      await startStrategy(customerId, projectId);
      router.push("/monitor");
    } catch (err) {
      console.error("Failed to start research:", err);
      setResearchLoading(false);
    }
  };

  // Filter and sort
  const visibleTopics = topics
    .filter((t) => t.status !== "rejected")
    .filter((t) => filterCategory === "all" || t.category === filterCategory)
    .sort((a, b) => a.priority - b.priority);

  const proposedCount = topics.filter((t) => t.status === "proposed").length;

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

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Research</h1>
          <p className="text-muted-foreground">
            {proposedCount > 0 && (
              <span className="text-primary font-medium">{proposedCount} new topics</span>
            )}
            {proposedCount > 0 && " · "}
            Topic discovery & approval
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleNewResearch} disabled={researchLoading}>
            {researchLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            New Research
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-end">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
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
      </div>

      {/* Topic List */}
      <div className="space-y-3">
        {visibleTopics.map((topic) => {
          const isExpanded = expandedTopics.has(topic.id);
          const allKeywords = [
            topic.keywords.primary,
            ...topic.keywords.secondary,
            ...topic.keywords.longTail,
          ];
          const isActionLoading = actionLoading === topic.id;

          return (
            <div
              key={topic.id}
              className="rounded-lg border overflow-hidden hover:border-primary/30 transition-colors"
            >
              {/* Main Row */}
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{topic.title}</p>
                    {topic.createdAt && (Date.now() - new Date(topic.createdAt).getTime()) < 86400000 && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 text-[10px] font-medium">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {categories.find((c) => c.id === topic.category)?.labels.de ?? topic.category}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <IntentBadge intent={topic.searchIntent} />
                    <span className="text-xs text-muted-foreground">
                      ~{topic.estimatedSections} sections
                    </span>
                    {topic.createdAt && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(topic.createdAt), "dd.MM.yyyy")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <TopicStatusBadge status={topic.status} />
                  <button
                    onClick={() => toggleExpanded(topic.id)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded: Reasoning + Competitor Insights + Keywords + Actions */}
              {isExpanded && (
                <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
                  {/* Agent Reasoning */}
                  {topic.reasoning && (
                    <div className="rounded-md bg-background border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Agent Reasoning
                      </p>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {topic.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Suggested Angle */}
                  {topic.suggestedAngle && (
                    <div className="rounded-md bg-background border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Angle</p>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {topic.suggestedAngle}
                      </p>
                    </div>
                  )}

                  {/* Competitor Insights */}
                  {topic.competitorInsights && (
                    <div className="rounded-md bg-background border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Competitor Insights
                      </p>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {topic.competitorInsights}
                      </p>
                    </div>
                  )}

                  {/* Keywords */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium">
                        {topic.keywords.primary}
                      </span>
                      {topic.keywords.secondary.map((kw) => (
                        <span key={kw} className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {kw}
                        </span>
                      ))}
                      {topic.keywords.longTail.map((kw) => (
                        <span key={kw} className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground/70">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {topic.status === "proposed" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-muted-foreground hover:text-red-600"
                          onClick={() => handleReject(topic.id)}
                          disabled={isActionLoading}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="h-7"
                          onClick={() => handleApprove(topic.id)}
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
                        onClick={() => handleProduce(topic.id)}
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
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {visibleTopics.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No topics found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Run a new research to discover topics
            </p>
            <Button className="mt-4" onClick={handleNewResearch} disabled={researchLoading}>
              {researchLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Start Research
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
