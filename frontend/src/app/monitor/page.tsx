"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { PhaseStatusBadge } from "@/components/status-badge";
import { phaseAgents, phaseLabels, getAgent } from "@/lib/agents";
import {
  getCustomers,
  getProjects,
  getTopics,
  getPipelineRuns,
} from "@/lib/api";
import type { PipelineRun, Topic } from "@/lib/types";
import { format } from "date-fns";
import {
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Play,
  X,
} from "lucide-react";

export default function MonitorPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const customers = await getCustomers();
      if (customers.length === 0) { setError("No customers found"); return; }
      const cid = customers[0].id;
      setCustomerId(cid);

      const projects = await getProjects(cid);
      if (projects.length === 0) { setError("No projects found"); return; }
      const pid = projects[0].id;
      setProjectId(pid);

      const [r, t] = await Promise.all([
        getPipelineRuns(cid, pid),
        getTopics(cid, pid),
      ]);
      setRuns(r.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setTopics(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll for updates when there are running runs
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === "running" || r.status === "pending");
    if (!hasRunning || !customerId || !projectId) return;

    const interval = setInterval(async () => {
      try {
        const r = await getPipelineRuns(customerId, projectId);
        setRuns(r.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch { /* ignore poll errors */ }
    }, 3000);

    return () => clearInterval(interval);
  }, [runs, customerId, projectId]);

  const getTopicTitle = (topicId?: string) => {
    if (!topicId) return null;
    return topics.find((t) => t.id === topicId)?.title ?? null;
  };

  const running = runs.filter((r) => r.status === "running" || r.status === "pending");
  const completed = runs.filter((r) => r.status === "completed");
  const failed = runs.filter((r) => r.status === "failed");

  if (loading) {
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
      <div>
        <h1 className="text-2xl font-bold">Monitor</h1>
        <p className="text-muted-foreground">Pipeline runs & agent activity</p>
      </div>

      {/* Summary */}
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
        {runs.map((run) => {
          const topicTitle = getTopicTitle(run.topicId);
          const runLabel = run.type === "strategy"
            ? "Strategy Research"
            : topicTitle ?? "Production";

          // Collect all events from agent calls
          const allEvents = run.phases
            .flatMap((p) =>
              p.agentCalls.flatMap((ac) =>
                (ac.events ?? [])
                  .filter((e) => e.type === "tool_call" && e.tool)
                  .map((e) => ({ ...e, agentName: ac.agent }))
              )
            )
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          const isExpanded = expandedRun === run.id;
          const visibleEvents = isExpanded ? allEvents : allEvents.slice(0, 5);

          return (
            <div key={run.id} className="rounded-lg border overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
                <div className="flex items-center gap-3">
                  {run.type === "strategy" ? (
                    <Search className="h-4 w-4 text-purple-500" />
                  ) : (
                    <Play className="h-4 w-4 text-blue-500" />
                  )}
                  <p className="text-sm font-semibold">{runLabel}</p>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(run.createdAt), "dd.MM. HH:mm")}
                    {run.completedAt && (
                      <span>
                        &middot; Done {format(new Date(run.completedAt), "HH:mm")}
                      </span>
                    )}
                  </span>
                  {run.totalCostUsd > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ${run.totalCostUsd.toFixed(2)}
                    </span>
                  )}
                </div>
                <Badge
                  variant={
                    run.status === "running" || run.status === "pending"
                      ? "default"
                      : run.status === "completed"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {run.status}
                </Badge>
              </div>

              {/* Phase progress bar */}
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
                        : phase.status === "skipped"
                        ? "bg-gray-300"
                        : "bg-muted"
                    }`}
                    title={`${phaseLabels[phase.name] ?? phase.name}: ${phase.status}`}
                  />
                ))}
              </div>

              {/* Phase list */}
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
                        <span className="font-medium w-28">
                          {phaseLabels[phase.name] ?? phase.name}
                        </span>
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

              {/* Activity log */}
              {allEvents.length > 0 && (
                <div className="border-t px-4 py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Activity {allEvents.length > 5 && `(${allEvents.length})`}
                    </p>
                    {allEvents.length > 5 && (
                      <button
                        onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <X className="h-3 w-3" />
                            Collapse
                          </>
                        ) : (
                          <>
                            <Search className="h-3 w-3" />
                            Show all
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className={isExpanded ? "max-h-96 overflow-y-auto space-y-1" : "space-y-1"}>
                    {visibleEvents.map((ev, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <span className="shrink-0 tabular-nums">
                          {format(new Date(ev.timestamp), isExpanded ? "dd.MM. HH:mm:ss" : "HH:mm:ss")}
                        </span>
                        {isExpanded && (
                          <span className="text-[10px] shrink-0 opacity-60">
                            {ev.agentName}
                          </span>
                        )}
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">
                          {ev.tool}
                        </span>
                        <span className="truncate">{ev.input ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error display */}
              {run.error && (
                <div className="border-t px-4 py-2.5">
                  <p className="text-xs text-destructive">{run.error}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {runs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
          <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No pipeline runs</p>
          <p className="text-xs text-muted-foreground">
            Start a research or production from the Research page
          </p>
        </div>
      )}
    </div>
  );
}
