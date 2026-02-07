"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StageBadge, ConditionBadge } from "@/components/status-badge";
import { articles, categories, authors } from "@/lib/mock-data";
import { FileText, Eye } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export default function ArticlesPage() {
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filtered = articles.filter((a) => {
    if (filterStage !== "all" && a.stage !== filterStage) return false;
    if (filterCategory !== "all" && a.category !== filterCategory) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.lastEditedAt && b.lastEditedAt) return b.lastEditedAt.localeCompare(a.lastEditedAt);
    return 0;
  });

  const stageCounts = articles.reduce(
    (acc, a) => {
      acc[a.stage] = (acc[a.stage] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Articles</h1>
          <p className="text-muted-foreground">
            Review, edit, and manage your content
          </p>
        </div>
      </div>

      {/* Stage Summary */}
      <div className="flex gap-2">
        {Object.entries(stageCounts).map(([stage, count]) => (
          <Badge
            key={stage}
            variant="outline"
            className="gap-1 px-3 py-1.5 cursor-pointer"
            onClick={() => setFilterStage(stage === filterStage ? "all" : stage)}
          >
            {count} {stage}
          </Badge>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="producing">Producing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="live">Live</SelectItem>
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
                {cat.labels.de}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Article List */}
      <div className="rounded-lg border overflow-hidden">
        {/* Header Row */}
        <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <div className="flex-1">Article</div>
          <div className="w-24 hidden md:block">Created</div>
          <div className="w-24 hidden lg:block">Live since</div>
          <div className="w-24 hidden lg:block">Last edited</div>
          <div className="w-20">Stage</div>
          <div className="w-28">Condition</div>
          <div className="w-10"></div>
        </div>

        {sorted.map((article, idx) => {
          const author = authors.find((a) => a.id === article.author);
          const category = categories.find((c) => c.id === article.category);
          const fmt = (iso: string) => format(new Date(iso), "dd.MM.yy");

          return (
            <Link
              key={article.id}
              href={`/articles/${article.id}`}
              className={`flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors ${
                idx < sorted.length - 1 ? "border-b" : ""
              }`}
            >
              {/* Title + Meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{article.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {article.lang.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {author?.name ?? article.author}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {category?.labels.de ?? article.category}
                  </span>
                </div>
              </div>

              {/* Created */}
              <div className="w-24 hidden md:block">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {fmt(article.createdAt)}
                </p>
              </div>

              {/* Live since */}
              <div className="w-24 hidden lg:block">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {article.publishedAt ? fmt(article.publishedAt) : "—"}
                </p>
              </div>

              {/* Last edited */}
              <div className="w-24 hidden lg:block">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {article.lastEditedAt ? fmt(article.lastEditedAt) : "—"}
                </p>
              </div>

              {/* Stage */}
              <div className="w-20">
                <StageBadge stage={article.stage} />
              </div>

              {/* Condition */}
              <div className="w-28">
                <ConditionBadge condition={article.condition} />
              </div>

              {/* Action */}
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
          <p className="text-sm font-medium">No articles found</p>
          <p className="text-xs text-muted-foreground">
            Produce topics from the Planner to see articles here
          </p>
        </div>
      )}
    </div>
  );
}
