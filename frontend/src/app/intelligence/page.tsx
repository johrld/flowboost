"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  RefreshCw,
  Loader2,
  TrendingUp,
  Users,
  AlertTriangle,
  BarChart3,
  ExternalLink,
  Clock,
  ArrowLeft,
  FileText,
  Globe,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { getProjectMemory, getCompetitors, getCompetitorDetail, triggerMonitor } from "@/lib/api";

type CompetitorEntry = { slug: string; name: string; domain: string; totalArticles: number; lastScanAt: string; newSinceLastScan: number; topClusters: string[]; recentHighlight: string };
type GapCluster = { cluster: string; ourCount: number; ourDepth: string; competitors: Record<string, { count: number; depth: string }>; gapType: string; priority: string; recommendation: string };
type CompetitorDetailData = { profile: Record<string, unknown>; topicCoverage: { clusters: Array<{ cluster: string; articleCount: number; depth: string; trend: string }> }; recentActivity: { newArticles: Array<{ url: string; title: string; topicCluster: string | null }> }; blogStats: { totalArticles: number; lastCrawlAt: string } | null };

export default function IntelligencePage() {
  const { customerId, projectId, loading: projectLoading } = useProject();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);

  // Data
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [gapClusters, setGapClusters] = useState<GapCluster[]>([]);
  const [gapSummary, setGapSummary] = useState<Record<string, number>>({});
  const [memoryMeta, setMemoryMeta] = useState<{ lastUpdated: Record<string, string> }>({ lastUpdated: {} });
  const [hasData, setHasData] = useState(false);

  // Detail view
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompetitorDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const [memResult, compResult] = await Promise.all([
        getProjectMemory(customerId, projectId),
        getCompetitors(customerId, projectId).catch(() => ({ index: null, gapMatrix: null })),
      ]);
      setMemoryMeta(memResult.meta);
      setHasData(memResult.files.length > 0);

      const idx = compResult.index as { competitors: CompetitorEntry[] } | null;
      if (idx?.competitors) setCompetitors(idx.competitors);

      const gap = compResult.gapMatrix as { clusters: GapCluster[]; summary: Record<string, number> } | null;
      if (gap?.clusters) setGapClusters(gap.clusters);
      if (gap?.summary) setGapSummary(gap.summary);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [customerId, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = async (slug: string) => {
    if (!customerId || !projectId) return;
    setSelectedSlug(slug);
    setDetailLoading(true);
    try {
      const d = await getCompetitorDetail(customerId, projectId, slug) as CompetitorDetailData;
      setDetail(d);
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const handleScan = async (type: "competitor-scan" | "trend-scan" | "content-watch") => {
    if (!customerId || !projectId || scanning) return;
    setScanning(type);
    try {
      await triggerMonitor(customerId, projectId, type);
    } catch { /* ignore */ }
    const poll = setInterval(async () => {
      try {
        const result = await getProjectMemory(customerId, projectId);
        if (JSON.stringify(result.meta.lastUpdated) !== JSON.stringify(memoryMeta.lastUpdated)) {
          clearInterval(poll);
          setScanning(null);
          loadData();
        }
      } catch { /* ignore */ }
    }, 5000);
    setTimeout(() => { clearInterval(poll); setScanning(null); }, 180000);
  };

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

  // ── Detail View ─────────────────────────────────────
  if (selectedSlug && detail) {
    const comp = competitors.find((c) => c.slug === selectedSlug);
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <button type="button" onClick={() => { setSelectedSlug(null); setDetail(null); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to Intelligence
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{String((detail.profile as Record<string, unknown>)?.name ?? comp?.name ?? selectedSlug)}</h1>
            <a href={String((detail.profile as Record<string, unknown>)?.domain ?? comp?.domain ?? "")} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
              <Globe className="h-3 w-3" />{String((detail.profile as Record<string, unknown>)?.domain ?? "")}
            </a>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {detail.blogStats ? <p>{detail.blogStats.totalArticles} articles indexed</p> : null}
            {detail.blogStats?.lastCrawlAt ? <p>Last scan: {timeAgo(detail.blogStats.lastCrawlAt)}</p> : null}
          </div>
        </div>

        {/* Topic Coverage */}
        {detail.topicCoverage?.clusters?.length > 0 && (
          <div className="rounded-xl border bg-background shadow-sm">
            <div className="px-5 py-4 border-b"><h3 className="text-sm font-semibold">Topic Coverage</h3></div>
            <div className="divide-y">
              {detail.topicCoverage.clusters.map((c) => (
                <div key={c.cluster} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium capitalize">{c.cluster.replace(/-/g, " ")}</span>
                    <Badge variant={c.depth === "deep" ? "default" : "secondary"} className="text-[10px]">{c.depth}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{c.articleCount} articles</span>
                    <Badge variant="outline" className="text-[10px]">{c.trend}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {detail.recentActivity?.newArticles?.length > 0 && (
          <div className="rounded-xl border bg-background shadow-sm">
            <div className="px-5 py-4 border-b"><h3 className="text-sm font-semibold">Recent Articles</h3></div>
            <div className="divide-y">
              {detail.recentActivity.newArticles.filter((a) => a.title).map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate block">{a.title}</a>
                    {a.topicCluster ? <span className="text-xs text-muted-foreground capitalize">{a.topicCluster.replace(/-/g, " ")}</span> : null}
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main View ───────────────────────────────────────
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" />Intelligence</h1>
          <p className="text-sm text-muted-foreground">What the CMO knows about your content landscape.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh</Button>
      </div>

      {/* Scan Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleScan("competitor-scan")} disabled={!!scanning}>
          {scanning === "competitor-scan" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Users className="mr-1.5 h-3.5 w-3.5" />}
          Scan Competitors
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleScan("trend-scan")} disabled={!!scanning}>
          {scanning === "trend-scan" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="mr-1.5 h-3.5 w-3.5" />}
          Scan Trends
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleScan("content-watch")} disabled={!!scanning}>
          {scanning === "content-watch" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="mr-1.5 h-3.5 w-3.5" />}
          Analyze Content
        </Button>
      </div>

      {!hasData ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center space-y-4">
          <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium">No intelligence data yet</p>
          <p className="text-xs text-muted-foreground">Run a competitor scan to start building knowledge.</p>
        </div>
      ) : (
        <>
          {/* Competitors */}
          {competitors.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />Competitors</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {competitors.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => loadDetail(c.slug)}
                    className="rounded-xl border bg-background shadow-sm p-5 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">{c.name}</h3>
                      {c.newSinceLastScan > 0 ? <Badge variant="default" className="text-[10px]">+{c.newSinceLastScan} new</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{c.totalArticles} articles indexed</p>
                    {c.topClusters.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {c.topClusters.map((cl) => (
                          <Badge key={cl} variant="outline" className="text-[10px] capitalize">{cl.replace(/-/g, " ")}</Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />{c.lastScanAt ? timeAgo(c.lastScanAt) : "Never scanned"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Gap Matrix */}
          {gapClusters.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" />Content Gaps</h2>
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
                        {Object.entries(g.competitors).filter(([, v]) => v.count > 0).map(([k, v]) => `${k.split("-")[0]}: ${v.count}`).join(" | ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {detailLoading && (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      )}
    </div>
  );
}
