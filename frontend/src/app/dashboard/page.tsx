import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { articles, pipelineRuns, topics, dashboardActions } from "@/lib/mock-data";
import { StageBadge } from "@/components/status-badge";
import {
  Lightbulb,
  Eye,
  CheckCircle2,
  ArrowRight,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const actionConfig: Record<string, { dot: string }> = {
  opportunity: { dot: "bg-purple-500" },
  review: { dot: "bg-amber-500" },
  completed: { dot: "bg-green-500" },
};

export default function DashboardPage() {
  const activeRuns = pipelineRuns.filter((r) => r.status === "running");
  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";

  const upcoming = articles
    .filter((a) => a.scheduledDate && a.stage !== "live")
    .sort((a, b) => (a.scheduledDate! > b.scheduledDate! ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="p-8 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">{greeting}, Johannes</h1>
        <p className="text-muted-foreground">
          Breathe · {format(today, "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {/* Your Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Your Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dashboardActions.map((action, i) => {
            const cfg = actionConfig[action.type] ?? actionConfig.opportunity;
            return (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
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
            );
          })}
        </CardContent>
      </Card>

      {/* Two Column: This Week + Active Pipelines */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* This Week */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((article) => {
                const date = article.scheduledDate
                  ? new Date(article.scheduledDate)
                  : null;
                return (
                  <Link
                    key={article.id}
                    href={`/create/${article.id}`}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {date && (
                        <div className="text-center shrink-0 w-10">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase">
                            {format(date, "EEE", { locale: de })}
                          </p>
                          <p className="text-lg font-bold leading-tight">
                            {format(date, "dd")}
                          </p>
                        </div>
                      )}
                      <p className="text-sm font-medium truncate">{article.title}</p>
                    </div>
                    <StageBadge stage={article.stage} />
                  </Link>
                );
              })}
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No articles scheduled this week
                </p>
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
                  (p) => p.status === "completed"
                ).length;
                const currentPhase = run.phases.find(
                  (p) => p.status === "running"
                );
                return (
                  <div
                    key={run.id}
                    className="rounded-md border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{topics.find((t) => t.id === run.topicId)?.title ?? "Production"}</p>
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
