"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Inbox,
  Plus,
  Loader2,
  Trash2,
  MoreHorizontal,
  Tag,
  Archive,
  Check,
} from "lucide-react";
import { useProject } from "@/lib/project-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6100";

const LABELS = [
  { key: "article", label: "Article", color: "bg-blue-100 text-blue-700" },
  { key: "linkedin", label: "LinkedIn", color: "bg-sky-100 text-sky-700" },
  { key: "instagram", label: "Instagram", color: "bg-pink-100 text-pink-700" },
  { key: "x", label: "X", color: "bg-gray-100 text-gray-700" },
  { key: "tiktok", label: "TikTok", color: "bg-purple-100 text-purple-700" },
  { key: "newsletter", label: "Newsletter", color: "bg-amber-100 text-amber-700" },
];

interface Idea {
  id: string;
  title: string;
  description?: string;
  labels: string[];
  status: string;
  createdAt: string;
}

export default function InboxPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);

  const loadIdeas = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const res = await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/ideas`);
      if (res.ok) setIdeas(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [customerId, projectId]);

  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  const addIdea = async () => {
    if (!customerId || !projectId || !newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), description: newDescription.trim() || undefined }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDescription("");
        loadIdeas();
      }
    } catch { /* ignore */ }
    finally { setAdding(false); }
  };

  const toggleLabel = async (ideaId: string, label: string) => {
    if (!customerId || !projectId) return;
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return;
    const labels = idea.labels.includes(label)
      ? idea.labels.filter((l) => l !== label)
      : [...idea.labels, label];
    await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/ideas/${ideaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels }),
    });
    loadIdeas();
  };

  const archiveIdea = async (ideaId: string) => {
    if (!customerId || !projectId) return;
    await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/ideas/${ideaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    loadIdeas();
  };

  const deleteIdea = async (ideaId: string) => {
    if (!customerId || !projectId) return;
    await fetch(`${API_URL}/customers/${customerId}/projects/${projectId}/ideas/${ideaId}`, {
      method: "DELETE",
    });
    loadIdeas();
  };

  if (projectLoading || loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const inboxIdeas = ideas.filter((i) => i.status === "inbox");
  const archivedIdeas = ideas.filter((i) => i.status === "archived");

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Inbox className="h-6 w-6" />Inbox</h1>
        <p className="text-sm text-muted-foreground">Collect ideas, links, notes — the CMO can use these for content planning.</p>
      </div>

      {/* Add Idea */}
      <div className="rounded-xl border bg-background shadow-sm p-4 space-y-3">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addIdea(); }}
          placeholder="Add an idea..."
          className="border-0 shadow-none text-sm px-0 focus-visible:ring-0"
        />
        {newTitle.trim() && (
          <>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="border-0 shadow-none text-xs px-0 focus-visible:ring-0 text-muted-foreground"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={addIdea} disabled={adding || !newTitle.trim()}>
                {adding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                Add
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Ideas List */}
      {inboxIdeas.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Inbox is empty</p>
          <p className="text-xs text-muted-foreground">Add ideas, links, or notes for future content.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-background shadow-sm divide-y">
          {inboxIdeas.map((idea) => (
            <div key={idea.id} className="flex items-start gap-3 px-4 py-3 group">
              <button
                type="button"
                onClick={() => archiveIdea(idea.id)}
                className="mt-1 shrink-0 h-5 w-5 rounded-full border-2 border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-colors"
                title="Mark as done"
              >
                <Check className="h-3 w-3 text-transparent group-hover:text-emerald-500" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{idea.title}</p>
                {idea.description && <p className="text-xs text-muted-foreground mt-0.5">{idea.description}</p>}
                {idea.labels.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {idea.labels.map((l) => {
                      const label = LABELS.find((lb) => lb.key === l);
                      return label ? (
                        <Badge key={l} variant="secondary" className={`text-[10px] ${label.color}`}>{label.label}</Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded-md hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {LABELS.map((l) => (
                    <DropdownMenuItem key={l.key} onClick={() => toggleLabel(idea.id, l.key)}>
                      <Tag className="mr-2 h-3.5 w-3.5" />
                      {l.label}
                      {idea.labels.includes(l.key) && <Check className="ml-auto h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={() => archiveIdea(idea.id)}>
                    <Archive className="mr-2 h-3.5 w-3.5" />Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => deleteIdea(idea.id)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Archived */}
      {archivedIdeas.length > 0 && (
        <div className="text-xs text-muted-foreground pt-4">
          {archivedIdeas.length} archived idea{archivedIdeas.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
