"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentStatusBadge, ContentTypeBadge } from "@/components/status-badge";
import { useProject } from "@/lib/project-context";
import { getContent, getTopics } from "@/lib/api";
import type { ContentItem, Topic } from "@/lib/types";
import { FileText, Eye, Plus, Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export default function CreatePage() {
  const { customerId, projectId, categories, loading: projectLoading } = useProject();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    if (!customerId || !projectId) return;
    setLoading(true);
    Promise.all([
      getContent(customerId, projectId).then((res) => res.items),
      getTopics(customerId, projectId),
    ])
      .then(([c, t]) => { setItems(c); setTopics(t); })
      .catch(() => { setItems([]); setTopics([]); })
      .finally(() => setLoading(false));
  }, [customerId, projectId]);

  const topicByTopicId = new Map(topics.map((t) => [t.id, t]));

  const filtered = items.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );

  const statusCounts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

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
          <h1 className="text-2xl font-bold">Create</h1>
          <p className="text-muted-foreground">Content editor & lifecycle management</p>
        </div>
        <Link href="/create/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Content
          </Button>
        </Link>
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
      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="producing">Producing</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="updating">Updating</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44">
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
      </div>

      {/* Content List */}
      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <div className="flex-1">Content</div>
          <div className="w-20 hidden md:block">Type</div>
          <div className="w-32 hidden md:block">Scheduled</div>
          <div className="w-24 hidden lg:block">Updated</div>
          <div className="w-24">Status</div>
          <div className="w-10"></div>
        </div>

        {sorted.map((item, idx) => {
          const cat = categories.find((c) => c.id === item.category);
          const topic = item.topicId ? topicByTopicId.get(item.topicId) : undefined;
          const schedDate = topic?.scheduledDate;
          const fmt = (iso: string) => format(new Date(iso), "dd.MM.yy");

          return (
            <Link
              key={item.id}
              href={`/create/${item.id}`}
              className={`flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors ${
                idx < sorted.length - 1 ? "border-b" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title || "Untitled"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {item.category && (
                    <span className="text-xs text-muted-foreground">
                      {cat?.labels.de ?? item.category}
                    </span>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {item.tags.slice(0, 2).join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="w-20 hidden md:block">
                <ContentTypeBadge type={item.type} />
              </div>

              <div className="w-32 hidden md:block">
                {schedDate ? (
                  <div className="flex items-center gap-1.5 text-xs tabular-nums">
                    <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>{fmt(schedDate)}</span>
                    {schedDate.includes("T") && (
                      <span className="text-muted-foreground">{schedDate.split("T")[1]}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              <div className="w-24 hidden lg:block">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {fmt(item.updatedAt)}
                </p>
              </div>

              <div className="w-24">
                <ContentStatusBadge status={item.status} />
              </div>

              <div className="w-10 text-right">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Link>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No content found</p>
          <p className="text-xs text-muted-foreground">
            Produce topics from Plan or create content manually
          </p>
        </div>
      )}
    </div>
  );
}
