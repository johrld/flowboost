"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MoreHorizontal,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { getCompetitors, getCompetitorDetail, triggerMonitor } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6100";

type CompetitorEntry = { slug: string; name: string; domain: string; totalArticles: number; lastScanAt: string; newSinceLastScan: number; topClusters: string[]; recentHighlight: string };
type ArticleData = { url: string; title: string; topicCluster: string | null; h2Headings: string[]; h3Headings?: string[]; estimatedWordCount: number | null; publishedAt: string | null };
type CompetitorDetailData = { profile: Record<string, unknown>; topicCoverage: { clusters: Array<{ cluster: string; articleCount: number; depth: string; trend: string }> }; recentActivity: { newArticles: Array<{ url: string; title: string; topicCluster: string | null }> }; blogStats: { totalArticles: number; lastCrawlAt: string } | null; articles: ArticleData[] };

export default function CompetitorsPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanRunId, setScanRunId] = useState<string | null>(null);
  const [scanEvents, setScanEvents] = useState<Array<{ tool: string; input: string }>>([]);
  const [scanDone, setScanDone] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompetitorDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addDomain, setAddDomain] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [onboardingRunId, setOnboardingRunId] = useState<string | null>(null);
  const [onboardingEvents, setOnboardingEvents] = useState<Array<{ tool: string; input: string; timestamp: string }>>([]);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [editComp, setEditComp] = useState<{ slug: string; name: string; domain: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");

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

  const startScanPolling = (runId: string) => {
    setScanRunId(runId);
    setScanEvents([]);
    setScanDone(false);
    setScanning(true);

    const poll = setInterval(async () => {
      try {
        const runRes = await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/pipeline/runs/${runId}`);
        if (!runRes.ok) return;
        const run = await runRes.json() as { status: string; phases: Array<{ agentCalls: Array<{ events?: Array<{ tool: string; input: string }> }> }> };

        const events: Array<{ tool: string; input: string }> = [];
        for (const phase of run.phases) {
          for (const call of phase.agentCalls) {
            if (call.events) events.push(...call.events);
          }
        }
        setScanEvents(events);

        if (run.status === "completed" || run.status === "failed") {
          setScanDone(true);
          setScanning(false);
          clearInterval(poll);
          loadData();
        }
      } catch { /* ignore */ }
    }, 2000);
    setTimeout(() => { clearInterval(poll); setScanning(false); setScanDone(true); }, 300000);
  };

  const handleScan = async () => {
    if (!customerId || !projectId || scanning) return;
    try {
      const result = await triggerMonitor(customerId, projectId, "competitor-scan");
      startScanPolling(result.runId);
    } catch { /* ignore */ }
  };

  const handleSingleScan = async (slug: string) => {
    if (!customerId || !projectId || scanning) return;
    try {
      const res = await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/cmo/competitors/${slug}/scan`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const { runId } = await res.json() as { runId: string };
      startScanPolling(runId);
    } catch { /* ignore */ }
  };

  const handleAddCompetitor = async () => {
    if (!customerId || !projectId || !addDomain.trim() || !addName.trim()) return;
    setAdding(true);
    setOnboardingEvents([]);
    setOnboardingDone(false);

    // Normalize domain
    let normalizedDomain = addDomain.trim();
    if (!normalizedDomain.startsWith("http://") && !normalizedDomain.startsWith("https://")) {
      normalizedDomain = `https://${normalizedDomain}`;
    }

    try {
      // Add to project settings
      await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addCompetitor: { domain: normalizedDomain, name: addName.trim(), notes: "" },
        }),
      });

      // Start onboarding analysis
      const res = await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/cmo/competitors/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: normalizedDomain, name: addName.trim() }),
      });
      const { runId } = await res.json() as { runId: string };
      setOnboardingRunId(runId);

      // Poll pipeline run for events
      const poll = setInterval(async () => {
        try {
          const runRes = await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/pipeline/runs/${runId}`);
          if (!runRes.ok) return;
          const run = await runRes.json() as { status: string; phases: Array<{ agentCalls: Array<{ events?: Array<{ tool: string; input: string; timestamp: string }> }> }> };

          // Collect all events from all phases
          const events: Array<{ tool: string; input: string; timestamp: string }> = [];
          for (const phase of run.phases) {
            for (const call of phase.agentCalls) {
              if (call.events) events.push(...call.events);
            }
          }
          setOnboardingEvents(events);

          if (run.status === "completed" || run.status === "failed") {
            setOnboardingDone(true);
            setAdding(false);
            clearInterval(poll);
            // Add to UI list immediately (memory index isn't updated until next scan)
            const newComp: CompetitorEntry = {
              slug: addDomain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").replace(/\..+$/, "").replace(/[^a-z0-9]/gi, "-").toLowerCase(),
              name: addName.trim(),
              domain: addDomain.trim(),
              totalArticles: 0,
              lastScanAt: "",
              newSinceLastScan: 0,
              topClusters: [],
              recentHighlight: "Just added — run a scan to index articles",
            };
            setCompetitors((prev) => prev.some((c) => c.domain === newComp.domain) ? prev : [...prev, newComp]);
            loadData();
          }
        } catch { /* ignore */ }
      }, 2000);
      setTimeout(() => { clearInterval(poll); setAdding(false); setOnboardingDone(true); }, 300000);
    } catch {
      setAdding(false);
    }
  };

  const handleDeleteCompetitor = async (domain: string, slug: string) => {
    if (!customerId || !projectId) return;
    try {
      // Remove from project settings
      await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeCompetitorDomain: domain }),
      });
      // Remove from memory (competitor data + update _index.json)
      await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/cmo/competitors/${slug}`, {
        method: "DELETE",
      });
      // Remove from UI immediately
      setCompetitors((prev) => prev.filter((c) => c.domain !== domain));
    } catch { /* ignore */ }
  };

  const handleEditCompetitor = async () => {
    if (!customerId || !projectId || !editComp) return;
    try {
      await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateCompetitor: { oldDomain: editComp.domain, domain: editDomain.trim(), name: editName.trim() },
        }),
      });
      setEditComp(null);
      loadData();
    } catch { /* ignore */ }
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
                        {(a.h2Headings?.length > 0 || a.h3Headings?.length) ? <span>· {(a.h2Headings?.length ?? 0) + (a.h3Headings?.length ?? 0)} sections</span> : null}
                      </div>
                    </div>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 hover:bg-muted rounded" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  </summary>
                  <div className="px-5 pb-4 pt-1 ml-7 space-y-2">
                    <p className="text-xs text-muted-foreground font-mono truncate">{a.url}</p>
                    {(a.h2Headings?.length > 0 || a.h3Headings?.length) && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Article Structure:</p>
                        {a.h2Headings?.map((h, j) => (
                          <p key={`h2-${j}`} className="text-xs text-muted-foreground pl-3 border-l-2 border-foreground/20 font-medium">{h}</p>
                        ))}
                        {a.h3Headings?.map((h, j) => (
                          <p key={`h3-${j}`} className="text-xs text-muted-foreground pl-6 border-l-2 border-muted">{h}</p>
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
          <p className="text-sm text-muted-foreground">Track competitor blogs and articles to find content gaps. Only editorial content is indexed — no product pages or shop listings.</p>
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
            <div
              key={c.slug}
              className="rounded-xl border bg-background shadow-sm p-5 text-left hover:shadow-md transition-shadow cursor-pointer relative group"
              onClick={() => loadDetail(c.slug)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">{c.name}</h3>
                <div className="flex items-center gap-1">
                  {c.newSinceLastScan > 0 ? <Badge variant="default" className="text-[10px]">+{c.newSinceLastScan} new</Badge> : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" onClick={(e) => e.stopPropagation()} className="p-1 rounded-md hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditComp({ slug: c.slug, name: c.name, domain: c.domain }); setEditName(c.name); setEditDomain(c.domain); }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSingleScan(c.slug); }}>
                        <RotateCcw className="mr-2 h-3.5 w-3.5" />Re-scan
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteCompetitor(c.domain, c.slug); }}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
            </div>
          ))}
          {(scanning || (scanDone && scanEvents.length > 0)) && (
            <div className="col-span-full rounded-xl border bg-background shadow-sm p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>✅</span>}
                  {scanning ? "Scanning..." : "Scan Complete"}
                </h3>
                {scanDone && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setScanRunId(null); setScanEvents([]); setScanDone(false); }}>
                    Close
                  </Button>
                )}
              </div>
              <div className="max-h-[250px] overflow-y-auto space-y-1">
                {scanEvents.map((ev, i) => {
                  const icon = ev.tool.includes("sitemap") ? "🔍" : ev.tool === "diff" ? "📊" : ev.tool.includes("crawl") ? "📄" : ev.tool.includes("index") ? "✅" : ev.tool.includes("gap") ? "📈" : "⚙️";
                  return (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="shrink-0">{icon}</span>
                      <span>{ev.input}</span>
                    </p>
                  );
                })}
                {scanning && scanEvents.length === 0 && (
                  <p className="text-xs text-muted-foreground">Starting scan...</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {detailLoading && (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      )}

      {/* Add Competitor Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { if (!adding) { setShowAdd(open); if (!open) { setOnboardingRunId(null); setOnboardingEvents([]); setOnboardingDone(false); } } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{onboardingRunId ? `Analyzing ${addName}` : "Add Competitor"}</DialogTitle>
          </DialogHeader>

          {!onboardingRunId ? (
            /* Form */
            <>
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
                  The system will discover the blog, analyze the site structure with a real browser, and validate content extraction.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddCompetitor} disabled={adding || !addDomain.trim() || !addName.trim()}>
                  {adding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                  Add & Analyze
                </Button>
              </div>
            </>
          ) : (
            /* Onboarding Progress */
            <div className="space-y-3">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {onboardingEvents.map((ev, i) => {
                  const isLast = i === onboardingEvents.length - 1;
                  const icon = ev.tool === "discover-sitemap" ? "🔍"
                    : ev.tool === "detect-blog-path" ? "📂"
                    : ev.tool === "analyze-sample" ? "📄"
                    : ev.tool === "profile-created" ? "✅"
                    : "⚙️";
                  return (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${isLast && !onboardingDone ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {ev.input}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {adding && (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Analyzing...</span>
                  </div>
                )}
              </div>
              {onboardingDone && (
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setOnboardingRunId(null); setOnboardingEvents([]); setOnboardingDone(false); setAddDomain(""); setAddName(""); }}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Competitor Dialog */}
      <Dialog open={!!editComp} onOpenChange={(open) => { if (!open) setEditComp(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Competitor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Website</label>
              <Input value={editDomain} onChange={(e) => setEditDomain(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditComp(null)}>Cancel</Button>
            <Button size="sm" onClick={handleEditCompetitor} disabled={!editName.trim() || !editDomain.trim()}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
