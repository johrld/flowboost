"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { getProjectMemory, triggerMonitor } from "@/lib/api";

export default function IntelligencePage() {
  const { customerId, projectId, loading: projectLoading } = useProject();

  const [meta, setMeta] = useState<{ lastUpdated: Record<string, string>; lastRunBy: Record<string, string> }>({ lastUpdated: {}, lastRunBy: {} });
  const [memoryFiles, setMemoryFiles] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const result = await getProjectMemory(customerId, projectId);
      setMeta(result.meta);
      setMemoryFiles(result.files);
      setData((result as unknown as { data: Record<string, unknown> }).data ?? {});
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [customerId, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleScan = async (type: "competitor-scan" | "trend-scan" | "content-watch") => {
    if (!customerId || !projectId || scanning) return;
    setScanning(type);
    try {
      await triggerMonitor(customerId, projectId, type);
    } catch (err) {
      console.error("Scan failed:", err);
    }
    // Poll for completion
    const poll = setInterval(async () => {
      const result = await getProjectMemory(customerId, projectId);
      const newFiles = result.files;
      if (newFiles.length > memoryFiles.length || JSON.stringify(result.meta.lastUpdated) !== JSON.stringify(meta.lastUpdated)) {
        setMeta(result.meta);
        setMemoryFiles(newFiles);
        setData((result as unknown as { data: Record<string, unknown> }).data ?? {});
        setScanning(null);
        clearInterval(poll);
      }
    }, 5000);
    // Stop polling after 3 minutes
    setTimeout(() => { clearInterval(poll); setScanning(null); }, 180000);
  };

  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const competitors = data["areas.competitor-landscape"] as Record<string, unknown> | undefined;
  const trends = data["areas.trend-watch"] as Record<string, unknown> | undefined;
  const gaps = data["areas.content-gaps"] as Record<string, unknown> | undefined;

  const hasAnyData = memoryFiles.length > 0;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">What the CMO knows about your content landscape.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh
        </Button>
      </div>

      {!hasAnyData ? (
        /* Empty State */
        <div className="rounded-xl border-2 border-dashed p-12 text-center space-y-4">
          <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <div>
            <p className="text-sm font-medium mb-1">No intelligence data yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Run the background monitors to build up knowledge about your competitors, trending topics, and content gaps.
            </p>
          </div>
          <div className="flex justify-center gap-3">
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
        </div>
      ) : (
        <div className="space-y-6">
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

          {/* Competitor Landscape */}
          {competitors && (
            <div className="rounded-xl border bg-background shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />Competitor Landscape
                </h3>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {meta.lastUpdated["areas/competitor-landscape.json"] ? timeAgo(meta.lastUpdated["areas/competitor-landscape.json"]) : "—"}
                </span>
              </div>
              <div className="p-5 space-y-4">
                {/* Highlights */}
                {Array.isArray((competitors as Record<string, unknown>).highlights) ? (
                  <div className="space-y-2">
                    {((competitors as Record<string, unknown>).highlights as string[]).map((h, i) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground shrink-0">•</span>
                        <span>{String(h)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Detailed Findings */}
                {(competitors as Record<string, unknown>).detailed_findings ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    {Object.entries((competitors as Record<string, unknown>).detailed_findings as Record<string, unknown>).map(([key, val]) => {
                      const comp = val as Record<string, unknown>;
                      const newItems = (comp.new_items ?? comp.recent_content ?? []) as Array<Record<string, unknown>>;
                      return (
                        <div key={key} className="rounded-lg border p-4 space-y-2">
                          <h4 className="text-sm font-medium capitalize">{key}</h4>
                          <p className="text-xs text-muted-foreground">{String(comp.status ?? "")}</p>
                          {newItems.length > 0 && (
                            <div className="space-y-1">
                              {newItems.slice(0, 3).map((item, i) => (
                                <div key={i} className="text-xs">
                                  <span className="font-medium">{String(item.name ?? item.title ?? "")}</span>
                                  {item.url ? (
                                    <a href={String(item.url)} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary inline-flex items-center gap-0.5 hover:underline">
                                      <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Trends */}
          {trends && (
            <div className="rounded-xl border bg-background shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />Trending Topics
                </h3>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {meta.lastUpdated["areas/trend-watch.json"] ? timeAgo(meta.lastUpdated["areas/trend-watch.json"]) : "—"}
                </span>
              </div>
              <div className="p-5">
                {Array.isArray((trends as Record<string, unknown>).trends) ? (
                  <div className="space-y-2">
                    {((trends as Record<string, unknown>).trends as Array<Record<string, unknown>>).map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{String(t.topic)}</p>
                          {t.suggestedAngle ? <p className="text-xs text-muted-foreground">{String(t.suggestedAngle)}</p> : null}
                        </div>
                        {t.relevanceScore !== undefined && (
                          <span className="text-xs font-mono text-muted-foreground">{String(t.relevanceScore)}/100</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(trends, null, 2).slice(0, 2000)}</pre>
                )}
              </div>
            </div>
          )}

          {/* Content Gaps */}
          {gaps && (
            <div className="rounded-xl border bg-background shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />Content Gaps
                </h3>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {meta.lastUpdated["areas/content-gaps.json"] ? timeAgo(meta.lastUpdated["areas/content-gaps.json"]) : "—"}
                </span>
              </div>
              <div className="p-5">
                {Array.isArray((gaps as Record<string, unknown>).gaps) ? (
                  <div className="space-y-2">
                    {((gaps as Record<string, unknown>).gaps as Array<Record<string, unknown>>).map((g, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                          g.priority === "high" ? "bg-red-100 text-red-700" :
                          g.priority === "medium" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{String(g.priority ?? "").toUpperCase()}</span>
                        <div>
                          <p className="text-sm font-medium">{String(g.title)}</p>
                          <p className="text-xs text-muted-foreground">{String(g.description)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(gaps, null, 2).slice(0, 2000)}</pre>
                )}
              </div>
            </div>
          )}

          {/* Raw Memory (fallback for unstructured data) */}
          {Object.entries(data).filter(([k]) => !["areas.competitor-landscape", "areas.trend-watch", "areas.content-gaps"].includes(k)).length > 0 && (
            <div className="rounded-xl border bg-background shadow-sm">
              <div className="px-5 py-4 border-b">
                <h3 className="text-sm font-semibold">Other Memory</h3>
              </div>
              <div className="p-5 space-y-4">
                {Object.entries(data)
                  .filter(([k]) => !["areas.competitor-landscape", "areas.trend-watch", "areas.content-gaps"].includes(k))
                  .map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs font-mono text-muted-foreground mb-1">{key}</p>
                      <pre className="text-xs bg-muted/30 rounded p-3 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(value, null, 2).slice(0, 1000)}</pre>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
