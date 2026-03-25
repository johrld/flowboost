"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCustomer,
  getCustomers,
  getProject,
  getProjects,
  getProjectBrief,
  getBrandVoice,
  updateProject,
  updateProjectBrief,
  updateBrandVoice,
  syncConnectorData,
} from "@/lib/api";
import { useProject } from "@/lib/project-context";
import type { Project, Customer, Competitor } from "@/lib/types";
import {
  Save,
  Plus,
  Loader2,
  Check,
  AlertCircle,
  Globe,
  RefreshCw,
  Cable,
  X,
} from "lucide-react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveButton({ status, onClick }: { status: SaveStatus; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={status === "saving"}>
      {status === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {status === "saved" && <Check className="mr-2 h-4 w-4" />}
      {status === "error" && <AlertCircle className="mr-2 h-4 w-4" />}
      {status === "idle" && <Save className="mr-2 h-4 w-4" />}
      {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : status === "error" ? "Error — Retry" : "Save"}
    </Button>
  );
}

function SettingsPageContent() {
  const { customerId: ctxCustomerId, project: ctxProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [brandVoiceContent, setBrandVoiceContent] = useState("");
  const [projectBriefContent, setProjectBriefContent] = useState("");

  // General tab state
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [languages, setLanguages] = useState<{ code: string; name: string; enabled: boolean }[]>([]);
  const [articlesPerWeek, setArticlesPerWeek] = useState(3);
  const [generalStatus, setGeneralStatus] = useState<SaveStatus>("idle");

  // Connector sync state (read-only categories + authors from repo)
  interface RemoteCategory { id: string; name: Record<string, string>; slug?: Record<string, string>; description?: Record<string, string>; order?: number }
  interface RemoteAuthor { id: string; name: string; slug?: string; title?: Record<string, string>; bio?: Record<string, string>; image?: string }
  const [remoteCategories, setRemoteCategories] = useState<RemoteCategory[]>([]);
  const [remoteAuthors, setRemoteAuthors] = useState<RemoteAuthor[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Competitors tab state
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorsStatus, setCompetitorsStatus] = useState<SaveStatus>("idle");

  const searchParams = useSearchParams();

  // Pipeline tab state
  const [defaultModel, setDefaultModel] = useState("sonnet");
  const [maxRetries, setMaxRetries] = useState(3);
  const [maxBudget, setMaxBudget] = useState(5);
  const [imagenModel, setImagenModel] = useState("imagen-4-fast");
  const [pipelineStatus, setPipelineStatus] = useState<SaveStatus>("idle");

  // Brand Voice tab state
  const [brandVoiceStatus, setBrandVoiceStatus] = useState<SaveStatus>("idle");

  // Project Brief tab state
  const [projectBriefStatus, setProjectBriefStatus] = useState<SaveStatus>("idle");

  const loadData = useCallback(async () => {
    if (!ctxCustomerId || !ctxProject) return;
    try {
      setLoading(true);
      setError(null);

      const cust = await getCustomer(ctxCustomerId);
      setCustomerId(cust.id);
      setCustomer(cust);

      const proj = await getProject(ctxCustomerId, ctxProject.id);
      setProject(proj);

      // Populate form state from project
      setProjectName(proj.name);
      setProjectDescription(proj.description ?? "");
      setLanguages(proj.languages ?? []);
      setArticlesPerWeek(proj.publishFrequency?.articlesPerWeek ?? 3);
      setCompetitors(proj.competitors ?? []);

      // Populate pipeline settings
      setDefaultModel(proj.pipeline?.defaultModel ?? "sonnet");
      setMaxRetries(proj.pipeline?.maxRetriesPerPhase ?? 3);
      setMaxBudget(proj.pipeline?.maxBudgetPerArticle ?? 5);
      setImagenModel(proj.pipeline?.imagenModel ?? "imagen-4-fast");

      // Load text files in parallel
      const [bv, pb] = await Promise.all([
        getBrandVoice(cust.id).catch(() => ({ content: "" })),
        getProjectBrief(cust.id, proj.id).catch(() => ({ content: "" })),
      ]);
      setBrandVoiceContent(bv.content);
      setProjectBriefContent(pb.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [ctxCustomerId, ctxProject]);

  useEffect(() => { loadData(); }, [loadData]);

  // Save helpers
  async function withSave(setStatus: (s: SaveStatus) => void, fn: () => Promise<void>) {
    setStatus("saving");
    try {
      await fn();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  const saveGeneral = () => withSave(setGeneralStatus, async () => {
    await updateProject(customerId, project!.id, {
      name: projectName,
      description: projectDescription,
      languages,
      publishFrequency: { articlesPerWeek, preferredDays: project!.publishFrequency?.preferredDays ?? [] },
    });
  });

  // Language helpers
  const availableLanguages = [
    { code: "de", name: "Deutsch" },
    { code: "en", name: "English" },
    { code: "es", name: "Espanol" },
    { code: "fr", name: "Francais" },
    { code: "it", name: "Italiano" },
    { code: "pt", name: "Portugues" },
    { code: "nl", name: "Nederlands" },
    { code: "pl", name: "Polski" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "zh", name: "Chinese" },
  ].filter((l) => !languages.some((el) => el.code === l.code));

  const addLanguage = (code: string) => {
    const lang = availableLanguages.find((l) => l.code === code);
    if (lang) {
      setLanguages([...languages, { ...lang, enabled: true }]);
    }
  };

  const removeLanguage = (code: string) => {
    setLanguages(languages.filter((l) => l.code !== code));
  };

  const saveCompetitors = () => withSave(setCompetitorsStatus, async () => {
    await updateProject(customerId, project!.id, { competitors });
  });

  const savePipeline = () => withSave(setPipelineStatus, async () => {
    await updateProject(customerId, project!.id, {
      pipeline: {
        defaultModel,
        maxRetriesPerPhase: maxRetries,
        maxBudgetPerArticle: maxBudget,
        imagenModel,
      },
    });
  });

  const saveBrandVoice = () => withSave(setBrandVoiceStatus, async () => {
    await updateBrandVoice(customerId, brandVoiceContent);
  });

  const saveProjectBrief = () => withSave(setProjectBriefStatus, async () => {
    await updateProjectBrief(customerId, project!.id, projectBriefContent);
  });

  // Centralized connector sync (categories + authors from repo)
  const syncFromConnector = useCallback(async () => {
    if (!customerId || !project?.connector?.github) return;
    setSyncing(true);
    try {
      const result = await syncConnectorData(customerId, project.id);
      if (result.categories) setRemoteCategories(result.categories as RemoteCategory[]);
      if (result.authors) setRemoteAuthors(result.authors as RemoteAuthor[]);
      setLastSync(new Date());
      if (result.errors.length > 0) {
        console.error("Sync errors:", result.errors);
      }
    } catch (err) {
      console.error("Failed to sync from connector:", err);
    }
    setSyncing(false);
  }, [customerId, project]);

  // Auto-sync categories + authors from connector after project loads
  useEffect(() => {
    if (!loading && project?.connector?.github && !lastSync) {
      syncFromConnector();
    }
  }, [loading, project, lastSync, syncFromConnector]);

  // Competitor helpers
  const addCompetitor = () => {
    setCompetitors([...competitors, { domain: "", name: "", notes: "" }]);
  };

  const removeCompetitor = (idx: number) => {
    setCompetitors(competitors.filter((_, i) => i !== idx));
  };

  const updateCompetitor = (idx: number, field: keyof Competitor, value: string) => {
    setCompetitors(competitors.map((c, i) =>
      i === idx ? { ...c, [field]: value } : c
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">Make sure the backend is running on port 6100</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Project configuration</p>
      </div>

      <Tabs defaultValue={searchParams.get("tab") ?? "general"}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="brief">Project Brief</TabsTrigger>
          <TabsTrigger value="authors">Authors</TabsTrigger>
          <TabsTrigger value="brand">Brand Voice</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project</CardTitle>
              <CardDescription>Basic project settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Languages</Label>
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => (
                    <Badge key={lang.code} variant="secondary" className="gap-1">
                      <Globe className="h-3 w-3" />
                      {lang.code.toUpperCase()} — {lang.name}
                      <button
                        type="button"
                        onClick={() => removeLanguage(lang.code)}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {availableLanguages.length > 0 && (
                    <Select onValueChange={addLanguage}>
                      <SelectTrigger className="w-40 h-7 text-xs">
                        <SelectValue placeholder="Add language..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLanguages.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.code.toUpperCase()} — {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Publishing Frequency</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={14}
                    value={articlesPerWeek}
                    onChange={(e) => setArticlesPerWeek(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">articles per week</span>
                </div>
              </div>

              <SaveButton status={generalStatus} onClick={saveGeneral} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Project Brief */}
        <TabsContent value="brief" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Brief</CardTitle>
              <CardDescription>
                Business context, target audience, USPs, goals — gives AI agents the full picture
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="min-h-[500px] font-mono text-sm"
                placeholder={`# Project Brief\n\n## About the Business\nWhat does the business do?\n\n## Target Audience\nWho are we writing for?\n\n## Unique Selling Points\n- USP 1\n- USP 2\n\n## Goals\nWhat should the content achieve?\n\n## Competitors & Positioning\nHow do we differentiate?`}
                value={projectBriefContent}
                onChange={(e) => setProjectBriefContent(e.target.value)}
              />
              <SaveButton status={projectBriefStatus} onClick={saveProjectBrief} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authors (read-only, synced from connector) */}
        <TabsContent value="authors" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Authors</h3>
              <p className="text-sm text-muted-foreground">
                Synced from your connected repository
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastSync && (
                <span className="text-xs text-muted-foreground">
                  Last synced: {lastSync.toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={syncFromConnector}
                disabled={syncing || !project?.connector?.github}
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3 w-3" />
                )}
                Sync
              </Button>
            </div>
          </div>

          {remoteAuthors.length > 0 ? (
            <div className="rounded-lg border divide-y">
              {remoteAuthors.map((author) => (
                <div key={author.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{author.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {author.title?.de || author.title?.en || ""}{author.title?.de || author.title?.en ? " · " : ""}<span className="font-mono">{author.id}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border p-8 text-center">
              {!project?.connector?.github ? (
                <>
                  <Cable className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Connect a Git repository to sync authors</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">No authors synced yet</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={syncFromConnector}>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Sync Now
                  </Button>
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* Brand Voice */}
        <TabsContent value="brand" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Voice Guidelines</CardTitle>
              <CardDescription>
                Define your brand tone, forbidden terms, and writing style
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="min-h-[400px] font-mono text-sm"
                placeholder="# Brand Voice&#10;&#10;## Tone&#10;- Warm, supportive, knowledgeable&#10;&#10;## Forbidden Terms&#10;- ...&#10;&#10;## Writing Style&#10;- Short paragraphs..."
                value={brandVoiceContent}
                onChange={(e) => setBrandVoiceContent(e.target.value)}
              />
              <SaveButton status={brandVoiceStatus} onClick={saveBrandVoice} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories (read-only, synced from connector) */}
        <TabsContent value="categories" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Categories</h3>
              <p className="text-sm text-muted-foreground">
                Synced from your connected repository
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastSync && (
                <span className="text-xs text-muted-foreground">
                  Last synced: {lastSync.toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={syncFromConnector}
                disabled={syncing || !project?.connector?.github}
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3 w-3" />
                )}
                Sync
              </Button>
            </div>
          </div>

          {remoteCategories.length > 0 ? (
            <div className="rounded-lg border divide-y">
              {remoteCategories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat.name.de || cat.name.en || cat.id}</p>
                    <p className="text-xs text-muted-foreground font-mono">{cat.id}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border p-8 text-center">
              {!project?.connector?.github ? (
                <>
                  <Cable className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Connect a Git repository to sync categories</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">No categories synced yet</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={syncFromConnector}>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Sync Now
                  </Button>
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* Competitors */}
        <TabsContent value="competitors" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Competitors</h3>
              <p className="text-sm text-muted-foreground">
                Used by the strategy agent for competitive analysis
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={addCompetitor}>
              <Plus className="mr-2 h-3 w-3" />
              Add Competitor
            </Button>
          </div>
          {competitors.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No competitors configured yet</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={addCompetitor}>
                <Plus className="mr-2 h-3 w-3" />
                Add First Competitor
              </Button>
            </div>
          )}
          {competitors.map((comp, idx) => (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Domain</Label>
                      <Input
                        value={comp.domain}
                        onChange={(e) => updateCompetitor(idx, "domain", e.target.value)}
                        placeholder="headspace.com"
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={comp.name}
                        onChange={(e) => updateCompetitor(idx, "name", e.target.value)}
                        placeholder="Headspace"
                        className="h-8"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <Input
                        value={comp.notes ?? ""}
                        onChange={(e) => updateCompetitor(idx, "notes", e.target.value)}
                        placeholder="Market leader, strong blog presence"
                        className="h-8"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="mt-5" onClick={() => removeCompetitor(idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {competitors.length > 0 && (
            <SaveButton status={competitorsStatus} onClick={saveCompetitors} />
          )}
        </TabsContent>

        {/* Pipeline */}
        <TabsContent value="pipeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Settings</CardTitle>
              <CardDescription>
                Configure AI model, budget limits, and retry behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Model</Label>
                <Select value={defaultModel} onValueChange={setDefaultModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sonnet">Claude Sonnet</SelectItem>
                    <SelectItem value="opus">Claude Opus</SelectItem>
                    <SelectItem value="haiku">Claude Haiku</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Model used for content generation agents</p>
              </div>

              <div className="space-y-2">
                <Label>Max Budget per Article (USD)</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(Number(e.target.value))}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">Pipeline stops if cost exceeds this limit</p>
              </div>

              <div className="space-y-2">
                <Label>Max Retries per Phase</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Number(e.target.value))}
                  className="w-32"
                />
              </div>

              <div className="space-y-2">
                <Label>Image Generation Model</Label>
                <Select value={imagenModel} onValueChange={setImagenModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imagen-4-fast">Imagen 4 Fast</SelectItem>
                    <SelectItem value="imagen-4">Imagen 4</SelectItem>
                    <SelectItem value="imagen-3">Imagen 3</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Google AI model for hero image generation</p>
              </div>

              <SaveButton status={pipelineStatus} onClick={savePipeline} />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
