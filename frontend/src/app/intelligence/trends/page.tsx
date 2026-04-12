"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, RefreshCw } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { getProjectMemory, triggerMonitor } from "@/lib/api";

export default function TrendsPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [trends, setTrends] = useState<Record<string, unknown> | null>(null);
  const [meta, setMeta] = useState<{ lastUpdated: Record<string, string> }>({ lastUpdated: {} });

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const result = await getProjectMemory(customerId, projectId);
      setMeta(result.meta);
      setTrends(result.data["areas.trend-watch"] as Record<string, unknown> ?? null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [customerId, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleScan = async () => {
    if (!customerId || !projectId || scanning) return;
    setScanning(true);
    try {
      await triggerMonitor(customerId, projectId, "trend-scan");
      const poll = setInterval(async () => {
        const result = await getProjectMemory(customerId, projectId);
        if (JSON.stringify(result.meta.lastUpdated) !== JSON.stringify(meta.lastUpdated)) {
          setMeta(result.meta);
          setTrends(result.data["areas.trend-watch"] as Record<string, unknown> ?? null);
          setScanning(false);
          clearInterval(poll);
        }
      }, 5000);
      setTimeout(() => { clearInterval(poll); setScanning(false); }, 180000);
    } catch { setScanning(false); }
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

  const trendItems = Array.isArray((trends as Record<string, unknown>)?.trends) ? (trends as Record<string, unknown>).trends as Array<Record<string, unknown>> : null;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6" />Trends</h1>
          <p className="text-sm text-muted-foreground">Trending topics in your niche.</p>
        </div>
        <div className="flex items-center gap-3">
          {meta.lastUpdated["areas/trend-watch.json"] && (
            <span className="text-xs text-muted-foreground">Last scan: {timeAgo(meta.lastUpdated["areas/trend-watch.json"])}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
            {scanning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Scan Trends
          </Button>
        </div>
      </div>

      {!trends ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center space-y-4">
          <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium">No trend data yet</p>
          <p className="text-xs text-muted-foreground">Run a trend scan to discover what topics are trending in your niche.</p>
          <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
            {scanning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="mr-1.5 h-3.5 w-3.5" />}
            Scan Now
          </Button>
        </div>
      ) : trendItems ? (
        <div className="rounded-xl border bg-background shadow-sm divide-y">
          {trendItems.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium">{String(t.topic)}</p>
                {t.suggestedAngle ? <p className="text-xs text-muted-foreground mt-0.5">{String(t.suggestedAngle)}</p> : null}
                {t.source ? <p className="text-xs text-muted-foreground">{String(t.source)}</p> : null}
              </div>
              {t.relevanceScore !== undefined && (
                <span className="text-xs font-mono text-muted-foreground">{String(t.relevanceScore)}/100</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-background shadow-sm p-5">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(trends, null, 2).slice(0, 2000)}</pre>
        </div>
      )}
    </div>
  );
}
