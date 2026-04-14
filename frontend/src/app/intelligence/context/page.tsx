"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Save, Loader2, Check } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { getProjectBrief, getBrandVoice, updateProjectBrief, updateBrandVoice } from "@/lib/api";

type SaveStatus = "idle" | "saving" | "saved";

export default function AIContextPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();
  const [projectBrief, setProjectBrief] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [briefStatus, setBriefStatus] = useState<SaveStatus>("idle");
  const [voiceStatus, setVoiceStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const [brief, voice] = await Promise.all([
        getProjectBrief(customerId, projectId),
        getBrandVoice(customerId),
      ]);
      setProjectBrief(brief.content ?? "");
      setBrandVoice(voice.content ?? "");
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [customerId, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveBrief = async () => {
    if (!customerId || !projectId) return;
    setBriefStatus("saving");
    try {
      await updateProjectBrief(customerId, projectId, projectBrief);
      setBriefStatus("saved");
      setTimeout(() => setBriefStatus("idle"), 2000);
    } catch { setBriefStatus("idle"); }
  };

  const saveVoice = async () => {
    if (!customerId || !projectId) return;
    setVoiceStatus("saving");
    try {
      await updateBrandVoice(customerId, brandVoice);
      setVoiceStatus("saved");
      setTimeout(() => setVoiceStatus("idle"), 2000);
    } catch { setVoiceStatus("idle"); }
  };

  if (projectLoading || loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" />AI Context</h1>
        <p className="text-sm text-muted-foreground">Project brief and brand voice — gives AI agents the full picture of your project.</p>
      </div>

      {/* Project Brief */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Project Brief</h2>
          <p className="text-xs text-muted-foreground">Business context, target audience, USPs, goals</p>
        </div>
        <Textarea
          className="min-h-[250px] font-mono text-sm"
          placeholder={"# Project Brief\n\n## About the Business\nWhat does the business do?\n\n## Target Audience\nWho are we writing for?\n\n## Goals\nWhat should the content achieve?"}
          value={projectBrief}
          onChange={(e) => setProjectBrief(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={saveBrief} disabled={briefStatus === "saving"}>
          {briefStatus === "saving" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : briefStatus === "saved" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          {briefStatus === "saved" ? "Saved" : "Save Brief"}
        </Button>
      </div>

      {/* Brand Voice */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Brand Voice</h2>
          <p className="text-xs text-muted-foreground">Tone, forbidden terms, writing style — controls how AI agents write</p>
        </div>
        <Textarea
          className="min-h-[250px] font-mono text-sm"
          placeholder={"# Brand Voice\n\n## Tone\n- Warm, supportive, knowledgeable\n\n## Forbidden Terms\n- ...\n\n## Writing Style\n- Short paragraphs, active voice"}
          value={brandVoice}
          onChange={(e) => setBrandVoice(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={saveVoice} disabled={voiceStatus === "saving"}>
          {voiceStatus === "saving" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : voiceStatus === "saved" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          {voiceStatus === "saved" ? "Saved" : "Save Brand Voice"}
        </Button>
      </div>
    </div>
  );
}
