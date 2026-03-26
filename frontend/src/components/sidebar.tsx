"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Activity,
  Cable,
  MoreHorizontal,
  Pencil,
  Trash2,
  Settings,
  ChevronDown,
  Plus,
  LayoutTemplate,
  Archive,
  Loader2,
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
import { getTopics, createTopic, updateTopic, deleteTopic } from "@/lib/api";
import type { Topic } from "@/lib/types";

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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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

  const handleNewFlow = async () => {
    if (!customerId || !projectId || creatingFlow) return;
    setCreatingFlow(true);
    try {
      const topic = await createTopic(customerId, projectId, {
        title: "Untitled Flow",
      });
      router.push(`/flows/${topic.id}`);
    } catch (err) {
      console.error("Failed to create flow:", err);
    } finally {
      setCreatingFlow(false);
    }
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

  const handleDeleteFlow = async (flowId: string) => {
    if (!customerId || !projectId) return;
    if (!confirm("Permanently delete this flow? This cannot be undone.")) return;
    try {
      await deleteTopic(customerId, projectId, flowId);
      await loadFlows();
      if (pathname === `/flows/${flowId}`) router.push("/dashboard");
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Split flows into active and archived
  const activeFlows = flows.filter((f) => f.status !== "rejected" && f.status !== "archived");
  const archivedFlows = flows.filter((f) => f.status === "archived");

  const calendarActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const monitorActive = pathname === "/monitor" || pathname.startsWith("/monitor/");

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b px-4 py-4">
        <Image src="/logo.png" alt="FlowBoost" width={28} height={28} className="rounded-md" />
        <span className="text-lg font-semibold">flowboost</span>
      </div>

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

      {/* Calendar */}
      <div className="px-3 pt-4 pb-1">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            calendarActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Calendar
        </Link>
      </div>

      {/* Flows Section */}
      <div className="flex-1 flex flex-col min-h-0 px-3 pt-3">
        <div className="flex items-center justify-between px-3 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Flows</span>
          <button
            type="button"
            onClick={handleNewFlow}
            disabled={creatingFlow}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="New Flow"
          >
            {creatingFlow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Flow List */}
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {activeFlows.map((flow) => {
            const isActive = pathname === `/flows/${flow.id}`;
            const outputCount = flow.outputIds?.length ?? 0;
            const isRenaming = renamingId === flow.id;

            if (isRenaming) {
              return (
                <div key={flow.id} className="rounded-md bg-sidebar-accent px-3 py-1.5">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameFlow(flow.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRenameFlow(flow.id); if (e.key === "Escape") setRenamingId(null); }}
                    autoFocus
                    className="w-full text-sm bg-transparent outline-none caret-primary"
                  />
                </div>
              );
            }

            return (
              <div key={flow.id} className="group relative">
                <Link
                  href={`/flows/${flow.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors pr-8",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <span className="flex-1 truncate">{flow.title}</span>
                  {outputCount > 0 && (
                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 shrink-0">
                      {outputCount}
                    </span>
                  )}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-sidebar-accent opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="right">
                    <DropdownMenuItem onClick={() => { setRenamingId(flow.id); setRenameValue(flow.title); }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleArchiveFlow(flow.id)}>
                      <Archive className="mr-2 h-3.5 w-3.5" />Archive
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFlow(flow.id)}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}

          {activeFlows.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No active flows</p>
          )}

          {/* Archive Toggle — always visible */}
          <button
            type="button"
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
          >
            <Archive className="h-3 w-3" />
            Archive{archivedFlows.length > 0 && ` (${archivedFlows.length})`}
            <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", showArchive && "rotate-180")} />
          </button>

          {showArchive && (
            archivedFlows.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-muted-foreground/50">No archived flows</p>
            ) : (
              archivedFlows.map((flow) => (
                <div key={flow.id} className="group relative">
                  <Link
                    href={`/flows/${flow.id}`}
                    className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pr-8"
                  >
                    <span className="truncate">{flow.title}</span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-sidebar-accent opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="right">
                      <DropdownMenuItem onClick={() => handleUnarchiveFlow(flow.id)}>
                        <Archive className="mr-2 h-3.5 w-3.5" />Unarchive
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFlow(flow.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Monitor */}
      <div className="px-3 pb-1">
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
      </div>

      {/* Settings */}
      <div className="border-t px-3 py-3 space-y-0.5">
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

      {/* Footer */}
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        flowboost v0.3.0
      </div>

      <CreateProjectWizard
        open={showCreateWizard}
        onOpenChange={setShowCreateWizard}
      />
    </aside>
  );
}
