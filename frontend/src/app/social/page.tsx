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
import {
  Plus,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Calendar,
  Image as ImageIcon,
  Sparkles,
  List,
  LayoutGrid,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

type Platform = "instagram" | "linkedin" | "twitter" | "facebook";
type PostStatus = "idea" | "draft" | "scheduled" | "published";

interface DemoPost {
  id: string;
  platform: Platform;
  text: string;
  status: PostStatus;
  scheduledDate?: string;
  hasImage: boolean;
  category?: string;
}

const platformConfig: Record<Platform, { icon: typeof Instagram; label: string; color: string }> = {
  instagram: { icon: Instagram, label: "Instagram", color: "text-pink-500" },
  linkedin: { icon: Linkedin, label: "LinkedIn", color: "text-blue-600" },
  twitter: { icon: Twitter, label: "X / Twitter", color: "text-foreground" },
  facebook: { icon: Facebook, label: "Facebook", color: "text-blue-500" },
};

// ── Demo Data ────────────────────────────────────────────────────

const demoPosts: DemoPost[] = [
  {
    id: "1",
    platform: "instagram",
    text: "Breathe in. Breathe out. 5 minutes of mindful breathing can transform your entire day. Try our guided session today.",
    status: "idea",
    hasImage: true,
    category: "breathing",
  },
  {
    id: "2",
    platform: "linkedin",
    text: "New research shows that daily meditation reduces workplace stress by 32%. Here's how our team integrates mindfulness into the workday.",
    status: "idea",
    hasImage: false,
    category: "meditation",
  },
  {
    id: "3",
    platform: "twitter",
    text: "Quick tip: Try box breathing before your next meeting. 4 seconds in, 4 hold, 4 out, 4 hold. Game changer.",
    status: "draft",
    hasImage: false,
    category: "breathing",
  },
  {
    id: "4",
    platform: "instagram",
    text: "Morning meditation routine: Start your day with intention, not reaction. Swipe for our 3-step guide to mindful mornings.",
    status: "draft",
    hasImage: true,
    category: "meditation",
  },
  {
    id: "5",
    platform: "facebook",
    text: "Sleep better tonight with our new Progressive Muscle Relaxation guide. 10 minutes before bed is all you need.",
    status: "scheduled",
    scheduledDate: "2026-02-12T10:00",
    hasImage: true,
    category: "sleep",
  },
  {
    id: "6",
    platform: "linkedin",
    text: "We're excited to announce the Breathe app now supports Wim Hof breathing! Download the latest update and try it today.",
    status: "scheduled",
    scheduledDate: "2026-02-14T09:00",
    hasImage: false,
    category: "breathing",
  },
  {
    id: "7",
    platform: "instagram",
    text: "Your anxiety doesn't define you. Learn 3 breathing techniques that can calm your mind in under 2 minutes.",
    status: "published",
    scheduledDate: "2026-02-05T14:00",
    hasImage: true,
    category: "stress",
  },
  {
    id: "8",
    platform: "twitter",
    text: "Just shipped: Body Scan Meditation in the Breathe app. 15 min guided session for deep relaxation. Link in bio.",
    status: "published",
    scheduledDate: "2026-02-03T11:00",
    hasImage: false,
    category: "meditation",
  },
];

// ── Board Columns ────────────────────────────────────────────────

const boardColumns: { key: PostStatus; label: string }[] = [
  { key: "idea", label: "Ideas" },
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
];

// ── Post Card (matches ContentBoardCard style) ───────────────────

function PostBoardCard({ post }: { post: DemoPost }) {
  const platform = platformConfig[post.platform];
  const PlatformIcon = platform.icon;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer hover:shadow-sm transition-shadow">
      {/* Platform Badge + Status */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1 text-[11px] px-1.5 py-0">
          <PlatformIcon className={`h-3 w-3 ${platform.color}`} />
          {platform.label}
        </Badge>
        {post.status === "draft" && (
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">Draft</Badge>
        )}
        {post.status === "scheduled" && (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-[11px] px-1.5 py-0">
            Scheduled
          </Badge>
        )}
        {post.status === "published" && (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[11px] px-1.5 py-0">
            Published
          </Badge>
        )}
      </div>

      {/* Image placeholder */}
      {post.hasImage && (
        <div className="rounded-md bg-muted/50 border border-dashed flex items-center justify-center h-20">
          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
        </div>
      )}

      {/* Text */}
      <p className="text-sm font-medium line-clamp-2">{post.text}</p>

      {/* Meta */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {post.category && <span className="capitalize">{post.category}</span>}
        {post.scheduledDate && (
          <>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(post.scheduledDate).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Idea Card (matches TopicBoardCard style) ─────────────────────

function IdeaBoardCard({ post }: { post: DemoPost }) {
  const platform = platformConfig[post.platform];
  const PlatformIcon = platform.icon;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-1.5 cursor-pointer hover:shadow-sm transition-shadow">
      {/* Title */}
      <p className="text-sm font-medium line-clamp-2">{post.text}</p>

      {/* Meta */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <PlatformIcon className={`h-3 w-3 ${platform.color}`} />
          {platform.label}
        </span>
        {post.category && (
          <>
            <span>&middot;</span>
            <span className="capitalize">{post.category}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function SocialPostsPage() {
  const [posts] = useState<DemoPost[]>(demoPosts);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "board">("board");

  const filtered = filterPlatform === "all"
    ? posts
    : posts.filter((p) => p.platform === filterPlatform);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Social Posts</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.filter((p) => p.status === "idea").length > 0 && (
              <><span className="text-primary font-medium">{filtered.filter((p) => p.status === "idea").length} ideas</span> &middot; </>
            )}
            Social media content lifecycle
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Platform Filter */}
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {Object.entries(platformConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 px-2.5 rounded-r-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "board" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 px-2.5 rounded-l-none"
              onClick={() => setViewMode("board")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {/* New Post */}
          <Button size="sm" className="gap-1.5" disabled>
            <Plus className="h-3.5 w-3.5" />
            New Post
          </Button>
        </div>
      </div>

      {/* Board View */}
      {viewMode === "board" && (
        <div className="grid grid-cols-4 gap-4">
          {boardColumns.map((col) => {
            const colPosts = filtered.filter((p) => p.status === col.key);
            return (
              <div key={col.key} className="space-y-2">
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 pb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">{colPosts.length}</span>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[200px]">
                  {colPosts.map((post) =>
                    col.key === "idea" ? (
                      <IdeaBoardCard key={post.id} post={post} />
                    ) : (
                      <PostBoardCard key={post.id} post={post} />
                    )
                  )}
                  {colPosts.length === 0 && (
                    <div className="flex items-center justify-center rounded-md border border-dashed p-6 text-center">
                      <p className="text-xs text-muted-foreground">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View (placeholder) */}
      {viewMode === "list" && (
        <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">List view coming soon</p>
        </div>
      )}

      {/* Coming Soon Banner */}
      <div className="rounded-lg border border-dashed p-4 text-center space-y-1.5">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Social Media Management coming soon</p>
        </div>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Connect your social accounts, schedule posts, and generate content with AI.
        </p>
        <Button variant="outline" size="sm" asChild className="mt-1">
          <a href="/connectors">Configure Connectors</a>
        </Button>
      </div>
    </div>
  );
}
