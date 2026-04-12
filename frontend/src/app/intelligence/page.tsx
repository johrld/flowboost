"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Clock,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { useProject } from "@/lib/project-context";
import { getProjectMemory, getCompetitors } from "@/lib/api";

type GapCluster = { cluster: string; ourCount: number; ourDepth: string; competitors: Record<string, { count: number; depth: string }>; gapType: string; priority: string; recommendation: string };

export default function IntelligenceOverviewPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();
  const [loading, setLoading] = useState(true);
  const [gapClusters, setGapClusters] = useState<GapCluster[]>([]);
  const [gapSummary, setGapSummary] = useState<Record<string, number>>({});
  const [meta, setMeta] = useState<{ lastUpdated: Record<string, string> }>({ lastUpdated: {} });
  const [memoryFiles, setMemoryFiles] = useState<string[]>([]);
  const [competitorCount, setCompetitorCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const [memResult, compResult] = await Promise.all([
        getProjectMemory(customerId, projectId),
        getCompetitors(customerId, projectId).catch(() => ({ index: null, gapMatrix: null })),
      ]);
      setMeta(memResult.meta);
      setMemoryFiles(memResult.files);

      const idx = compResult.index as { competitors: Array<unknown> } | null;
      setCompetitorCount(idx?.competitors?.length ?? 0);

      const gap = compResult.gapMatrix as { clusters: GapCluster[]; summary: Record<string, number> } | null;
      if (gap?.clusters) setGapClusters(gap.clusters);
      if (gap?.summary) setGapSummary(gap.summary);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [customerId, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const timeAgo = (iso: string): string => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (projectLoading || loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const hasData = memoryFiles.length > 0;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" />Intelligence Overview</h1>
          <p className="text-sm text-muted-foreground">Your content strategy at a glance.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh</Button>
      </div>

      {!hasData ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center space-y-4">
          <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium">No intelligence data yet</p>
          <p className="text-xs text-muted-foreground">Start by adding competitors and running a scan.</p>
          <Link href="/intelligence/competitors">
            <Button variant="outline" size="sm"><Users className="mr-1.5 h-3.5 w-3.5" />Go to Competitors</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/intelligence/competitors" className="rounded-xl border bg-background shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Competitors</span>
              </div>
              <p className="text-2xl font-bold">{competitorCount}</p>
              <p className="text-xs text-muted-foreground">tracked</p>
            </Link>
            <div className="rounded-xl border bg-background shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Content Gaps</span>
              </div>
              <p className="text-2xl font-bold">{gapSummary.weLag ?? 0}</p>
              <p className="text-xs text-muted-foreground">topics to address</p>
            </div>
            <Link href="/intelligence/trends" className="rounded-xl border bg-background shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Trends</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {meta.lastUpdated["areas/trend-watch.json"] ? `Last scan: ${timeAgo(meta.lastUpdated["areas/trend-watch.json"])}` : "Not yet scanned"}
              </p>
            </Link>
          </div>

          {/* Gap Matrix */}
          {gapClusters.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" />Content Gap Matrix</h2>
                <div className="flex gap-2 text-xs">
                  {gapSummary.weLag > 0 && <Badge variant="destructive" className="text-[10px]">{gapSummary.weLag} gaps</Badge>}
                  {gapSummary.weLead > 0 && <Badge variant="default" className="text-[10px]">{gapSummary.weLead} leading</Badge>}
                </div>
              </div>
              <div className="rounded-xl border bg-background shadow-sm divide-y">
                {gapClusters.map((g) => (
                  <div key={g.cluster} className="flex items-center gap-4 px-5 py-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      g.priority === "high" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                      g.priority === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
                      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>{g.priority.toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{g.cluster.replace(/-/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{g.recommendation}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <span className="font-medium">Us: {g.ourCount}</span>
                      <span className="text-muted-foreground">
                        {Object.entries(g.competitors).filter(([, v]) => v.count > 0).map(([k, v]) => `${k}: ${v.count}`).join(" | ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Memory Status */}
          {memoryFiles.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3">Memory Status</h2>
              <div className="rounded-xl border bg-background shadow-sm divide-y">
                {memoryFiles.map((file) => (
                  <div key={file} className="flex items-center justify-between px-5 py-2.5 text-xs">
                    <span className="font-mono text-muted-foreground">{file}</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {meta.lastUpdated[file] ? timeAgo(meta.lastUpdated[file]) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
