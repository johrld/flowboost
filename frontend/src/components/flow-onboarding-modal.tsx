"use client";

import { useState, useEffect } from "react";
import { Loader2, FileText, Linkedin, Instagram, Twitter, Video, Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProject } from "@/lib/project-context";
import { getContentTypes, type ContentTypeDefinition } from "@/lib/api";

const ICONS: Record<string, React.ReactNode> = {
  "blog-post": <FileText className="h-4 w-4" />,
  "linkedin-post": <Linkedin className="h-4 w-4" />,
  "instagram-post": <Instagram className="h-4 w-4" />,
  "x-post": <Twitter className="h-4 w-4" />,
  "tiktok-post": <Video className="h-4 w-4" />,
  "newsletter": <Mail className="h-4 w-4" />,
};

const COLORS: Record<string, string> = {
  site: "bg-blue-50 text-blue-600 dark:bg-blue-950",
  social: "bg-pink-50 text-pink-600 dark:bg-pink-950",
  email: "bg-amber-50 text-amber-600 dark:bg-amber-950",
};

interface FlowOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFlow: (title: string, contentTypeIds: string[]) => Promise<void>;
}

export function FlowOnboardingModal({ open, onOpenChange, onCreateFlow }: FlowOnboardingModalProps) {
  const { customerId, projectId } = useProject();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contentTypes, setContentTypes] = useState<ContentTypeDefinition[]>([]);

  // Load content types when modal opens
  useEffect(() => {
    if (!open || !customerId || !projectId) return;
    getContentTypes(customerId, projectId).then(setContentTypes).catch(() => {});
  }, [open, customerId, projectId]);

  const toggleType = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      // Auto-generate title if empty
      const flowTitle = title.trim() || (
        selected.size === 1
          ? contentTypes.find((ct) => ct.id === [...selected][0])?.label ?? "New Flow"
          : selected.size > 1
          ? `Campaign — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : "New Flow"
      );
      await onCreateFlow(flowTitle, [...selected]);
      setTitle("");
      setSelected(new Set());
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create flow:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTitle("");
      setSelected(new Set());
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What do you want to create?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Content Type Multi-Select */}
          <div className="grid grid-cols-2 gap-2">
            {contentTypes.map((ct) => {
              const isSelected = selected.has(ct.id);
              return (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => toggleType(ct.id)}
                  className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${COLORS[ct.category] ?? "bg-muted text-muted-foreground"}`}>
                    {ICONS[ct.id] ?? <FileText className="h-4 w-4" />}
                  </div>
                  <span className="text-sm font-medium flex-1">{ct.label}</span>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Flow name (optional for single, shown for multi) */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              {selected.size > 1 ? "Campaign name" : "Flow name (optional)"}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder={
                selected.size > 1
                  ? "e.g. Summer Campaign"
                  : selected.size === 1
                  ? contentTypes.find((ct) => ct.id === [...selected][0])?.label ?? "Flow name"
                  : "e.g. Quick LinkedIn Post"
              }
            />
          </div>

          {/* Hint text */}
          <p className="text-xs text-muted-foreground">
            {selected.size === 0
              ? "Select what you want to create, or just enter a name to start empty."
              : selected.size === 1
              ? "A flow will be created and you'll go straight to the editor."
              : `A campaign with ${selected.size} content pieces will be created.`}
          </p>

          {/* Create button */}
          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selected.size === 0
              ? "Create Empty Flow"
              : selected.size === 1
              ? `Create ${contentTypes.find((ct) => ct.id === [...selected][0])?.label ?? "Content"}`
              : `Create Campaign (${selected.size} pieces)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
