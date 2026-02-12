"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useProject } from "@/lib/project-context";
import {
  updateProject,
  getGitHubRepos,
  getGitHubBranches,
} from "@/lib/api";
import type { LucideIcon } from "lucide-react";
import {
  Save,
  Loader2,
  Check,
  AlertCircle,
  Github,
  GitBranch,
  ChevronLeft,
  Info,
  Globe,
  Linkedin,
  Instagram,
  Music2,
  Video,
  ShoppingBag,
  Aperture,
  Radio,
  Cable,
  Settings,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";
type ConnectorCategory = "site" | "social" | "media";
type Framework = "astro" | "hugo" | "nextjs" | "custom";

interface ConnectorDef {
  id: string;
  name: string;
  category: ConnectorCategory;
  icon: LucideIcon;
  description: string;
  comingSoon: boolean;
}

interface FrameworkDef {
  id: Framework;
  name: string;
  contentPath: string;
  assetsPath: string;
  categoriesPath: string;
  authorsPath: string;
  hint: string;
  comingSoon: boolean;
}

const FRAMEWORKS: FrameworkDef[] = [
  { id: "astro", name: "Astro", contentPath: "src/content/posts", assetsPath: "src/assets/posts", categoriesPath: "src/data/categories.json", authorsPath: "src/data/authors.json", hint: "Requires Content Collections configured to match FlowBoost's frontmatter schema.", comingSoon: false },
  { id: "hugo", name: "Hugo", contentPath: "content/posts", assetsPath: "static/images", categoriesPath: "", authorsPath: "", hint: "Content must use Hugo's front matter format. Archetypes should match FlowBoost output.", comingSoon: true },
  { id: "nextjs", name: "Next.js", contentPath: "posts", assetsPath: "public/images", categoriesPath: "", authorsPath: "", hint: "MDX files with compatible frontmatter. Requires a content layer (e.g. Contentlayer, Velite).", comingSoon: true },
  { id: "custom", name: "Custom", contentPath: "", assetsPath: "", categoriesPath: "", authorsPath: "", hint: "Manually configure paths and ensure your project can process FlowBoost's markdown output.", comingSoon: true },
];

const CONNECTORS: ConnectorDef[] = [
  { id: "git", name: "Git Repository", category: "site", icon: GitBranch, description: "Push content to a Git repository", comingSoon: false },
  { id: "wordpress", name: "WordPress", category: "site", icon: Globe, description: "Publish directly via WordPress API", comingSoon: true },
  { id: "shopify", name: "Shopify", category: "site", icon: ShoppingBag, description: "Publish to Shopify blog", comingSoon: true },
  { id: "webflow", name: "Webflow", category: "site", icon: Aperture, description: "Publish to Webflow CMS", comingSoon: true },
  { id: "linkedin", name: "LinkedIn", category: "social", icon: Linkedin, description: "Post to LinkedIn", comingSoon: true },
  { id: "instagram", name: "Instagram", category: "social", icon: Instagram, description: "Post to Instagram", comingSoon: true },
  { id: "tiktok", name: "TikTok", category: "social", icon: Music2, description: "Post to TikTok", comingSoon: true },
  { id: "x", name: "X (Twitter)", category: "social", icon: Radio, description: "Post to X", comingSoon: true },
  { id: "youtube", name: "YouTube", category: "media", icon: Video, description: "Upload to YouTube", comingSoon: true },
  { id: "spotify", name: "Spotify", category: "media", icon: Music2, description: "Publish to Spotify", comingSoon: true },
];

const CATEGORY_LABELS: Record<ConnectorCategory, { title: string; description: string }> = {
  site: { title: "Site Delivery", description: "Publish articles, guides, and landing pages" },
  social: { title: "Social Channels", description: "Distribute social media posts" },
  media: { title: "Media Platforms", description: "Upload video and audio content" },
};

// ── Helpers ──────────────────────────────────────────────────────

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

// ── Main Page Content ────────────────────────────────────────────

function ConnectorsPageContent() {
  const { customerId, projectId, project, loading: projectLoading } = useProject();
  const searchParams = useSearchParams();

  // Git connector state
  const [connectorType, setConnectorType] = useState("git");
  const [ghInstallationId, setGhInstallationId] = useState<number | null>(null);
  const [ghOwner, setGhOwner] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghBranch, setGhBranch] = useState("");
  const [framework, setFramework] = useState<Framework>("astro");
  const [ghContentPath, setGhContentPath] = useState("src/content/posts");
  const [ghAssetsPath, setGhAssetsPath] = useState("src/assets/posts");
  const [ghCategoriesPath, setGhCategoriesPath] = useState("src/data/categories.json");
  const [ghAuthorsPath, setGhAuthorsPath] = useState("src/data/authors.json");
  const [ghRepos, setGhRepos] = useState<{ fullName: string; name: string; owner: string; defaultBranch: string; private: boolean }[]>([]);
  const [ghBranches, setGhBranches] = useState<string[]>([]);
  const [ghLoadingRepos, setGhLoadingRepos] = useState(false);
  const [ghLoadingBranches, setGhLoadingBranches] = useState(false);
  const [connectorStatus, setConnectorStatus] = useState<SaveStatus>("idle");
  const [detailView, setDetailView] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Load repos when entering Git detail view
  useEffect(() => {
    if (detailView === "git" && ghInstallationId && ghRepos.length === 0) {
      loadGhRepos(ghInstallationId);
    }
  }, [detailView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate state from project data
  useEffect(() => {
    if (!project || initialized) return;
    setConnectorType(project.connector?.type ?? "git");
    if (project.connector?.github) {
      setGhInstallationId(project.connector.github.installationId);
      setGhOwner(project.connector.github.owner);
      setGhRepo(project.connector.github.repo);
      setGhBranch(project.connector.github.branch);
      setFramework((project.connector.github as { framework?: Framework }).framework ?? "astro");
      setGhContentPath(project.connector.github.contentPath);
      setGhAssetsPath(project.connector.github.assetsPath);
      setGhCategoriesPath(project.connector.github.categoriesPath ?? "src/data/categories.json");
      setGhAuthorsPath(project.connector.github.authorsPath ?? "src/data/authors.json");
    }
    setInitialized(true);
  }, [project, initialized]);

  // Handle GitHub OAuth callback
  useEffect(() => {
    if (!customerId || !projectId || !initialized) return;
    const params = new URLSearchParams(window.location.search);
    const ghStatus = params.get("github");
    const installId = params.get("installation_id");
    if (ghStatus === "connected" && installId) {
      const id = Number(installId);
      setGhInstallationId(id);
      setConnectorType("github");
      updateProject(customerId, projectId, {
        connector: { type: "github", github: { installationId: id, owner: "", repo: "", branch: "main", contentPath: "src/content/posts", assetsPath: "src/assets/posts" } },
      });
      loadGhRepos(id);
      window.history.replaceState({}, "", "/connectors?tab=connections");
    }
  }, [customerId, projectId, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load repos when GitHub connected
  useEffect(() => {
    if (connectorType === "github" && ghInstallationId && ghRepos.length === 0 && initialized) {
      loadGhRepos(ghInstallationId);
    }
  }, [connectorType, ghInstallationId, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load branches when repo selected
  useEffect(() => {
    if (connectorType === "github" && ghInstallationId && ghOwner && ghRepo) {
      loadGhBranches(ghOwner, ghRepo);
    }
  }, [ghOwner, ghRepo, ghInstallationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGhRepos = useCallback(async (installationId: number) => {
    setGhLoadingRepos(true);
    try {
      const repos = await getGitHubRepos(installationId);
      setGhRepos(repos);
    } catch (err) {
      console.error("Failed to load GitHub repos:", err);
      setGhRepos([]);
    }
    setGhLoadingRepos(false);
  }, []);

  const loadGhBranches = async (owner: string, repo: string) => {
    if (!ghInstallationId) return;
    setGhLoadingBranches(true);
    try { setGhBranches(await getGitHubBranches(ghInstallationId, owner, repo)); } catch { /* ignore */ }
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

  const disconnectGitHub = async () => {
    setConnectorType("git");
    setGhInstallationId(null);
    setGhOwner("");
    setGhRepo("");
    setGhBranch("");
    setGhRepos([]);
    setGhBranches([]);
    if (customerId && projectId) {
      await updateProject(customerId, projectId, {
        connector: { type: "git" },
      });
    }
  };

  const saveConnector = () => withSave(setConnectorStatus, async () => {
    if (connectorType === "github" && ghInstallationId) {
      await updateProject(customerId, projectId, {
        connector: {
          type: "github",
          github: {
            installationId: ghInstallationId,
            owner: ghOwner,
            repo: ghRepo,
            branch: ghBranch,
            framework,
            contentPath: ghContentPath,
            assetsPath: ghAssetsPath,
            categoriesPath: ghCategoriesPath,
            authorsPath: ghAuthorsPath,
          },
        },
      });
    }
  });

  const selectFramework = (fw: Framework) => {
    setFramework(fw);
    const def = FRAMEWORKS.find((f) => f.id === fw);
    if (def) {
      setGhContentPath(def.contentPath);
      setGhAssetsPath(def.assetsPath);
      setGhCategoriesPath(def.categoriesPath);
      setGhAuthorsPath(def.authorsPath);
    }
  };

  const isGitConnected = connectorType === "github" && !!ghInstallationId;

  const getConnectorStatus = (id: string): "connected" | "not_connected" | "coming_soon" => {
    if (id === "git" && isGitConnected) return "connected";
    const def = CONNECTORS.find((c) => c.id === id);
    if (def?.comingSoon) return "coming_soon";
    return "not_connected";
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Detail View (single connector) ──────────────────────────────
  if (detailView) {
    const connector = CONNECTORS.find((c) => c.id === detailView);
    if (!connector) { setDetailView(null); return null; }

    return (
      <div className="p-8 space-y-8">
        {/* Back link */}
        <button
          onClick={() => setDetailView(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          All Connectors
        </button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-muted/50">
              <connector.icon className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{connector.name}</h1>
              {connector.id === "git" && isGitConnected && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Github className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">GitHub</span>
                </div>
              )}
            </div>
          </div>
          {connector.id === "git" && isGitConnected && (
            <Button
              variant="outline"
              onClick={() => { disconnectGitHub(); setDetailView(null); }}
            >
              Disconnect
            </Button>
          )}
        </div>

        {/* Git Repository Configuration */}
        {connector.id === "git" && isGitConnected && (
          <div className="space-y-6 max-w-lg">
            <div>
              <h2 className="text-lg font-semibold">Repository</h2>
              <p className="text-sm text-muted-foreground">Select your Git repository and branch</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Repository</Label>
                {ghLoadingRepos ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading repositories...
                  </div>
                ) : ghRepos.length === 0 ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">No repositories found</p>
                    <Button variant="outline" size="sm" onClick={() => ghInstallationId && loadGhRepos(ghInstallationId)}>
                      Retry
                    </Button>
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
              )}
            </div>

            {/* Framework */}
            {ghOwner && ghRepo && (
              <>
                <div className="border-t pt-6">
                  <h2 className="text-lg font-semibold">Framework</h2>
                  <p className="text-sm text-muted-foreground">Select your site framework to auto-configure content paths</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Framework</Label>
                    <Select value={framework} onValueChange={(v) => selectFramework(v as Framework)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FRAMEWORKS.map((fw) => (
                          <SelectItem key={fw.id} value={fw.id} disabled={fw.comingSoon}>
                            <span className={fw.comingSoon ? "text-muted-foreground" : ""}>
                              {fw.name}
                              {fw.comingSoon && <span className="ml-2 text-xs">(Coming Soon)</span>}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Framework hint */}
                  {(() => {
                    const fw = FRAMEWORKS.find((f) => f.id === framework);
                    return fw ? (
                      <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-blue-800 dark:text-blue-300">{fw.hint}</p>
                      </div>
                    ) : null;
                  })()}

                  <div className="space-y-2">
                    <Label>Content Path</Label>
                    <Input
                      value={ghContentPath}
                      onChange={(e) => setGhContentPath(e.target.value)}
                      placeholder="e.g. src/content/posts"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Assets Path</Label>
                    <Input
                      value={ghAssetsPath}
                      onChange={(e) => setGhAssetsPath(e.target.value)}
                      placeholder="e.g. src/assets/posts"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Categories File</Label>
                    <Input
                      value={ghCategoriesPath}
                      onChange={(e) => setGhCategoriesPath(e.target.value)}
                      placeholder="e.g. src/data/categories.json"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Authors File</Label>
                    <Input
                      value={ghAuthorsPath}
                      onChange={(e) => setGhAuthorsPath(e.target.value)}
                      placeholder="e.g. src/data/authors.json"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <SaveButton status={connectorStatus} onClick={saveConnector} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── List View (all connectors) ──────────────────────────────────
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Connectors</h1>
        <p className="text-muted-foreground">Connect services and configure content routing</p>
      </div>

      <Tabs defaultValue={searchParams.get("tab") ?? "connections"}>
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
        </TabsList>

        {/* ── Connections Tab ──────────────────────────────────────── */}
        <TabsContent value="connections" className="mt-6 space-y-8">
          {(["site", "social", "media"] as ConnectorCategory[]).map((cat) => {
            const items = CONNECTORS.filter((c) => c.category === cat);
            return (
              <div key={cat} className="space-y-1">
                <div className="mb-3">
                  <h2 className="text-lg font-semibold">{CATEGORY_LABELS[cat].title}</h2>
                  <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[cat].description}</p>
                </div>
                <div className="rounded-lg border divide-y">
                  {items.map((connector) => {
                    const status = getConnectorStatus(connector.id);
                    return (
                      <div
                        key={connector.id}
                        className={`flex items-center gap-4 px-4 py-3 ${status === "coming_soon" ? "opacity-50" : ""}`}
                      >
                        {/* Icon */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                          <connector.icon className="h-5 w-5" />
                        </div>

                        {/* Name + description */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{connector.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{connector.description}</p>
                        </div>

                        {/* Status / Action */}
                        <div className="flex items-center gap-2 shrink-0">
                          {connector.id === "git" && status === "connected" ? (
                            <>
                              <span className="text-sm font-medium text-green-600">Connected</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setDetailView("git")}
                              >
                                <Settings className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : connector.id === "git" && status === "not_connected" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6100"}/auth/github/install`;
                              }}
                            >
                              Connect
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="text-xs font-normal">Coming Soon</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ── Routing Tab ─────────────────────────────────────────── */}
        <TabsContent value="routing" className="mt-6 space-y-8">
          {/* Site Delivery Routing */}
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Site Delivery</h2>
              <p className="text-sm text-muted-foreground">
                Which connector delivers articles, guides, and landing pages
              </p>
            </div>
            {isGitConnected ? (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted">
                        <GitBranch className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Git Repository</p>
                        <p className="text-xs text-muted-foreground">
                          {ghOwner && ghRepo ? `${ghOwner}/${ghRepo}` : "No repository selected"}
                          {ghBranch ? ` (${ghBranch})` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      Active
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <Cable className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No site connector connected</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      const tabs = document.querySelector('[value="connections"]') as HTMLElement;
                      tabs?.click();
                    }}
                  >
                    Go to Connections
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Social Channels Routing */}
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Social Channels</h2>
              <p className="text-sm text-muted-foreground">
                Select which channels receive social media posts
              </p>
            </div>
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <Cable className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No social channels connected yet</p>
                <p className="text-xs text-muted-foreground mt-1">Connect channels in the Connections tab first</p>
              </CardContent>
            </Card>
          </div>

          {/* Media Platforms Routing */}
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Media Platforms</h2>
              <p className="text-sm text-muted-foreground">
                Select where video and audio content is published
              </p>
            </div>
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <Cable className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No media platforms connected yet</p>
                <p className="text-xs text-muted-foreground mt-1">Connect platforms in the Connections tab first</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ConnectorsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <ConnectorsPageContent />
    </Suspense>
  );
}
