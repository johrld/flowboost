"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TopicStatusBadge } from "@/components/status-badge";
import { topics, categories, contentGaps } from "@/lib/mock-data";
import {
  Search,
  Play,
  GripVertical,
  Sparkles,
  X,
  TrendingUp,
  Globe,
  ArrowRight,
  BarChart3,
  Shield,
  Signal,
} from "lucide-react";

type Tab = "topics" | "gaps";

function DifficultyBar({ value }: { value: number }) {
  const color =
    value <= 30
      ? "bg-green-500"
      : value <= 50
      ? "bg-yellow-500"
      : value <= 70
      ? "bg-orange-500"
      : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const config = {
    high: { icon: Signal, className: "text-green-600", bars: 3 },
    medium: { icon: Signal, className: "text-yellow-600", bars: 2 },
    low: { icon: Signal, className: "text-red-600", bars: 1 },
  };
  const c = config[level];
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${c.className}`} title={`${level} confidence`}>
      <c.icon className="h-3 w-3" />
    </span>
  );
}

export default function ResearchPage() {
  const [tab, setTab] = useState<Tab>("topics");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // ── Topics Tab ──────────────────────────────────────────────────

  const researchTopics = topics.filter(
    (t) => t.status === "researched" || t.status === "approved"
  );

  const filteredTopics = researchTopics.filter((t) => {
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedTopics = [...filteredTopics].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // ── Gaps Tab ────────────────────────────────────────────────────

  const filteredGaps = contentGaps.filter((g) => {
    if (filterCategory !== "all" && g.category !== filterCategory) return false;
    return true;
  });

  const opportunityOrder = { high: 0, medium: 1, low: 2 };
  const sortedGaps = [...filteredGaps].sort(
    (a, b) => opportunityOrder[a.opportunity] - opportunityOrder[b.opportunity]
  );

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Research</h1>
          <p className="text-muted-foreground">
            Topic discovery, approval & content gap analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Search className="mr-2 h-4 w-4" />
            New Research
          </Button>
          <Button>
            <Play className="mr-2 h-4 w-4" />
            Produce Selected
          </Button>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setTab("topics")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === "topics"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Topics
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
              {researchTopics.length}
            </Badge>
          </button>
          <button
            onClick={() => setTab("gaps")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === "gaps"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Content Gaps
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
              {contentGaps.length}
            </Badge>
          </button>
        </div>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.labels.de}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Topics Tab ────────────────────────────────────────── */}
      {tab === "topics" && (
        <>
          {/* Column Headers */}
          <div className="rounded-lg border overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
              <div className="w-6" />
              <div className="flex-1">Topic</div>
              <div className="w-16 hidden md:block text-right">Volume</div>
              <div className="w-20 hidden md:block">Difficulty</div>
              <div className="w-8 hidden lg:block" title="Confidence" />
              <div className="w-[200px] hidden lg:block">Keywords</div>
              <div className="w-16">Priority</div>
              <div className="w-24">Status</div>
              <div className="w-32 text-right">Actions</div>
            </div>

            {sortedTopics.map((topic, idx) => (
              <div
                key={topic.id}
                className={`group flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors ${
                  idx < sortedTopics.length - 1 ? "border-b" : ""
                }`}
              >
                {/* Drag Handle */}
                <div className="w-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Title + Category + Reasoning */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{topic.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {categories.find((c) => c.id === topic.category)?.labels.de ??
                        topic.category}
                    </span>
                    {topic.reasoning && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {topic.reasoning}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Search Volume */}
                <div className="w-16 hidden md:block text-right shrink-0">
                  {topic.searchVolume && (
                    <span className="text-xs tabular-nums font-medium">
                      {topic.searchVolume.toLocaleString("de-DE")}
                    </span>
                  )}
                </div>

                {/* Difficulty */}
                <div className="w-20 hidden md:block shrink-0">
                  {topic.difficulty != null && (
                    <DifficultyBar value={topic.difficulty} />
                  )}
                </div>

                {/* Confidence */}
                <div className="w-8 hidden lg:block shrink-0">
                  {topic.confidence && (
                    <ConfidenceBadge level={topic.confidence} />
                  )}
                </div>

                {/* Keywords */}
                <div className="w-[200px] hidden lg:flex flex-wrap gap-1 shrink-0">
                  {topic.keywords.slice(0, 3).map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {kw}
                    </span>
                  ))}
                </div>

                {/* Priority */}
                <div className="w-16 shrink-0">
                  <Badge
                    variant={
                      topic.priority === "high"
                        ? "destructive"
                        : topic.priority === "medium"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {topic.priority}
                  </Badge>
                </div>

                {/* Status */}
                <div className="shrink-0 w-24">
                  <TopicStatusBadge status={topic.status} />
                </div>

                {/* Actions */}
                <div className="shrink-0 w-32 flex items-center justify-end gap-1">
                  {topic.status === "researched" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" title="Reject">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7">
                        Approve
                      </Button>
                    </>
                  )}
                  {topic.status === "approved" && (
                    <Button size="sm" variant="outline" className="h-7">
                      <Sparkles className="mr-1 h-3 w-3" />
                      Produce
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {sortedTopics.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No topics found</p>
              <p className="text-xs text-muted-foreground">
                Start a new research to discover topics
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Content Gaps Tab ──────────────────────────────────── */}
      {tab === "gaps" && (
        <>
          <div className="rounded-lg border overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
              <div className="flex-1">Topic Gap</div>
              <div className="w-32 hidden lg:block">Competitors</div>
              <div className="w-16 text-right">Volume</div>
              <div className="w-20">Difficulty</div>
              <div className="w-16">Type</div>
              <div className="w-20">Opportunity</div>
              <div className="w-28 text-right" />
            </div>

            {sortedGaps.map((gap, idx) => (
              <div
                key={gap.id}
                className={`group flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors ${
                  idx < sortedGaps.length - 1 ? "border-b" : ""
                }`}
              >
                {/* Topic + Category */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{gap.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {categories.find((c) => c.id === gap.category)?.labels.de ??
                      gap.category}
                  </p>
                </div>

                {/* Competitors */}
                <div className="w-32 hidden lg:flex flex-wrap gap-1 shrink-0">
                  {gap.competitors.slice(0, 2).map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      <Globe className="h-2.5 w-2.5" />
                      {c}
                    </span>
                  ))}
                  {gap.competitors.length > 2 && (
                    <span className="text-[11px] text-muted-foreground">
                      +{gap.competitors.length - 2}
                    </span>
                  )}
                </div>

                {/* Volume */}
                <div className="w-16 text-right shrink-0">
                  <span className="text-xs tabular-nums font-medium">
                    {gap.searchVolume.toLocaleString("de-DE")}
                  </span>
                </div>

                {/* Difficulty */}
                <div className="w-20 shrink-0">
                  <DifficultyBar value={gap.difficulty} />
                </div>

                {/* Type */}
                <div className="w-16 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {gap.suggestedType}
                  </Badge>
                </div>

                {/* Opportunity */}
                <div className="w-20 shrink-0">
                  <Badge
                    variant={
                      gap.opportunity === "high"
                        ? "destructive"
                        : gap.opportunity === "medium"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {gap.opportunity}
                  </Badge>
                </div>

                {/* Action */}
                <div className="w-28 text-right shrink-0">
                  <Button size="sm" variant="outline" className="h-7">
                    <ArrowRight className="mr-1 h-3 w-3" />
                    Create Brief
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {sortedGaps.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
              <TrendingUp className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No content gaps found</p>
              <p className="text-xs text-muted-foreground">
                Add competitor domains in Settings to discover gaps
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
