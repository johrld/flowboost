"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentStatusBadge } from "@/components/status-badge";
import {
  Plus,
  Clock,
  Mic,
  Image as ImageIcon,
  Link as LinkIcon,
  FileEdit,
  FileText,
  Linkedin,
  Instagram,
  Twitter,
  Video,
  Mail,
  Loader2,
  Sparkles,
  Package,
  LayoutGrid,
  Columns3,
  List as ListIcon,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { getTopics, getContent } from "@/lib/api";
import type { Topic, ContentItem, FlowInput } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const CONTENT_ICONS: Record<string, React.ReactNode> = {
  linkedin: <Linkedin className="h-3.5 w-3.5" />,
  instagram: <Instagram className="h-3.5 w-3.5" />,
  x: <Twitter className="h-3.5 w-3.5" />,
  tiktok: <Video className="h-3.5 w-3.5" />,
  article: <FileText className="h-3.5 w-3.5" />,
  guide: <FileText className="h-3.5 w-3.5" />,
  newsletter: <Mail className="h-3.5 w-3.5" />,
  social_post: <Linkedin className="h-3.5 w-3.5" />,
};

function getContentIcon(item: ContentItem) {
  return CONTENT_ICONS[item.category ?? ""] ?? CONTENT_ICONS[item.type] ?? <FileText className="h-3.5 w-3.5" />;
}

function getContentLabel(item: ContentItem): string {
  const labels: Record<string, string> = {
    linkedin: "LinkedIn", instagram: "Instagram", x: "X", tiktok: "TikTok",
  };
  if (item.category && labels[item.category]) return labels[item.category];
  const typeLabels: Record<string, string> = {
    article: "Article", guide: "Guide", newsletter: "Newsletter", social_post: "Social",
  };
  return typeLabels[item.type] ?? item.type;
}

function sourceCount(inputs?: FlowInput[]): React.ReactNode {
  if (!inputs || inputs.length === 0) return null;
  const icons: React.ReactNode[] = [];
  const types = new Set(inputs.map((i) => i.type));
  if (types.has("transcript")) icons.push(<Mic key="m" className="h-3 w-3" />);
  if (types.has("text")) icons.push(<FileEdit key="t" className="h-3 w-3" />);
  if (types.has("image")) icons.push(<ImageIcon key="i" className="h-3 w-3" />);
  if (types.has("url")) icons.push(<LinkIcon key="u" className="h-3 w-3" />);
  if (types.has("document")) icons.push(<FileText key="d" className="h-3 w-3" />);
  return (
    <span className="inline-flex items-center gap-1">
      {icons} {inputs.length} source{inputs.length !== 1 ? "s" : ""}
    </span>
  );
}

export default function FlowsPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "board" | "list">("cards");

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const [t, c] = await Promise.all([
        getTopics(customerId, projectId),
        getContent(customerId, projectId),
      ]);
      setTopics(t);
      setContentItems(c.items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [customerId, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group content items by flowId
  const contentByFlow = contentItems.reduce<Record<string, ContentItem[]>>((acc, item) => {
    const fid = item.flowId ?? item.topicId ?? "_unlinked";
    if (!acc[fid]) acc[fid] = [];
    acc[fid].push(item);
    return acc;
  }, {});

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeFlows = topics.filter((t) => t.status !== "archived");
  const archivedFlows = topics.filter((t) => t.status === "archived");

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flows</h1>
          <p className="text-sm text-muted-foreground">Your content campaigns and projects</p>
        </div>
        <div className="flex items-center border rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("cards")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "cards" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="Cards"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("board")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "board" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="Kanban Board"
          >
            <Columns3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-muted" : "hover:bg-muted/50"}`}
            title="List"
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Views ── */}
      {activeFlows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm font-medium mb-1">No flows yet</p>
          <p className="text-xs text-muted-foreground mb-4">Create a flow to start planning and producing content.</p>
        </div>
      ) : viewMode === "cards" ? (
        /* ── Cards View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeFlows.map((flow) => {
            const pieces = contentByFlow[flow.id] ?? [];
            const hasBriefing = !!flow.briefing?.trim();
            const sourceInfo = sourceCount(flow.inputs);
            const isAI = flow.source === "pipeline";

            return (
              <Link
                key={flow.id}
                href={`/flows/${flow.id}`}
                className="block rounded-xl bg-background border shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="px-5 pt-4 pb-3">
                  <h3 className="font-semibold text-base truncate">
                    {flow.title}
                    {isAI && <Sparkles className="inline ml-1.5 h-3.5 w-3.5 text-violet-500" />}
                  </h3>
                  {flow.briefing && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{flow.briefing}</p>
                  )}
                </div>
                {pieces.length > 0 && (
                  <div className="px-5 pb-3 space-y-1.5">
                    {pieces.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{getContentIcon(item)}</span>
                        <span className="flex-1 truncate text-muted-foreground">{getContentLabel(item)}</span>
                        <ContentStatusBadge status={item.status} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-5 py-2.5 bg-muted/30 border-t flex items-center gap-3 text-xs text-muted-foreground">
                  {sourceInfo}
                  {sourceInfo && (hasBriefing || flow.createdAt) && <span>·</span>}
                  {!hasBriefing && pieces.length === 0 && <span className="text-amber-600">No briefing yet</span>}
                  {flow.createdAt && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(flow.createdAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

      ) : viewMode === "board" ? (
        /* ── Kanban Board View ── */
        <div className="grid grid-cols-4 gap-4">
          {[
            { key: "planned", label: "Planned", statuses: ["planned", "producing"] },
            { key: "draft", label: "Draft", statuses: ["draft"] },
            { key: "review", label: "Review", statuses: ["review", "approved", "delivered"] },
            { key: "published", label: "Published", statuses: ["published", "updating"] },
          ].map((col) => {
            const colItems = contentItems.filter((i) => col.statuses.includes(i.status));
            return (
              <div key={col.key} className="space-y-2">
                <div className="flex items-center justify-between px-1 pb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">{colItems.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {colItems.map((item) => {
                    const flow = topics.find((t) => t.id === (item.flowId ?? item.topicId));
                    return (
                      <Link
                        key={item.id}
                        href={`/content/${item.id}`}
                        className="block rounded-lg border bg-background p-3 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-muted-foreground">{getContentIcon(item)}</span>
                          <span className="text-xs font-medium">{getContentLabel(item)}</span>
                        </div>
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        {flow && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">Flow: {flow.title}</p>
                        )}
                      </Link>
                    );
                  })}
                  {colItems.length === 0 && (
                    <div className="flex items-center justify-center rounded-md border border-dashed p-6">
                      <p className="text-xs text-muted-foreground">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        /* ── List View ── */
        <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Content</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Flow</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {contentItems.map((item) => {
                const flow = topics.find((t) => t.id === (item.flowId ?? item.topicId));
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/content/${item.id}`} className="font-medium hover:underline">{item.title}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {getContentIcon(item)}
                        {getContentLabel(item)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {flow ? (
                        <Link href={`/flows/${flow.id}`} className="text-muted-foreground hover:underline">{flow.title}</Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <ContentStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                    </td>
                  </tr>
                );
              })}
              {contentItems.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">No content pieces yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Archived Flows */}
      {archivedFlows.length > 0 && (
        <details className="group">
          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Archived ({archivedFlows.length})
          </summary>
          <div className="mt-3 space-y-2">
            {archivedFlows.map((flow) => (
              <Link
                key={flow.id}
                href={`/flows/${flow.id}`}
                className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors opacity-60"
              >
                <span className="text-sm">{flow.title}</span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
