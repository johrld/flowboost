"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  Check,
  RotateCcw,
  ChevronRight,
  ArrowLeft,
  FileText,
  MessageCircle,
  Mail,
  Video,
  Search,
  Image as ImageIcon,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import {
  getSkillCategories,
  getSkillsInCategory,
  getSkill,
  updateSkill,
  resetSkills,
} from "@/lib/api";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  social: <MessageCircle className="h-4 w-4" />,
  newsletter: <Mail className="h-4 w-4" />,
  article: <FileText className="h-4 w-4" />,
  research: <Search className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social Media",
  newsletter: "Newsletter",
  article: "Articles",
  research: "Research",
  image: "Image Generation",
};

type SaveStatus = "idle" | "saving" | "saved";

export default function SkillsPage() {
  const { customerId, projectId } = useProject();
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected skill
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillsInCategory, setSkillsInCategory] = useState<string[]>([]);
  const [skillContent, setSkillContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [resetting, setResetting] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const res = await getSkillCategories(customerId, projectId);
      setCategories(res.categories);
    } catch {
      // Skills directory may not exist yet
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleSelectCategory = async (category: string) => {
    if (!customerId || !projectId) return;
    setSelectedCategory(category);
    setSelectedSkill(null);
    try {
      const res = await getSkillsInCategory(customerId, projectId, category);
      setSkillsInCategory(res.skills.filter((s) => s !== "CATALOG"));
    } catch {
      setSkillsInCategory([]);
    }
  };

  const handleSelectSkill = async (name: string) => {
    if (!customerId || !projectId || !selectedCategory) return;
    setSelectedSkill(name);
    setSaveStatus("idle");
    try {
      const res = await getSkill(customerId, projectId, selectedCategory, name);
      setSkillContent(res.content);
    } catch {
      setSkillContent("");
    }
  };

  const handleSave = async () => {
    if (!customerId || !projectId || !selectedCategory || !selectedSkill) return;
    setSaveStatus("saving");
    try {
      await updateSkill(customerId, projectId, selectedCategory, selectedSkill, skillContent);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus("idle");
    }
  };

  const handleReset = async () => {
    if (!customerId || !projectId) return;
    setResetting(true);
    try {
      await resetSkills(customerId, projectId);
      await loadCategories();
      setSelectedCategory(null);
      setSelectedSkill(null);
    } catch (err) {
      console.error("Reset failed:", err);
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Skill editor view
  if (selectedCategory && selectedSkill) {
    return (
      <div className="p-8 space-y-4 max-w-4xl">
        <button
          type="button"
          onClick={() => setSelectedSkill(null)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {CATEGORY_LABELS[selectedCategory] ?? selectedCategory}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold capitalize">{selectedSkill.replace("-", " ")}</h1>
            <p className="text-muted-foreground text-sm">{selectedCategory}/{selectedSkill}.md</p>
          </div>
          <Button onClick={handleSave} disabled={saveStatus === "saving"}>
            {saveStatus === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saveStatus === "saved" && <Check className="mr-2 h-4 w-4" />}
            {saveStatus === "idle" && <Save className="mr-2 h-4 w-4" />}
            {saveStatus === "saved" ? "Saved" : "Save"}
          </Button>
        </div>
        <Textarea
          value={skillContent}
          onChange={(e) => { setSkillContent(e.target.value); setSaveStatus("idle"); }}
          className="min-h-[600px] font-mono text-sm"
          placeholder="# Skill Name\n\n## Rules\n..."
        />
      </div>
    );
  }

  // Category → skill list view
  if (selectedCategory) {
    return (
      <div className="p-8 space-y-4 max-w-3xl">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Categories
        </button>
        <h1 className="text-2xl font-bold">{CATEGORY_LABELS[selectedCategory] ?? selectedCategory} Skills</h1>
        <div className="space-y-2">
          {skillsInCategory.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleSelectSkill(name)}
              className="w-full flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left"
            >
              {CATEGORY_ICONS[selectedCategory] ?? <FileText className="h-4 w-4" />}
              <span className="text-sm font-medium capitalize flex-1">{name.replace("-", " ")}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          {skillsInCategory.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No skills in this category. Click &quot;Reset to Defaults&quot; to populate.</p>
          )}
        </div>
      </div>
    );
  }

  // Category list view
  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Skills</h1>
          <p className="text-muted-foreground">Configure AI agent behavior per format and platform</p>
        </div>
        <Button variant="outline" onClick={handleReset} disabled={resetting}>
          {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
          Reset to Defaults
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">No skills configured yet. Reset to load default skills.</p>
          <Button variant="outline" onClick={handleReset} disabled={resetting}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Load Default Skills
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleSelectCategory(cat)}
              className="w-full flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="rounded-full bg-muted p-2">
                {CATEGORY_ICONS[cat] ?? <FileText className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{CATEGORY_LABELS[cat] ?? cat}</p>
                <p className="text-xs text-muted-foreground capitalize">{cat} agent skills</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
