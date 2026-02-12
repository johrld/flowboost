"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentStatusBadge } from "@/components/status-badge";
import { useProject } from "@/lib/project-context";
import { getContent, getPipelineRuns, getTopics } from "@/lib/api";
import type { ContentItem, PipelineRun, Topic } from "@/lib/types";
import {
  ArrowRight,
  Activity,
  Loader2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DashboardAction {
  type: "review" | "producing" | "info";
  message: string;
  count?: number;
  link: string;
  dot: string;
}

function buildActions(items: ContentItem[], runs: PipelineRun[], topics: Topic[]): DashboardAction[] {
  const actions: DashboardAction[] = [];

  const reviewCount = items.filter((i) => i.status === "review").length;
  if (reviewCount > 0) {
    actions.push({
      type: "review",
      message: `${reviewCount} content item${reviewCount > 1 ? "s" : ""} pending review`,
      count: reviewCount,
      link: "/create",
      dot: "bg-amber-500",
    });
  }

  const activeRuns = runs.filter((r) => r.status === "running" || r.status === "pending").length;
  if (activeRuns > 0) {
    actions.push({
      type: "producing",
      message: `${activeRuns} pipeline${activeRuns > 1 ? "s" : ""} running`,
      count: activeRuns,
      link: "/monitor",
      dot: "bg-blue-500",
    });
  }

  const approvedTopics = topics.filter((t) => t.status === "approved").length;
  if (approvedTopics > 0) {
    actions.push({
      type: "info",
      message: `${approvedTopics} approved topic${approvedTopics > 1 ? "s" : ""} ready for production`,
      count: approvedTopics,
      link: "/plan",
      dot: "bg-purple-500",
    });
  }

  const deliveredCount = items.filter((i) => i.status === "delivered").length;
  if (deliveredCount > 0) {
    actions.push({
      type: "info",
      message: `${deliveredCount} content item${deliveredCount > 1 ? "s" : ""} ready to publish`,
      count: deliveredCount,
      link: "/create",
      dot: "bg-green-500",
    });
  }

  return actions;
}

export default function DashboardPage() {
  const { customerId, projectId, project, loading: projectLoading } = useProject();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId || !projectId) return;
    setLoading(true);
    Promise.all([
      getContent(customerId, projectId).then((r) => setItems(r.items)),
      getPipelineRuns(customerId, projectId).then(setRuns),
      getTopics(customerId, projectId).then(setTopics),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId, projectId]);

  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const actions = buildActions(items, runs, topics);
  const activeRuns = runs.filter((r) => r.status === "running" || r.status === "pending");
  const recentItems = [...items]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <div className="p-8 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">{greeting}</h1>
        <p className="text-muted-foreground">
          {project?.name ?? "FlowBoost"} · {format(today, "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-xs text-muted-foreground">Total Content</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{items.filter((i) => i.status === "published").length}</p>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{items.filter((i) => i.status === "draft" || i.status === "review").length}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{topics.filter((t) => t.status === "approved").length}</p>
            <p className="text-xs text-muted-foreground">Topics Ready</p>
          </CardContent>
        </Card>
      </div>

      {/* Your Actions */}
      {actions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Your Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actions.map((action, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${action.dot}`} />
                  <span className="text-sm">{action.message}</span>
                  {action.count && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {action.count}
                    </Badge>
                  )}
                </div>
                <Link href={action.link}>
                  <Button variant="ghost" size="sm" className="gap-1">
                    View
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Two Column: Recent Content + Active Pipelines */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Content */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Content</CardTitle>
              <Link href="/create">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/create/${item.id}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.title || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.category ?? item.type} · {format(new Date(item.updatedAt), "dd.MM.")}
                      </p>
                    </div>
                  </div>
                  <ContentStatusBadge status={item.status} />
                </Link>
              ))}
              {recentItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <FileText className="h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No content yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Pipelines */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Pipelines</CardTitle>
              <Link href="/monitor">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeRuns.map((run) => {
                const completedPhases = run.phases.filter(
                  (p) => p.status === "completed",
                ).length;
                const currentPhase = run.phases.find(
                  (p) => p.status === "running",
                );
                const topicTitle = topics.find((t) => t.id === run.topicId)?.title;
                return (
                  <div
                    key={run.id}
                    className="rounded-md border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {run.type === "strategy" ? "Strategy Research" : topicTitle ?? "Production"}
                      </p>
                      <Badge variant="outline">
                        {completedPhases}/{run.phases.length}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {run.phases.map((phase) => (
                        <div
                          key={phase.name}
                          className={`h-1.5 flex-1 rounded-full ${
                            phase.status === "completed"
                              ? "bg-green-500"
                              : phase.status === "running"
                              ? "bg-blue-500 animate-pulse"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    {currentPhase && (
                      <p className="text-xs text-muted-foreground">
                        Phase: {currentPhase.name}
                      </p>
                    )}
                  </div>
                );
              })}
              {activeRuns.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Activity className="h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No active pipelines
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
