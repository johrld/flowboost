"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus,
  ChevronRight,
  Clock,
  Mic,
  Image as ImageIcon,
  Link as LinkIcon,
  FileEdit,
  FileText,
  Loader2,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { getTopics, createTopic } from "@/lib/api";
import type { Topic, BriefingInput } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  proposed: "secondary",
  approved: "default",
  in_production: "default",
  produced: "outline",
  rejected: "outline",
};

function InputCountBadge({ inputs }: { inputs?: BriefingInput[] }) {
  if (!inputs || inputs.length === 0) return null;
  const types = inputs.map((i) => i.type);
  const icons: React.ReactNode[] = [];
  if (types.includes("transcript")) icons.push(<Mic key="mic" className="h-3 w-3" />);
  if (types.includes("text")) icons.push(<FileEdit key="text" className="h-3 w-3" />);
  if (types.includes("image")) icons.push(<ImageIcon key="img" className="h-3 w-3" />);
  if (types.includes("url")) icons.push(<LinkIcon key="url" className="h-3 w-3" />);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {icons} {inputs.length} input{inputs.length !== 1 ? "s" : ""}
    </span>
  );
}

export default function BriefingsPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();
  const router = useRouter();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const t = await getTopics(customerId, projectId);
      setTopics(t);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !customerId || !projectId) return;
    setCreating(true);
    try {
      const topic = await createTopic(customerId, projectId, {
        title: newTitle.trim(),
        userNotes: newNotes.trim() || undefined,
      });
      setShowNewDialog(false);
      setNewTitle("");
      setNewNotes("");
      router.push(`/briefings/${topic.id}`);
    } catch (err) {
      console.error("Failed to create briefing:", err);
    } finally {
      setCreating(false);
    }
  };

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Briefings</h1>
          <p className="text-muted-foreground">Your content topics and their outputs</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Briefing
        </Button>
      </div>

      {topics.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No briefings yet. Create one to start planning content.</p>
          <Button variant="outline" onClick={() => setShowNewDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Briefing
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/briefings/${topic.id}`}
              className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{topic.title}</h3>
                    <Badge variant={STATUS_VARIANT[topic.status] ?? "secondary"} className="text-xs capitalize">
                      {topic.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {topic.outputIds && topic.outputIds.length > 0 && (
                      <>
                        <span>{topic.outputIds.length} output{topic.outputIds.length !== 1 ? "s" : ""}</span>
                        <span>·</span>
                      </>
                    )}
                    <InputCountBadge inputs={topic.inputs} />
                    {topic.createdAt && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true })}
                        </span>
                      </>
                    )}
                  </div>
                  {topic.suggestedAngle && (
                    <p className="text-xs text-muted-foreground truncate">{topic.suggestedAngle}</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Briefing Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Briefing</DialogTitle>
            <DialogDescription>Start a new content topic. Add inputs and generate outputs later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="briefing-title">Title</Label>
              <Input
                id="briefing-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim() && !creating) handleCreate(); }}
                placeholder="e.g. Atemtechniken für Anfänger"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="briefing-notes">Notes (optional)</Label>
              <Textarea
                id="briefing-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Any context, angle, or audience you have in mind..."
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <Button disabled={!newTitle.trim() || creating} onClick={handleCreate}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Briefing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
