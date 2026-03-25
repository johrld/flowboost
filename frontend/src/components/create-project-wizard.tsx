"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/lib/project-context";
import { createProject } from "@/lib/api";
import { Loader2, Rocket } from "lucide-react";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" },
  { code: "nl", name: "Nederlands" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
];

interface CreateProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullscreen?: boolean;
}

export function CreateProjectWizard({
  open,
  onOpenChange,
  fullscreen = false,
}: CreateProjectWizardProps) {
  const { customerId, refreshProjects, setActiveProject } = useProject();

  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("en");

  const reset = () => {
    setName("");
    setDescription("");
    setDefaultLanguage("en");
    setSubmitting(false);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleCreate = async () => {
    if (!customerId || !name.trim()) return;
    setSubmitting(true);

    try {
      const lang = LANGUAGES.find((l) => l.code === defaultLanguage);
      const project = await createProject(customerId, {
        name: name.trim(),
        description: description.trim() || undefined,
        defaultLanguage,
        languages: [{ code: defaultLanguage, name: lang?.name ?? defaultLanguage, enabled: true }],
      });

      await refreshProjects();
      setActiveProject(project);
      handleOpenChange(false);
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const canCreate = name.trim().length > 0;

  const form = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project-name">Project Name</Label>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canCreate && !submitting) handleCreate(); }}
          placeholder="e.g. My Blog, Company Website"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-desc">Description (optional)</Label>
        <Textarea
          id="project-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this project about?"
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-lang">Default Language</Label>
        <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
          <SelectTrigger id="project-lang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Languages, categories, and connectors can be configured in project settings.
        </p>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleCreate} disabled={!canCreate || submitting}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="mr-2 h-4 w-4" />
          )}
          Create Project
        </Button>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Welcome to FlowBoost</h1>
            <p className="text-muted-foreground">Set up your first project to get started.</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            {form}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a new content project.</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
