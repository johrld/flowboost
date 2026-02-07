import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { articles, topics, pipelineRuns } from "@/lib/mock-data";
import { StageBadge, ConditionBadge } from "@/components/status-badge";
import { FileText, Clock, Zap, Lightbulb } from "lucide-react";

export default function DashboardPage() {
  const published = articles.filter((a) => a.stage === "live");
  const scheduled = articles.filter((a) => a.stage === "ready");
  const producing = articles.filter((a) => a.stage === "producing");
  const openTopics = topics.filter((t) => t.status === "researched");
  const activeRuns = pipelineRuns.filter((r) => r.status === "running");

  const stats = [
    { label: "Published", value: published.length, icon: FileText, color: "text-green-600" },
    { label: "Scheduled", value: scheduled.length, icon: Clock, color: "text-blue-600" },
    { label: "Producing", value: producing.length, icon: Zap, color: "text-orange-600" },
    { label: "Open Topics", value: openTopics.length, icon: Lightbulb, color: "text-purple-600" },
  ];

  const upcoming = articles
    .filter((a) => a.scheduledDate && a.stage !== "live")
    .sort((a, b) => (a.scheduledDate! > b.scheduledDate! ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your content pipeline</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Publications */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <CardDescription>Next scheduled articles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcoming.map((article) => (
                <div
                  key={article.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{article.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {article.scheduledDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StageBadge stage={article.stage} />
                    <ConditionBadge condition={article.condition} />
                  </div>
                </div>
              ))}
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground">No upcoming articles</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Pipelines */}
        <Card>
          <CardHeader>
            <CardTitle>Active Pipelines</CardTitle>
            <CardDescription>Currently running productions</CardDescription>
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
                      <p className="text-sm font-medium">{run.topicTitle}</p>
                      <Badge variant="outline">
                        {completedPhases}/{run.phases.length}
                      </Badge>
                    </div>
                    {/* Progress bar */}
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
                <p className="text-sm text-muted-foreground">
                  No active pipelines
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
