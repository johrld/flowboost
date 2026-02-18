"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IndexStatusBadge } from "@/components/status-badge";
import { useProject } from "@/lib/project-context";
import { getContentIndex, syncContentIndex } from "@/lib/api";
import type { ContentIndexEntry } from "@/lib/types";
import { Globe, RefreshCw, Loader2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function WebsitePage() {
  const { customerId, projectId, project, categories, loading: projectLoading } = useProject();
  const [entries, setEntries] = useState<ContentIndexEntry[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLang, setFilterLang] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  const defaultLang = project?.defaultLanguage ?? "de";
  const enabledLangs = project?.languages.filter((l) => l.enabled) ?? [];

  const loadIndex = useCallback(async () => {
    if (!customerId || !projectId) return;
    setLoading(true);
    try {
      const result = await getContentIndex(customerId, projectId);
      setEntries(result.entries);
      setLastSyncedAt(result.lastSyncedAt);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId]);

  useEffect(() => { loadIndex(); }, [loadIndex]);

  const handleSync = async () => {
    if (!customerId || !projectId || syncing) return;
    setSyncing(true);
    try {
      await syncContentIndex(customerId, projectId);
      await loadIndex();
    } finally {
      setSyncing(false);
    }
  };

  const filtered = entries.filter((entry) => {
    if (filterStatus !== "all" && entry.status !== filterStatus) return false;
    if (filterCategory !== "all" && entry.site?.category !== filterCategory) return false;
    if (filterLang !== "all" && !entry.site?.languages.some((l) => l.lang === filterLang)) return false;
    if (filterSource !== "all" && entry.source !== filterSource) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) =>
    (b.lastSyncedAt ?? b.createdAt).localeCompare(a.lastSyncedAt ?? a.createdAt),
  );

  const statusCounts = entries.reduce(
    (acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  const getTitle = (entry: ContentIndexEntry) => {
    const langs = entry.site?.languages ?? [];
    const primary = langs.find((l) => l.lang === defaultLang) ?? langs[0];
    return primary?.title ?? "Untitled";
  };

  const getWordCount = (entry: ContentIndexEntry) => {
    const langs = entry.site?.languages ?? [];
    const primary = langs.find((l) => l.lang === defaultLang) ?? langs[0];
    return primary?.wordCount;
  };

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Website</h1>
          <p className="text-muted-foreground">All content indexed from the website</p>
        </div>
        <div className="flex items-center gap-3">
          {lastSyncedAt && (
            <span className="text-xs text-muted-foreground">
              Synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Badge
            key={status}
            variant="outline"
            className="gap-1 px-3 py-1.5 cursor-pointer"
            onClick={() => setFilterStatus(status === filterStatus ? "all" : status)}
          >
            {count} {status}
          </Badge>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="producing">Producing</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.labels.de ?? cat.labels.en ?? cat.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterLang} onValueChange={setFilterLang}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            {enabledLangs.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="flowboost">FlowBoost</SelectItem>
            <SelectItem value="external">External</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content List */}
      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <div className="flex-1">Content</div>
          <div className="w-28 hidden md:block">Languages</div>
          <div className="w-28 hidden md:block">Category</div>
          <div className="w-16 hidden lg:block text-right">Words</div>
          <div className="w-20 hidden lg:block">Source</div>
          <div className="w-20">Status</div>
        </div>

        {sorted.map((entry, idx) => {
          const cat = categories.find((c) => c.id === entry.site?.category);
          const langs = entry.site?.languages ?? [];
          const wordCount = getWordCount(entry);

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors ${
                idx < sorted.length - 1 ? "border-b" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getTitle(entry)}</p>
                {entry.site?.keywords && entry.site.keywords.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {entry.site.keywords.slice(0, 3).join(", ")}
                  </p>
                )}
              </div>

              <div className="w-28 hidden md:flex gap-1 flex-wrap">
                {langs.map((l) => (
                  <span
                    key={l.lang}
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground uppercase"
                  >
                    {l.lang}
                  </span>
                ))}
              </div>

              <div className="w-28 hidden md:block">
                <span className="text-xs text-muted-foreground">
                  {cat?.labels.de ?? entry.site?.category ?? "—"}
                </span>
              </div>

              <div className="w-16 hidden lg:block text-right">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {wordCount ? wordCount.toLocaleString() : "—"}
                </span>
              </div>

              <div className="w-20 hidden lg:block">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    entry.source === "flowboost"
                      ? "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {entry.source === "flowboost" ? "FlowBoost" : "External"}
                </span>
              </div>

              <div className="w-20">
                <IndexStatusBadge status={entry.status} />
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
          <Globe className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No content indexed</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click Sync to import content from your website
          </p>
        </div>
      )}
    </div>
  );
}
