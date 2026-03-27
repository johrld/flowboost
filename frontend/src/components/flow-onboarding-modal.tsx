"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FlowOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFlow: (title: string) => Promise<void>;
}

export function FlowOnboardingModal({ open, onOpenChange, onCreateFlow }: FlowOnboardingModalProps) {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      await onCreateFlow(title.trim());
      setTitle("");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create flow:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Flow</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Flow name</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleCreate(); }}
              placeholder="e.g. KFZ Werkstatt Azubi-Gewinnung"
              autoFocus
            />
          </div>

          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            Flows bundle your content around one topic. Add sources, create content pieces, and chat with AI — all in one place.
          </p>

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={!title.trim() || creating}
          >
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Flow
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
