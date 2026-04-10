"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Linkedin,
  Instagram,
  Twitter,
  Video,
  Mail,
  Loader2,
  Sparkles,
  Package,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from "@/lib/project-context";
import { getContent, getTopics, deleteContent, createArticleJob, createSocialJob } from "@/lib/api";
import type { Topic, ContentItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const CHANNEL_TABS = [
  { key: "all", label: "All" },
  { key: "article", label: "Blog" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "x", label: "X" },
  { key: "tiktok", label: "TikTok" },
  { key: "newsletter", label: "Newsletter" },
] as const;

const CONTENT_ICONS: Record<string, React.ReactNode> = {
  linkedin: <Linkedin className="h-4 w-4" />,
  instagram: <Instagram className="h-4 w-4" />,
  x: <Twitter className="h-4 w-4" />,
  tiktok: <Video className="h-4 w-4" />,
  article: <FileText className="h-4 w-4" />,
  guide: <FileText className="h-4 w-4" />,
  newsletter: <Mail className="h-4 w-4" />,
  social_post: <Linkedin className="h-4 w-4" />,
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  planned: { label: "Planned", variant: "secondary" },
  producing: { label: "Producing", variant: "outline" },
  draft: { label: "Draft", variant: "secondary" },
  review: { label: "Review", variant: "outline" },
  approved: { label: "Approved", variant: "outline" },
  delivered: { label: "Delivered", variant: "outline" },
  published: { label: "Published", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

function getIcon(item: ContentItem) {
  return CONTENT_ICONS[item.category ?? ""] ?? CONTENT_ICONS[item.type] ?? <FileText className="h-4 w-4" />;
}

function getTypeLabel(item: ContentItem): string {
  const labels: Record<string, string> = {
    linkedin: "LinkedIn Post", instagram: "Instagram Post", x: "X Post", tiktok: "TikTok Post",
  };
  if (item.category && labels[item.category]) return labels[item.category];
  const typeLabels: Record<string, string> = {
    article: "Blog Post", guide: "Guide", newsletter: "Newsletter", social_post: "Social Post",
  };
  return typeLabels[item.type] ?? item.type.replace("_", " ");
}

export default function ContentLibraryPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelTab, setChannelTab] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [flowFilter, setFlowFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const [c, t] = await Promise.all([
        getContent(customerId, projectId),
        getTopics(customerId, projectId),
      ]);
      setItems(c.items ?? []);
      setTopics(t);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [customerId, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!customerId || !projectId) return;
    try {
      await deleteContent(customerId, projectId, id);
      await loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleGenerate = async (item: ContentItem) => {
    if (!customerId || !projectId || !item.flowId) return;
    try {
      const socialPlatforms = ["linkedin", "instagram", "x", "tiktok"];
      if (item.type === "social_post" && item.category && socialPlatforms.includes(item.category)) {
        await createSocialJob(customerId, projectId, { flowId: item.flowId, platform: item.category, contentId: item.id });
      } else {
        await createArticleJob(customerId, projectId, { flowId: item.flowId, contentId: item.id });
      }
      await loadData();
    } catch (err) {
      console.error("Generate failed:", err);
    }
  };

  // Filter
  const filtered = items.filter((item) => {
    if (channelTab === "article" && item.type !== "article" && item.type !== "guide") return false;
    if (channelTab === "linkedin" && item.category !== "linkedin") return false;
    if (channelTab === "instagram" && item.category !== "instagram") return false;
    if (channelTab === "x" && item.category !== "x") return false;
    if (channelTab === "tiktok" && item.category !== "tiktok") return false;
    if (channelTab === "newsletter" && item.type !== "newsletter") return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (flowFilter !== "all" && (item.flowId ?? item.topicId) !== flowFilter) return false;
    return true;
  });

  // Group by status for counts
  const counts = {
    all: items.length,
    article: items.filter((i) => i.type === "article" || i.type === "guide").length,
    linkedin: items.filter((i) => i.category === "linkedin").length,
    instagram: items.filter((i) => i.category === "instagram").length,
    x: items.filter((i) => i.category === "x").length,
    tiktok: items.filter((i) => i.category === "tiktok").length,
    newsletter: items.filter((i) => i.type === "newsletter").length,
  };

  const topicMap = topics.reduce<Record<string, Topic>>((acc, t) => { acc[t.id] = t; return acc; }, {});

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Content</h1>
        <p className="text-sm text-muted-foreground">All your content pieces across every channel.</p>
      </div>

      {/* Channel Tabs */}
      <div className="flex items-center gap-1 border-b">
        {CHANNEL_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setChannelTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              channelTab === tab.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {counts[tab.key as keyof typeof counts] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Statuses</option>
          <option value="planned">Planned</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={flowFilter}
          onChange={(e) => setFlowFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Flows</option>
          {topics.filter((t) => t.status !== "archived").map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        {(statusFilter !== "all" || flowFilter !== "all") && (
          <button
            onClick={() => { setStatusFilter("all"); setFlowFilter("all"); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Content List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm font-medium mb-1">No content found</p>
          <p className="text-xs text-muted-foreground">
            {items.length === 0
              ? "Create content from a Flow to see it here."
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-background shadow-sm divide-y">
          {filtered.map((item) => {
            const status = STATUS_BADGE[item.status] ?? { label: item.status, variant: "secondary" as const };
            const isProducing = item.status === "producing";
            const flow = topicMap[item.flowId ?? item.topicId ?? ""];

            return (
              <Link
                key={item.id}
                href={`/content/${item.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  {getIcon(item)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {getTypeLabel(item)}
                    {flow && <> · <span className="text-foreground/60">{flow.title}</span></>}
                    {item.updatedAt && ` · ${formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}`}
                  </p>
                </div>
                {isProducing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                <Badge variant={status.variant} className="text-xs shrink-0">{status.label}</Badge>
                {!isProducing && item.flowId && (
                  <button
                    type="button"
                    title="Generate with AI"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleGenerate(item); }}
                    className="p-1.5 rounded-full hover:bg-violet-50 text-muted-foreground hover:text-violet-600 transition-colors shrink-0"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                    <button type="button" className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/content/${item.id}`}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                      </Link>
                    </DropdownMenuItem>
                    {flow && (
                      <DropdownMenuItem asChild>
                        <Link href={`/flows/${flow.id}`}>
                          <FileText className="mr-2 h-3.5 w-3.5" />Go to Flow
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={(e) => { e.preventDefault(); handleDelete(item.id); }}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
