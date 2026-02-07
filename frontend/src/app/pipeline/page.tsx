"use client";

import { Badge } from "@/components/ui/badge";
import { PhaseStatusBadge } from "@/components/status-badge";
import { pipelineRuns } from "@/lib/mock-data";
import { phaseAgents, getAgent } from "@/lib/agents";
import { format } from "date-fns";
import { Activity, Clock, CheckCircle2, XCircle } from "lucide-react";

const phaseLabels: Record<string, string> = {
  outline: "Outline",
  writing: "Writing",
  assembly: "Assembly",
  image: "Image",
  quality: "Quality",
  translation: "Translation",
};

export default function PipelinePage() {
  const running = pipelineRuns.filter((r) => r.status === "running");
  const completed = pipelineRuns.filter((r) => r.status === "completed");
  const failed = pipelineRuns.filter((r) => r.status === "failed");

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Pipeline</h1>
        <p className="text-muted-foreground">Track active and recent production runs</p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Badge variant="outline" className="gap-1 px-3 py-1.5">
          <Activity className="h-3 w-3 text-blue-500" />
          {running.length} Running
        </Badge>
        <Badge variant="outline" className="gap-1 px-3 py-1.5">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {completed.length} Completed
        </Badge>
        <Badge variant="outline" className="gap-1 px-3 py-1.5">
          <XCircle className="h-3 w-3 text-red-500" />
          {failed.length} Failed
        </Badge>
      </div>

      {/* Pipeline Runs */}
      <div className="space-y-4">
        {pipelineRuns.map((run) => {
          // Build activity feed
          const activityItems = run.phases
            .filter((p) => p.status === "running" || p.status === "completed")
            .flatMap((p) => {
              const agentIds = phaseAgents[p.name] ?? [];
              return p.agents.flatMap((a) =>
                a.toolCalls.map((tc) => {
                  const agent = agentIds[0] ? getAgent(agentIds[0]) : undefined;
                  return {
                    ...tc,
                    agentName: agent?.name ?? a.name,
                    agentAvatar: agent?.avatar ?? "🤖",
                  };
                })
              );
            })
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, 5);

          return (
            <div key={run.id} className="rounded-lg border overflow-hidden">
              {/* Run Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold">{run.topicTitle}</p>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(run.startedAt), "dd.MM. HH:mm")}
                    {run.completedAt && (
                      <span>
                        &middot; Done {format(new Date(run.completedAt), "HH:mm")}
                      </span>
                    )}
                  </span>
                </div>
                <Badge
                  variant={
                    run.status === "running"
                      ? "default"
                      : run.status === "completed"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {run.status}
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="flex gap-1 px-4 pt-3">
                {run.phases.map((phase) => (
                  <div
                    key={phase.name}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      phase.status === "completed"
                        ? "bg-green-500"
                        : phase.status === "running"
                        ? "bg-blue-500 animate-pulse"
                        : phase.status === "failed"
                        ? "bg-red-500"
                        : "bg-muted"
                    }`}
                    title={`${phaseLabels[phase.name]}: ${phase.status}`}
                  />
                ))}
              </div>

              {/* Phase List */}
              <div className="px-4 py-3 space-y-1.5">
                {run.phases.map((phase) => {
                  const agentIds = phaseAgents[phase.name] ?? [];
                  const phaseAgentData = agentIds
                    .map((id) => getAgent(id))
                    .filter(Boolean);

                  return (
                    <div
                      key={phase.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-medium w-24">
                          {phaseLabels[phase.name]}
                        </span>
                        {/* Agent Avatars + Names as context */}
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-1">
                            {phaseAgentData.map((agent) => (
                              <span
                                key={agent!.id}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[10px] border border-background"
                                title={agent!.name}
                              >
                                {agent!.avatar}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {phaseAgentData.map((a) => a!.name).join(", ")}
                          </span>
                        </div>
                      </div>
                      <PhaseStatusBadge status={phase.status} />
                    </div>
                  );
                })}
              </div>

              {/* Activity Feed (only for running) */}
              {run.status === "running" && activityItems.length > 0 && (
                <div className="border-t px-4 py-2.5 space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Recent activity
                  </p>
                  {activityItems.map((tc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="text-sm shrink-0">{tc.agentAvatar}</span>
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {tc.tool}
                      </span>
                      <span className="truncate">{tc.summary}</span>
                      <span className="ml-auto shrink-0 tabular-nums">
                        {format(new Date(tc.timestamp), "HH:mm:ss")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pipelineRuns.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
          <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No pipeline runs</p>
          <p className="text-xs text-muted-foreground">
            Start a production from the Planner to see runs here
          </p>
        </div>
      )}
    </div>
  );
}
