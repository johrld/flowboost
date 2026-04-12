"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  Users,
  ExternalLink,
  Clock,
  ArrowLeft,
  FileText,
  Globe,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { getCompetitors, getCompetitorDetail, triggerMonitor } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6100";

type CompetitorEntry = { slug: string; name: string; domain: string; totalArticles: number; lastScanAt: string; newSinceLastScan: number; topClusters: string[]; recentHighlight: string };
type ArticleData = { url: string; title: string; topicCluster: string | null; h2Headings: string[]; estimatedWordCount: number | null; publishedAt: string | null };
type CompetitorDetailData = { profile: Record<string, unknown>; topicCoverage: { clusters: Array<{ cluster: string; articleCount: number; depth: string; trend: string }> }; recentActivity: { newArticles: Array<{ url: string; title: string; topicCluster: string | null }> }; blogStats: { totalArticles: number; lastCrawlAt: string } | null; articles: ArticleData[] };

export default function CompetitorsPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompetitorDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addDomain, setAddDomain] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const result = await getCompetitors(customerId, projectId);
      const idx = result.index as { competitors: CompetitorEntry[] } | null;
      if (idx?.competitors) setCompetitors(idx.competitors);
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

  const handleScan = async () => {
    if (!customerId || !projectId || scanning) return;
    setScanning(true);
    try {
      await triggerMonitor(customerId, projectId, "competitor-scan");
      // Poll until done
      const poll = setInterval(async () => {
        try {
          const result = await getCompetitors(customerId, projectId);
          const idx = result.index as { competitors: CompetitorEntry[] } | null;
          if (idx?.competitors && JSON.stringify(idx.competitors) !== JSON.stringify(competitors)) {
            setCompetitors(idx.competitors);
            setScanning(false);
            clearInterval(poll);
          }
        } catch { /* ignore */ }
      }, 5000);
      setTimeout(() => { clearInterval(poll); setScanning(false); }, 300000);
    } catch { setScanning(false); }
  };

  const handleAddCompetitor = async () => {
    if (!customerId || !projectId || !addDomain.trim() || !addName.trim()) return;
    setAdding(true);
    try {
      // Add to project settings
      const res = await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addCompetitor: { domain: addDomain.trim(), name: addName.trim(), notes: "" },
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddDomain("");
        setAddName("");
        // Trigger scan for the new competitor
        await triggerMonitor(customerId, projectId, "competitor-scan");
        setScanning(true);
        // Poll for results
        const poll = setInterval(async () => {
          const result = await getCompetitors(customerId, projectId);
          const idx = result.index as { competitors: CompetitorEntry[] } | null;
          if (idx?.competitors && idx.competitors.length > competitors.length) {
            setCompetitors(idx.competitors);
            setScanning(false);
            clearInterval(poll);
          }
        }, 5000);
        setTimeout(() => { clearInterval(poll); setScanning(false); }, 300000);
      }
    } catch { /* ignore */ }
    finally { setAdding(false); }
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

  // ── Detail View ─────────────────────────────
  if (selectedSlug && detail) {
    const comp = competitors.find((c) => c.slug === selectedSlug);
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <button type="button" onClick={() => { setSelectedSlug(null); setDetail(null); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to Competitors
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

        {/* Articles */}
        {detail.articles?.length > 0 && (
          <div className="rounded-xl border bg-background shadow-sm">
            <div className="px-5 py-4 border-b">
              <h3 className="text-sm font-semibold">Indexed Articles ({detail.articles.length})</h3>
            </div>
            <div className="divide-y">
              {detail.articles.filter((a) => a.title).map((a, i) => (
                <details key={i} className="group">
                  <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {a.topicCluster ? <span className="capitalize">{a.topicCluster.replace(/-/g, " ")}</span> : null}
                        {a.estimatedWordCount ? <span>· {a.estimatedWordCount.toLocaleString()} words</span> : null}
                        {a.h2Headings?.length > 0 ? <span>· {a.h2Headings.length} sections</span> : null}
                      </div>
                    </div>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 hover:bg-muted rounded" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  </summary>
                  <div className="px-5 pb-4 pt-1 ml-7 space-y-2">
                    <p className="text-xs text-muted-foreground font-mono truncate">{a.url}</p>
                    {a.h2Headings?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">H2 Structure:</p>
                        {a.h2Headings.map((h, j) => (
                          <p key={j} className="text-xs text-muted-foreground pl-3 border-l-2 border-muted">{h}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {a.estimatedWordCount ? <span>{a.estimatedWordCount.toLocaleString()} words</span> : null}
                      {a.publishedAt ? <span>Published: {new Date(a.publishedAt).toLocaleDateString()}</span> : null}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List View ───────────────────────────────
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" />Competitors</h1>
          <p className="text-sm text-muted-foreground">Track competitor content and find gaps in your coverage.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Add Competitor
          </Button>
          <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
            {scanning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Scan All
          </Button>
        </div>
      </div>

      {competitors.length === 0 && !scanning ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center space-y-4">
          <Users className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium">No competitors tracked yet</p>
          <p className="text-xs text-muted-foreground">Add your competitors to start tracking their content strategy.</p>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Add Competitor
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          {scanning && (
            <div className="rounded-xl border-2 border-dashed p-5 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Scanning...</span>
            </div>
          )}
        </div>
      )}

      {detailLoading && (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      )}

      {/* Add Competitor Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Calm" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Website</label>
              <Input value={addDomain} onChange={(e) => setAddDomain(e.target.value)} placeholder="e.g. https://www.calm.com" />
            </div>
            <p className="text-xs text-muted-foreground">
              The system will automatically discover the blog, analyze the site structure, and start indexing articles.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddCompetitor} disabled={adding || !addDomain.trim() || !addName.trim()}>
              {adding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              Add & Analyze
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
