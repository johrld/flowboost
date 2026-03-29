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
      </div>

      {/* Flow Cards */}
      {activeFlows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm font-medium mb-1">No flows yet</p>
          <p className="text-xs text-muted-foreground mb-4">Create a flow to start planning and producing content.</p>
        </div>
      ) : (
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
                {/* Card Header */}
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base truncate">
                      {flow.title}
                      {isAI && <Sparkles className="inline ml-1.5 h-3.5 w-3.5 text-violet-500" />}
                    </h3>
                  </div>
                  {flow.briefing && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{flow.briefing}</p>
                  )}
                </div>

                {/* Content Pieces */}
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

                {/* Card Footer */}
                <div className="px-5 py-2.5 bg-muted/30 border-t flex items-center gap-3 text-xs text-muted-foreground">
                  {sourceInfo}
                  {sourceInfo && (hasBriefing || flow.createdAt) && <span>·</span>}
                  {!hasBriefing && pieces.length === 0 && (
                    <span className="text-amber-600">No briefing yet</span>
                  )}
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
