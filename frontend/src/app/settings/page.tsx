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
  getCustomers,
  getProjects,
  getProjectBrief,
  getBrandVoice,
  updateProject,
  updateProjectBrief,
  updateBrandVoice,
  updateAuthors,
  getGitHubRepos,
  getGitHubBranches,
} from "@/lib/api";
import type { Project, Customer, Author, Category, Competitor } from "@/lib/types";
import {
  Save,
  Plus,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Globe,
  X,
  Github,
  Unplug,
  CheckCircle2,
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

function displayRole(role: string | Record<string, string>): string {
  if (typeof role === "string") return role;
  return role.de ?? role.en ?? Object.values(role)[0] ?? "";
}

function SettingsPageContent() {
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

  // Authors tab state
  const [authors, setAuthors] = useState<Author[]>([]);
  const [authorsStatus, setAuthorsStatus] = useState<SaveStatus>("idle");

  // Categories tab state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesStatus, setCategoriesStatus] = useState<SaveStatus>("idle");

  // Competitors tab state
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorsStatus, setCompetitorsStatus] = useState<SaveStatus>("idle");

  // Connector tab state
  const [connectorType, setConnectorType] = useState("git");
  const [gitRepoUrl, setGitRepoUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [gitContentPath, setGitContentPath] = useState("");
  const [gitAssetsPath, setGitAssetsPath] = useState("");
  const [connectorStatus, setConnectorStatus] = useState<SaveStatus>("idle");

  // GitHub connector state
  const [ghInstallationId, setGhInstallationId] = useState<number | null>(null);
  const [ghOwner, setGhOwner] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghBranch, setGhBranch] = useState("");
  const [ghContentPath, setGhContentPath] = useState("src/content/posts");
  const [ghAssetsPath, setGhAssetsPath] = useState("src/assets/posts");
  const [ghRepos, setGhRepos] = useState<{ fullName: string; name: string; owner: string; defaultBranch: string; private: boolean }[]>([]);
  const [ghBranches, setGhBranches] = useState<string[]>([]);
  const [ghLoadingRepos, setGhLoadingRepos] = useState(false);
  const [ghLoadingBranches, setGhLoadingBranches] = useState(false);

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
    try {
      setLoading(true);
      setError(null);

      const customers = await getCustomers();
      if (customers.length === 0) {
        setError("No customers found");
        return;
      }
      const cust = customers[0];
      setCustomerId(cust.id);
      setCustomer(cust);
      setAuthors(cust.authors ?? []);

      const projects = await getProjects(cust.id);
      if (projects.length === 0) {
        setError("No projects found");
        return;
      }
      const proj = projects[0];
      setProject(proj);

      // Populate form state from project
      setProjectName(proj.name);
      setProjectDescription(proj.description ?? "");
      setLanguages(proj.languages ?? []);
      setArticlesPerWeek(proj.publishFrequency?.articlesPerWeek ?? 3);
      setCategories(proj.categories ?? []);
      setCompetitors(proj.competitors ?? []);
      setConnectorType(proj.connector?.type ?? "git");
      setGitRepoUrl(proj.connector?.git?.repoUrl ?? "");
      setGitBranch(proj.connector?.git?.branch ?? "");
      setGitContentPath(proj.connector?.git?.contentPath ?? "");
      setGitAssetsPath(proj.connector?.git?.assetsPath ?? "");

      // GitHub connector
      if (proj.connector?.github) {
        setGhInstallationId(proj.connector.github.installationId);
        setGhOwner(proj.connector.github.owner);
        setGhRepo(proj.connector.github.repo);
        setGhBranch(proj.connector.github.branch);
        setGhContentPath(proj.connector.github.contentPath);
        setGhAssetsPath(proj.connector.github.assetsPath);
      }

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

      // Handle GitHub callback: ?github=connected&installation_id=123
      // Must run AFTER project data is loaded to avoid being overwritten
      const params = new URLSearchParams(window.location.search);
      const ghStatus = params.get("github");
      const installId = params.get("installation_id");
      if (ghStatus === "connected" && installId) {
        const id = Number(installId);
        setGhInstallationId(id);
        setConnectorType("github");
        // Load repos for the new installation
        setGhLoadingRepos(true);
        try {
          const repos = await getGitHubRepos(id);
          setGhRepos(repos);
        } catch { /* ignore */ }
        setGhLoadingRepos(false);
        window.history.replaceState({}, "", "/settings?tab=connector");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const saveAuthors = () => withSave(setAuthorsStatus, async () => {
    await updateAuthors(customerId, authors);
  });

  const saveCategories = () => withSave(setCategoriesStatus, async () => {
    await updateProject(customerId, project!.id, { categories });
  });

  const saveCompetitors = () => withSave(setCompetitorsStatus, async () => {
    await updateProject(customerId, project!.id, { competitors });
  });

  const saveConnector = () => withSave(setConnectorStatus, async () => {
    if (connectorType === "github" && ghInstallationId) {
      await updateProject(customerId, project!.id, {
        connector: {
          type: "github",
          github: {
            installationId: ghInstallationId,
            owner: ghOwner,
            repo: ghRepo,
            branch: ghBranch,
            contentPath: ghContentPath,
            assetsPath: ghAssetsPath,
          },
        },
      });
    } else {
      await updateProject(customerId, project!.id, {
        connector: {
          type: connectorType as "git" | "filesystem" | "api",
          ...(connectorType === "git" && {
            git: { repoUrl: gitRepoUrl, branch: gitBranch, contentPath: gitContentPath, assetsPath: gitAssetsPath },
          }),
        },
      });
    }
  });

  const loadGhRepos = async (installationId: number) => {
    setGhLoadingRepos(true);
    try {
      const repos = await getGitHubRepos(installationId);
      setGhRepos(repos);
    } catch { /* ignore */ }
    setGhLoadingRepos(false);
  };

  const loadGhBranches = async (owner: string, repo: string) => {
    if (!ghInstallationId) return;
    setGhLoadingBranches(true);
    try {
      const branches = await getGitHubBranches(ghInstallationId, owner, repo);
      setGhBranches(branches);
    } catch { /* ignore */ }
    setGhLoadingBranches(false);
  };

  const selectGhRepo = (fullName: string) => {
    const repo = ghRepos.find((r) => r.fullName === fullName);
    if (repo) {
      setGhOwner(repo.owner);
      setGhRepo(repo.name);
      setGhBranch(repo.defaultBranch);
      loadGhBranches(repo.owner, repo.name);
    }
  };

  const disconnectGitHub = () => {
    setConnectorType("git");
    setGhInstallationId(null);
    setGhOwner("");
    setGhRepo("");
    setGhBranch("");
    setGhRepos([]);
    setGhBranches([]);
  };

  // Load repos when GitHub is already connected
  useEffect(() => {
    if (connectorType === "github" && ghInstallationId && ghRepos.length === 0) {
      loadGhRepos(ghInstallationId);
    }
  }, [connectorType, ghInstallationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load branches when repo is selected
  useEffect(() => {
    if (connectorType === "github" && ghInstallationId && ghOwner && ghRepo) {
      loadGhBranches(ghOwner, ghRepo);
    }
  }, [ghOwner, ghRepo, ghInstallationId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Author helpers
  const addAuthor = () => {
    const id = `author-${Date.now()}`;
    setAuthors([...authors, { id, name: "", role: "" }]);
  };

  const removeAuthor = (idx: number) => {
    setAuthors(authors.filter((_, i) => i !== idx));
  };

  const updateAuthorField = (idx: number, field: "id" | "name" | "role", value: string) => {
    setAuthors(authors.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };

  // Category helpers
  const addCategory = () => {
    setCategories([...categories, { id: `cat-${Date.now()}`, labels: { de: "", en: "" } }]);
  };

  const removeCategory = (idx: number) => {
    setCategories(categories.filter((_, i) => i !== idx));
  };

  const updateCategoryLabel = (idx: number, lang: string, value: string) => {
    setCategories(categories.map((c, i) =>
      i === idx ? { ...c, labels: { ...c.labels, [lang]: value } } : c
    ));
  };

  const updateCategoryId = (idx: number, value: string) => {
    setCategories(categories.map((c, i) =>
      i === idx ? { ...c, id: value } : c
    ));
  };

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
          <TabsTrigger value="connector">Connector</TabsTrigger>
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

        {/* Authors */}
        <TabsContent value="authors" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Authors</h3>
            <Button variant="outline" size="sm" onClick={addAuthor}>
              <Plus className="mr-2 h-3 w-3" />
              Add Author
            </Button>
          </div>
          {authors.map((author, idx) => (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">ID</Label>
                      <Input
                        value={author.id}
                        onChange={(e) => updateAuthorField(idx, "id", e.target.value)}
                        className="h-8 font-mono text-sm"
                        placeholder="johannes"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={author.name}
                        onChange={(e) => updateAuthorField(idx, "name", e.target.value)}
                        className="h-8"
                        placeholder="Johannes Herold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Role</Label>
                      <Input
                        value={displayRole(author.role)}
                        onChange={(e) => updateAuthorField(idx, "role", e.target.value)}
                        className="h-8"
                        placeholder="Founder & Developer"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="mt-5" onClick={() => removeAuthor(idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {authors.length > 0 && (
            <SaveButton status={authorsStatus} onClick={saveAuthors} />
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

        {/* Categories */}
        <TabsContent value="categories" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Categories</h3>
            <Button variant="outline" size="sm" onClick={addCategory}>
              <Plus className="mr-2 h-3 w-3" />
              Add Category
            </Button>
          </div>
          {categories.map((cat, idx) => (
            <Card key={idx}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1 mr-4">
                    <Label className="text-xs text-muted-foreground">ID</Label>
                    <Input
                      value={cat.id}
                      onChange={(e) => updateCategoryId(idx, e.target.value)}
                      className="h-8 font-mono text-sm"
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeCategory(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(cat.labels).map((lang) => (
                    <div key={lang} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{lang.toUpperCase()}</Label>
                      <Input
                        value={cat.labels[lang]}
                        onChange={(e) => updateCategoryLabel(idx, lang, e.target.value)}
                        className="h-8"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <SaveButton status={categoriesStatus} onClick={saveCategories} />
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

        {/* Connector */}
        <TabsContent value="connector" className="mt-6 space-y-6">
          {/* GitHub Connected */}
          {connectorType === "github" && ghInstallationId ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <CardTitle>GitHub Connected</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" onClick={disconnectGitHub}>
                    <Unplug className="mr-2 h-3 w-3" />
                    Disconnect
                  </Button>
                </div>
                <CardDescription>
                  Content is delivered and read via your GitHub repository
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Repository</Label>
                  {ghLoadingRepos ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading repositories...
                    </div>
                  ) : (
                    <Select
                      value={ghOwner && ghRepo ? `${ghOwner}/${ghRepo}` : ""}
                      onValueChange={selectGhRepo}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select repository..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ghRepos.map((r) => (
                          <SelectItem key={r.fullName} value={r.fullName}>
                            {r.fullName}{r.private ? " (private)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {ghOwner && ghRepo && (
                  <>
                    <div className="space-y-2">
                      <Label>Branch</Label>
                      {ghLoadingBranches ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading branches...
                        </div>
                      ) : (
                        <Select value={ghBranch} onValueChange={setGhBranch}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select branch..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ghBranches.map((b) => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Content Path</Label>
                      <Input
                        value={ghContentPath}
                        onChange={(e) => setGhContentPath(e.target.value)}
                        placeholder="src/content/posts"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Assets Path</Label>
                      <Input
                        value={ghAssetsPath}
                        onChange={(e) => setGhAssetsPath(e.target.value)}
                        placeholder="src/assets/posts"
                      />
                    </div>
                  </>
                )}

                <SaveButton status={connectorStatus} onClick={saveConnector} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Publishing Connector</CardTitle>
                <CardDescription>
                  Connect your GitHub repository to enable automatic content delivery and reading
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6100"}/auth/github/install`;
                  }}
                >
                  <Github className="mr-2 h-4 w-4" />
                  Connect GitHub
                </Button>
              </CardContent>
            </Card>
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
