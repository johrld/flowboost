"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Activity,
  Cable,
  ImageIcon,
  Library,
  BarChart3,
  Brain,
  FileText,
  Layers,
  Mail,
  MessageSquare,
  TrendingUp,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  Settings,
  ChevronDown,
  Plus,
  LayoutTemplate,
  Archive,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from "@/lib/project-context";
import { CreateProjectWizard } from "@/components/create-project-wizard";
import { getTopics, createTopic, updateTopic, deleteTopic, createContent } from "@/lib/api";
import type { Topic } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlowOnboardingModal } from "@/components/flow-onboarding-modal";
import { CmoChat } from "@/components/cmo-chat";

const settingsItems = [
  { href: "/connectors", label: "Connectors", icon: Cable },
  { href: "/settings/content-types", label: "Content Types", icon: LayoutTemplate },
  { href: "/settings", label: "Project", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { customerId, projectId, project, projects, setActiveProject } = useProject();
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [flows, setFlows] = useState<Topic[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [cmoOpen, setCmoOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteFlowId, setDeleteFlowId] = useState<string | null>(null);

  const loadFlows = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const topics = await getTopics(customerId, projectId);
      setFlows(topics);
    } catch {
      // API not available
    }
  }, [customerId, projectId]);

  useEffect(() => { loadFlows(); }, [loadFlows]);

  // Reload flows on navigation and custom events
  useEffect(() => {
    if (pathname === "/flows" || pathname.startsWith("/flows/")) {
      loadFlows();
    }
  }, [pathname, loadFlows]);

  useEffect(() => {
    const handler = () => loadFlows();
    window.addEventListener("flows-updated", handler);
    return () => window.removeEventListener("flows-updated", handler);
  }, [loadFlows]);

  const handleOpenOnboarding = () => {
    setShowOnboarding(true);
  };

  const handleCreateFlow = async (title: string, contentTypeIds: string[] = []) => {
    if (!customerId || !projectId) return;
    const topic = await createTopic(customerId, projectId, { title });

    // Pre-create content pieces as "planned" (no pipeline started — user decides when to generate)
    const categoryMap: Record<string, string> = {
      "blog-post": "article", "linkedin-post": "social_post", "instagram-post": "social_post",
      "x-post": "social_post", "tiktok-post": "social_post", "newsletter": "newsletter",
    };
    const platformMap: Record<string, string> = {
      "linkedin-post": "linkedin", "instagram-post": "instagram", "x-post": "x", "tiktok-post": "tiktok",
    };
    for (const ctId of contentTypeIds) {
      try {
        await createContent(customerId, projectId, {
          type: (categoryMap[ctId] ?? "article") as import("@/lib/types").ContentType,
          title,
          category: platformMap[ctId],
          flowId: topic.id,
        });
      } catch { /* ignore */ }
    }

    await loadFlows();
    router.push(`/flows/${topic.id}`);
  };

  const handleRenameFlow = async (flowId: string) => {
    if (!renameValue.trim() || !customerId || !projectId) return;
    try {
      await updateTopic(customerId, projectId, flowId, { title: renameValue.trim() });
      setRenamingId(null);
      await loadFlows();
      window.dispatchEvent(new Event("flows-updated"));
    } catch (err) {
      console.error("Rename failed:", err);
    }
  };

  const handleArchiveFlow = async (flowId: string) => {
    if (!customerId || !projectId) return;
    try {
      await updateTopic(customerId, projectId, flowId, { status: "archived" as Topic["status"] });
      await loadFlows();
    } catch (err) {
      console.error("Archive failed:", err);
    }
  };

  const handleUnarchiveFlow = async (flowId: string) => {
    if (!customerId || !projectId) return;
    try {
      await updateTopic(customerId, projectId, flowId, { status: "proposed" as Topic["status"] });
      await loadFlows();
    } catch (err) {
      console.error("Unarchive failed:", err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!customerId || !projectId || !deleteFlowId) return;
    try {
      await deleteTopic(customerId, projectId, deleteFlowId);
      setDeleteFlowId(null);
      await loadFlows();
      if (pathname === `/flows/${deleteFlowId}`) router.push("/dashboard");
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Split flows into active and archived
  const activeFlows = flows.filter((f) => f.status !== "rejected" && f.status !== "archived");
  const archivedFlows = flows.filter((f) => f.status === "archived");

  const calendarActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const contentActive = pathname === "/content" || (pathname.startsWith("/content/") && !pathname.startsWith("/content/topics"));
  const intelligenceActive = pathname.startsWith("/intelligence");
  const monitorActive = pathname === "/monitor" || pathname.startsWith("/monitor/");

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <Link href="/content/articles" className="flex items-center gap-2.5 border-b px-4 py-4 hover:bg-muted/50 transition-colors">
        <Image src="/logo.png" alt="FlowBoost" width={28} height={28} className="rounded-md" />
        <span className="text-lg font-semibold">flowboost</span>
      </Link>

      {/* Project Selector */}
      <div className="border-b px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-between font-medium">
              {project?.name ?? "Loading..."}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {projects.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setActiveProject(p)}>
                {p.name}
                {p.id === project?.id && (
                  <span className="ml-auto text-xs text-muted-foreground">Active</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowCreateWizard(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content Section */}
      <div className="px-3 pt-4 pb-1">
        <div className="px-3 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content</span>
        </div>
        <div className="space-y-0.5">
          <Link href="/dashboard" className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", calendarActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
            <CalendarDays className="h-4 w-4" />Calendar
          </Link>
          <Link href="/content/articles" className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", pathname === "/content/articles" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
            <FileText className="h-4 w-4" />Articles
          </Link>
          <Link href="/content/social" className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", pathname === "/content/social" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
            <MessageSquare className="h-4 w-4" />Social Posts
          </Link>
          <Link href="/content/newsletters" className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", pathname === "/content/newsletters" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
            <Mail className="h-4 w-4" />Newsletters
          </Link>
          <Link href="/media" className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", (pathname === "/media" || pathname.startsWith("/media/")) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
            <ImageIcon className="h-4 w-4" />Media
          </Link>
          <Link href="/content/campaigns" className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", pathname.startsWith("/content/campaigns") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
            <Layers className="h-4 w-4" />Campaigns
          </Link>
        </div>
      </div>

      {/* Intelligence Section */}
      <div className="px-3 pt-3 pb-1">
        <div className="px-3 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intelligence</span>
        </div>
        <div className="space-y-0.5">
          <Link
            href="/intelligence"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/intelligence"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Overview
          </Link>
          <Link
            href="/intelligence/competitors"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/intelligence/competitors")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            Competitors
          </Link>
          <Link
            href="/intelligence/trends"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/intelligence/trends"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Trends
          </Link>
        </div>
      </div>

      {/* Settings */}
      <div className="px-3 pt-3 pb-1">
        <div className="px-3 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</span>
        </div>
        <div className="space-y-0.5">
          {settingsItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Monitor + CMO Chat */}
      <div className="px-3 pb-1 space-y-0.5">
        <Link
          href="/monitor"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            monitorActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <Activity className="h-4 w-4" />
          Monitor
        </Link>
        <button
          type="button"
          onClick={() => setCmoOpen(true)}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <MessageSquare className="h-4 w-4" />
          CMO Chat
        </button>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
        <span className={cn(
          "h-2 w-2 rounded-full",
          process.env.NODE_ENV === "production" ? "bg-green-500" : "bg-amber-500"
        )} />
        flowboost v0.3.0{process.env.NODE_ENV !== "production" && " dev"}
      </div>

      <CreateProjectWizard
        open={showCreateWizard}
        onOpenChange={setShowCreateWizard}
      />

      <FlowOnboardingModal
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onCreateFlow={handleCreateFlow}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteFlowId} onOpenChange={(open) => { if (!open) setDeleteFlowId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Flow?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>All content, sources, and chat history will be permanently deleted.</strong>{" "}
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteFlowId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CMO Chat Overlay */}
      {cmoOpen && customerId && projectId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setCmoOpen(false)} />
          <div className="relative w-full max-w-md bg-background border-l shadow-xl flex flex-col h-full animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />CMO Chat
              </h3>
              <button type="button" onClick={() => setCmoOpen(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <CmoChat customerId={customerId} projectId={projectId} />
          </div>
        </div>
      )}
    </aside>
  );
}
