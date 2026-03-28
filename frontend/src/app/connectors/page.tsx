"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
  testConnector,
  getConnectorSchemas,
  importConnectorSchemas,
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
  ChevronDown,
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
  Download,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";
type ConnectorCategory = "site" | "ecommerce" | "newsletter" | "social" | "media";
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
  { id: "webflow", name: "Webflow", category: "site", icon: Aperture, description: "Publish to Webflow CMS", comingSoon: true },
  { id: "shopware", name: "Shopware 6", category: "ecommerce", icon: ShoppingBag, description: "Read Shopping Experiences, write CMS slots", comingSoon: false },
  { id: "shopify", name: "Shopify", category: "ecommerce", icon: ShoppingBag, description: "Publish to Shopify blog and pages", comingSoon: true },
  { id: "woocommerce", name: "WooCommerce", category: "ecommerce", icon: ShoppingBag, description: "Publish via WooCommerce REST API", comingSoon: true },
  { id: "listmonk", name: "Listmonk", category: "newsletter", icon: Radio, description: "Create newsletter drafts via Listmonk API", comingSoon: false },
  { id: "mailchimp", name: "Mailchimp", category: "newsletter", icon: Radio, description: "Create campaigns via Mailchimp API", comingSoon: true },
  { id: "linkedin", name: "LinkedIn", category: "social", icon: Linkedin, description: "Post to LinkedIn", comingSoon: true },
  { id: "instagram", name: "Instagram", category: "social", icon: Instagram, description: "Post to Instagram", comingSoon: true },
  { id: "tiktok", name: "TikTok", category: "social", icon: Music2, description: "Post to TikTok", comingSoon: true },
  { id: "x", name: "X (Twitter)", category: "social", icon: Radio, description: "Post to X", comingSoon: true },
  { id: "youtube", name: "YouTube", category: "media", icon: Video, description: "Upload to YouTube", comingSoon: true },
  { id: "spotify", name: "Spotify", category: "media", icon: Music2, description: "Publish to Spotify", comingSoon: true },
];

const CATEGORY_LABELS: Record<ConnectorCategory, { title: string; description: string }> = {
  site: { title: "Site Delivery", description: "Publish articles, guides, and landing pages" },
  ecommerce: { title: "E-Commerce", description: "Connect shop platforms for content and product data" },
  newsletter: { title: "Newsletter", description: "Create and send email campaigns" },
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
  const { customerId, projectId, project, loading: projectLoading, refreshProjects } = useProject();
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

  // Shopware connector state
  const [swShopUrl, setSwShopUrl] = useState("");
  const [swClientId, setSwClientId] = useState("");
  const [swClientSecret, setSwClientSecret] = useState("");
  const [swAsSource, setSwAsSource] = useState(false);
  const [swTestStatus, setSwTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [swTestError, setSwTestError] = useState("");
  const [swTestShopName, setSwTestShopName] = useState("");
  const [swSaveStatus, setSwSaveStatus] = useState<SaveStatus>("idle");
  const [swSchemas, setSwSchemas] = useState<Array<{ id: string; label: string; description: string; slots: unknown[] }>>([]);
  const [swSchemasLoading, setSwSchemasLoading] = useState(false);
  const [swSelectedSchemas, setSwSelectedSchemas] = useState<Set<string>>(new Set());
  const [swImporting, setSwImporting] = useState(false);
  const [swExpandedSchema, setSwExpandedSchema] = useState<string | null>(null);
  // Map: connectorRef (schema.id) → content type ID (slug) for delete
  const [swSchemaToTypeId, setSwSchemaToTypeId] = useState<Record<string, string>>({});

  // Listmonk connector state
  const [lmBaseUrl, setLmBaseUrl] = useState("");
  const [lmUsername, setLmUsername] = useState("");
  const [lmPassword, setLmPassword] = useState("");
  const [lmTestStatus, setLmTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [lmTestError, setLmTestError] = useState("");
  const [lmListCount, setLmListCount] = useState(0);
  const [lmSaveStatus, setLmSaveStatus] = useState<SaveStatus>("idle");
  const [lmTemplates, setLmTemplates] = useState<Array<{ id: number; name: string; isDefault: boolean }>>([]);
  const [lmLists, setLmLists] = useState<Array<{ id: number; name: string; type: string; subscriberCount: number }>>([]);
  const [lmDataLoading, setLmDataLoading] = useState(false);

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

  const loadGhBranches = useCallback(async (owner: string, repo: string) => {
    if (!ghInstallationId) return;
    setGhLoadingBranches(true);
    try { setGhBranches(await getGitHubBranches(ghInstallationId, owner, repo)); } catch { /* ignore */ }
    setGhLoadingBranches(false);
  }, [ghInstallationId]);

  // Load repos when entering Git detail view
  useEffect(() => {
    if (detailView === "git" && ghInstallationId && ghRepos.length === 0) {
      loadGhRepos(ghInstallationId);
    }
  }, [detailView, ghInstallationId, ghRepos.length, loadGhRepos]);

  // Helper to find a connector by type in the project's connectors array
  const findConn = useCallback((type: string) => {
    return (project?.connectors ?? []).find((c) => c.type === type);
  }, [project?.connectors]);

  // Helper to add or update a connector in the array and save to project
  const upsertConnector = useCallback(async (connectorData: Record<string, unknown> & { type: string }) => {
    if (!customerId || !projectId || !project) return;
    const existing = (project.connectors ?? []);
    const idx = existing.findIndex((c) => c.type === connectorData.type);
    const id = idx >= 0 ? existing[idx].id : crypto.randomUUID();
    const instance = { id, ...connectorData };
    const connectors = idx >= 0
      ? existing.map((c, i) => i === idx ? instance : c)
      : [...existing, instance];
    await updateProject(customerId, projectId, { connectors } as Partial<typeof project>);
    await refreshProjects();
  }, [customerId, projectId, project, refreshProjects]);

  // Helper to remove a connector from the array
  const removeConnector = useCallback(async (type: string) => {
    if (!customerId || !projectId || !project) return;
    const connectors = (project.connectors ?? []).filter((c) => c.type !== type);
    await updateProject(customerId, projectId, { connectors } as Partial<typeof project>);
    await refreshProjects();
  }, [customerId, projectId, project, refreshProjects]);

  // Populate state from project data
  useEffect(() => {
    if (!project || initialized) return;
    const ghConn = findConn("github");
    if (ghConn?.github) {
      setConnectorType("github");
      setGhInstallationId(ghConn.github.installationId);
      setGhOwner(ghConn.github.owner);
      setGhRepo(ghConn.github.repo);
      setGhBranch(ghConn.github.branch);
      setFramework((ghConn.github as { framework?: Framework }).framework ?? "astro");
      setGhContentPath(ghConn.github.contentPath);
      setGhAssetsPath(ghConn.github.assetsPath);
      setGhCategoriesPath(ghConn.github.categoriesPath ?? "src/data/categories.json");
      setGhAuthorsPath(ghConn.github.authorsPath ?? "src/data/authors.json");
    }
    const lmConn = findConn("listmonk");
    if (lmConn?.listmonk) {
      setLmBaseUrl(lmConn.listmonk.baseUrl ?? "");
      setLmUsername(lmConn.listmonk.username ?? "");
      setLmPassword(lmConn.listmonk.password ?? "");
    }
    const swConn = findConn("shopware");
    if (swConn?.shopware) {
      setSwShopUrl(swConn.shopware.shopUrl ?? "");
      setSwClientId(swConn.shopware.clientId ?? "");
      setSwClientSecret(swConn.shopware.clientSecret ?? "");
    }
    setInitialized(true);
  }, [project, initialized, findConn]);

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
      upsertConnector({ type: "github", github: { installationId: id, owner: "", repo: "", branch: "main", contentPath: "src/content/posts", assetsPath: "src/assets/posts" } });
      loadGhRepos(id);
      window.history.replaceState({}, "", "/connectors?tab=connections");
    }
  }, [customerId, projectId, initialized, loadGhRepos]);

  // Load repos when GitHub connected
  useEffect(() => {
    if (connectorType === "github" && ghInstallationId && ghRepos.length === 0 && initialized) {
      loadGhRepos(ghInstallationId);
    }
  }, [connectorType, ghInstallationId, initialized, loadGhRepos, ghRepos.length]);

  // Load branches when repo selected
  useEffect(() => {
    if (connectorType === "github" && ghInstallationId && ghOwner && ghRepo) {
      loadGhBranches(ghOwner, ghRepo);
    }
  }, [ghOwner, ghRepo, ghInstallationId, connectorType, loadGhBranches]);

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
      await removeConnector("github");
    }
  };

  const saveConnector = () => withSave(setConnectorStatus, async () => {
    if (connectorType === "github" && ghInstallationId) {
      await upsertConnector({
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

  // Connection status derived purely from project data (no local state dependency)
  const isGitConnected = !!findConn("github")?.github?.installationId;
  const isSwConnected = !!findConn("shopware")?.shopware?.shopUrl;
  const isLmConnected = !!findConn("listmonk")?.listmonk?.baseUrl;

  const handleLmTest = async () => {
    if (!lmBaseUrl || !lmUsername || !lmPassword) return;
    setLmTestStatus("testing");
    setLmTestError("");
    try {
      const result = await testConnector(customerId, projectId, {
        type: "listmonk",
        config: { baseUrl: lmBaseUrl.replace(/\/+$/, ""), username: lmUsername, password: lmPassword },
      });
      if (result.success) {
        setLmTestStatus("success");
        setLmListCount((result as { listCount?: number }).listCount ?? 0);
      } else {
        setLmTestStatus("error");
        setLmTestError(result.error ?? "Unknown error");
      }
    } catch (err) {
      setLmTestStatus("error");
      setLmTestError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const handleLmSave = () => withSave(setLmSaveStatus, async () => {
    await upsertConnector({
      type: "listmonk",
      listmonk: {
        baseUrl: lmBaseUrl.replace(/\/+$/, ""),
        username: lmUsername,
        password: lmPassword,
      },
    });
  });

  const handleLmLoadData = async () => {
    if (!customerId || !projectId) return;
    setLmDataLoading(true);
    try {
      const [templatesRes, listsRes] = await Promise.all([
        import("@/lib/api").then((m) => m.getConnectorTemplates(customerId, projectId)),
        import("@/lib/api").then((m) => m.getConnectorLists(customerId, projectId)),
      ]);
      setLmTemplates(templatesRes.templates);
      setLmLists(listsRes.lists);
    } catch (err) {
      console.error("Failed to load Listmonk data:", err);
    } finally {
      setLmDataLoading(false);
    }
  };

  // Auto-load Listmonk data when entering detail view (with connected project)
  useEffect(() => {
    if (detailView === "listmonk" && isLmConnected && lmTemplates.length === 0 && !lmDataLoading && customerId && projectId
        && findConn("listmonk")) {
      handleLmLoadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailView, isLmConnected]);

  // Auto-load schemas when entering Shopware detail view
  useEffect(() => {
    if (detailView === "shopware" && isSwConnected && swSchemas.length === 0 && !swSchemasLoading && customerId && projectId) {
      handleSwLoadSchemas();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailView, isSwConnected]);

  const getConnectorStatus = (id: string): "connected" | "not_connected" | "coming_soon" => {
    if (id === "git" && isGitConnected) return "connected";
    if (id === "shopware" && isSwConnected) return "connected";
    if (id === "listmonk" && isLmConnected) return "connected";
    const def = CONNECTORS.find((c) => c.id === id);
    if (def?.comingSoon) return "coming_soon";
    return "not_connected";
  };

  const handleSwTest = async () => {
    if (!swShopUrl || !swClientId || !swClientSecret) return;
    setSwTestStatus("testing");
    setSwTestError("");
    try {
      const result = await testConnector(customerId, projectId, {
        type: "shopware",
        config: { shopUrl: swShopUrl.replace(/\/+$/, ""), clientId: swClientId, clientSecret: swClientSecret },
      });
      if (result.success) {
        setSwTestStatus("success");
        setSwTestShopName(result.shopName ?? "");
      } else {
        setSwTestStatus("error");
        setSwTestError(result.error ?? "Unbekannter Fehler");
      }
    } catch (err) {
      setSwTestStatus("error");
      setSwTestError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen");
    }
  };

  const handleSwSave = () => withSave(setSwSaveStatus, async () => {
    await upsertConnector({
      type: "shopware",
      shopware: {
        shopUrl: swShopUrl.replace(/\/+$/, ""),
        clientId: swClientId,
        clientSecret: swClientSecret,
      },
    });
  });

  const handleSwLoadSchemas = async () => {
    if (!customerId || !projectId) return;
    setSwSchemasLoading(true);
    try {
      const [schemasResult, typesResult] = await Promise.all([
        getConnectorSchemas(customerId, projectId),
        import("@/lib/api").then((m) => m.getContentTypes(customerId, projectId)),
      ]);
      setSwSchemas(schemasResult.schemas);
      // Mark schemas that are already imported as content types
      const types = typesResult as Array<{ id: string; connectorRef?: string }>;
      const importedIds = new Set<string>();
      const refToId: Record<string, string> = {};
      for (const t of types) {
        if (t.connectorRef) {
          importedIds.add(t.connectorRef);
          refToId[t.connectorRef] = t.id;
        }
      }
      setSwSelectedSchemas(importedIds);
      setSwSchemaToTypeId(refToId);
    } catch (err) {
      console.error("Schema discovery failed:", err);
    } finally {
      setSwSchemasLoading(false);
    }
  };

  const handleSwImportSchemas = async () => {
    if (!customerId || !projectId || swSelectedSchemas.size === 0) return;
    setSwImporting(true);
    try {
      const result = await importConnectorSchemas(customerId, projectId, Array.from(swSelectedSchemas));
      alert(`${result.types?.length ?? 0} Content Types importiert`);
      setSwSchemas([]);
    } catch (err) {
      console.error("Schema import failed:", err);
      alert("Import fehlgeschlagen");
    } finally {
      setSwImporting(false);
    }
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

        {/* Listmonk Configuration */}
        {connector.id === "listmonk" && (
          <div className="flex gap-8">
            <div className="flex-1 max-w-lg space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Connection</h2>
                <p className="text-sm text-muted-foreground">Listmonk API credentials</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Listmonk URL</Label>
                  <Input value={lmBaseUrl} onChange={(e) => setLmBaseUrl(e.target.value)} placeholder="https://newsletter.example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={lmUsername} onChange={(e) => setLmUsername(e.target.value)} placeholder="API username" />
                </div>
                <div className="space-y-2">
                  <Label>Password / API Token</Label>
                  <Input type="password" value={lmPassword} onChange={(e) => setLmPassword(e.target.value)} placeholder="API token or password" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleLmTest} disabled={lmTestStatus === "testing" || !lmBaseUrl || !lmUsername || !lmPassword}>
                  {lmTestStatus === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {lmTestStatus === "success" && <Check className="mr-2 h-4 w-4 text-green-600" />}
                  {lmTestStatus === "error" && <AlertCircle className="mr-2 h-4 w-4 text-destructive" />}
                  Test Connection
                </Button>
                <SaveButton status={lmSaveStatus} onClick={handleLmSave} />
              </div>

              {lmTestStatus === "success" && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-sm text-green-800 dark:text-green-300">
                    Connected — {lmListCount} list{lmListCount !== 1 ? "s" : ""} found
                  </p>
                </div>
              )}

              {lmTestStatus === "error" && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-300">{lmTestError}</p>
                </div>
              )}

              {/* Templates + Lists */}
              {isLmConnected && (
                <div className="border-t pt-6 space-y-4">
                  {lmDataLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading templates and lists...
                    </div>
                  ) : (
                    <>
                      {lmTemplates.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">Templates</h3>
                          <div className="rounded-lg border divide-y">
                            {lmTemplates.map((t) => (
                              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                                <span className="flex-1">{t.name}</span>
                                {t.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {lmLists.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">Subscriber Lists</h3>
                          <div className="rounded-lg border divide-y">
                            {lmLists.map((l) => (
                              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                                <span className="flex-1">{l.name}</span>
                                <Badge variant="outline" className="text-[10px]">{l.type}</Badge>
                                <span className="text-xs text-muted-foreground">{l.subscriberCount.toLocaleString()} subscribers</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button type="button" onClick={handleLmLoadData} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Refresh
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right: Setup Guide */}
            <div className="w-80 shrink-0">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950 sticky top-8">
                <div className="flex gap-2 mb-3">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Listmonk Setup</p>
                </div>
                <div className="text-xs text-blue-800 dark:text-blue-300 space-y-3">
                  <div>
                    <p className="font-medium">1. Create Role</p>
                    <p className="opacity-80 mt-0.5">Settings &rarr; User Roles &rarr; New &rarr; Name: &quot;FlowBoost&quot;</p>
                    <ul className="list-disc ml-4 mt-1 space-y-0.5 opacity-90">
                      <li>Lists: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">lists:get_all</code></li>
                      <li>Campaigns: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">campaigns:get</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">campaigns:manage</code></li>
                      <li>Templates: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">templates:get</code></li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">2. Create API User</p>
                    <p className="opacity-80 mt-0.5">Settings &rarr; Users &rarr; New User &rarr; Type: API &rarr; Role: FlowBoost</p>
                  </div>
                  <div>
                    <p className="font-medium">3. Copy Credentials</p>
                    <p className="opacity-80 mt-0.5">Username + API token. Token is shown only once.</p>
                  </div>
                  <p className="opacity-70 border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">FlowBoost creates campaign drafts only — never sends automatically.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shopware Configuration */}
        {connector.id === "shopware" && (
          <div className="flex gap-8">
            {/* Left: Form */}
            <div className="flex-1 max-w-lg space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Connection</h2>
                <p className="text-sm text-muted-foreground">Shopware 6 Admin API credentials</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Shop URL</Label>
                  <Input
                    value={swShopUrl}
                    onChange={(e) => setSwShopUrl(e.target.value)}
                    placeholder="https://my-shop.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client ID</Label>
                  <Input
                    value={swClientId}
                    onChange={(e) => setSwClientId(e.target.value)}
                    placeholder="Integration Client ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <Input
                    type="password"
                    value={swClientSecret}
                    onChange={(e) => setSwClientSecret(e.target.value)}
                    placeholder="Integration Client Secret"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleSwTest}
                  disabled={swTestStatus === "testing" || !swShopUrl || !swClientId || !swClientSecret}
                >
                  {swTestStatus === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {swTestStatus === "success" && <Check className="mr-2 h-4 w-4 text-green-600" />}
                  {swTestStatus === "error" && <AlertCircle className="mr-2 h-4 w-4 text-destructive" />}
                  Test Connection
                </Button>
                <SaveButton status={swSaveStatus} onClick={handleSwSave} />
              </div>

              {swTestStatus === "success" && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-sm text-green-800 dark:text-green-300">
                    Connected{swTestShopName ? ` — ${swTestShopName}` : ""}
                  </p>
                </div>
              )}

              {swTestStatus === "error" && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-300">{swTestError}</p>
                </div>
              )}

              {/* Use as Source */}
              {isSwConnected && (
                <div className="border-t pt-6">
                  <label className="flex items-center justify-between gap-4 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">Use as Source</p>
                      <p className="text-xs text-muted-foreground">
                        Make Shopware content (products, categories) available as input sources in Flows
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={swAsSource}
                      onChange={async (e) => {
                        setSwAsSource(e.target.checked);
                        await upsertConnector({
                          type: "shopware",
                          useAsSource: e.target.checked,
                          shopware: {
                            shopUrl: swShopUrl.replace(/\/+$/, ""),
                            clientId: swClientId,
                            clientSecret: swClientSecret,
                          },
                        });
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                </div>
              )}

              {/* Schema Discovery */}
              {isSwConnected && (
                <div className="border-t pt-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">CMS Layouts</h2>
                    <p className="text-sm text-muted-foreground">
                      Import Shopping Experiences from Shopware as Content Types
                    </p>
                  </div>

                  {swSchemasLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading layouts...
                    </div>
                  ) : swSchemas.length > 0 ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border divide-y max-h-[400px] overflow-y-auto">
                        {swSchemas.map((schema) => {
                          const slots = schema.slots as Array<{ id: string; label: string; type: string }>;
                          const isExpanded = swExpandedSchema === schema.id;
                          const isImported = swSelectedSchemas.has(schema.id);
                          return (
                            <div key={schema.id}>
                              <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50">
                                <button
                                  type="button"
                                  onClick={() => setSwExpandedSchema(isExpanded ? null : schema.id)}
                                  className="flex-1 flex items-center gap-2 min-w-0 text-left"
                                >
                                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : "-rotate-90"}`} />
                                  <span className="text-sm font-medium truncate">{schema.label}</span>
                                  <Badge variant="secondary" className="text-[10px] shrink-0 ml-auto">
                                    {slots.length}
                                  </Badge>
                                </button>
                                {isImported ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive hover:text-destructive shrink-0"
                                    onClick={async () => {
                                      if (!customerId || !projectId) return;
                                      const typeId = swSchemaToTypeId[schema.id];
                                      if (!typeId) return;
                                      try {
                                        const { deleteContentType } = await import("@/lib/api");
                                        await deleteContentType(customerId, projectId, typeId);
                                        const next = new Set(swSelectedSchemas);
                                        next.delete(schema.id);
                                        setSwSelectedSchemas(next);
                                        const nextMap = { ...swSchemaToTypeId };
                                        delete nextMap[schema.id];
                                        setSwSchemaToTypeId(nextMap);
                                      } catch { /* ignore */ }
                                    }}
                                  >
                                    Remove
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs shrink-0"
                                    onClick={async () => {
                                      if (!customerId || !projectId) return;
                                      try {
                                        const result = await importConnectorSchemas(customerId, projectId, [schema.id]);
                                        const next = new Set(swSelectedSchemas);
                                        next.add(schema.id);
                                        setSwSelectedSchemas(next);
                                        // Track the created type ID for later removal
                                        if (result.types?.[0]) {
                                          setSwSchemaToTypeId((prev) => ({
                                            ...prev,
                                            [schema.id]: (result.types[0] as { id: string }).id,
                                          }));
                                        }
                                      } catch { /* ignore */ }
                                    }}
                                  >
                                    Import
                                  </Button>
                                )}
                              </div>
                              {isExpanded && slots.length > 0 && (
                                <div className="px-3 pb-2 pl-9">
                                  <div className="rounded border bg-muted/30 divide-y">
                                    {slots.map((slot, idx) => (
                                      <div key={`${slot.id}-${idx}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                                        <Badge variant="outline" className="text-[10px] px-1.5 h-4 shrink-0">
                                          {slot.type}
                                        </Badge>
                                        <span className="text-muted-foreground truncate">{slot.label}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{swSelectedSchemas.size} imported</span>
                        <span>&middot;</span>
                        <button type="button" onClick={handleSwLoadSchemas} className="hover:text-foreground transition-colors">
                          Refresh
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleSwLoadSchemas}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Load Schemas
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Right: Setup Guide */}
            <div className="w-80 shrink-0">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950 sticky top-8">
                <div className="flex gap-2 mb-3">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Shopware Setup</p>
                </div>
                <div className="text-xs text-blue-800 dark:text-blue-300 space-y-3">
                  <div>
                    <p className="font-medium">1. Create Role</p>
                    <p className="opacity-80 mt-0.5">Settings &rarr; System &rarr; Users & Permissions &rarr; Roles &rarr; New Role &quot;FlowBoost&quot;</p>
                  </div>
                  <div>
                    <p className="font-medium">Permissions:</p>
                    <ul className="list-disc ml-4 mt-1 space-y-0.5 opacity-90">
                      <li>Catalogues &rarr; Categories: View, Edit, Create</li>
                      <li>Content &rarr; Shopping Experiences: View</li>
                      <li>Catalogues &rarr; Products: View</li>
                      <li>Content &rarr; Media: View, Create</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">2. Create Integration</p>
                    <p className="opacity-80 mt-0.5">Settings &rarr; System &rarr; Integrations &rarr; Add Integration &rarr; Assign role &quot;FlowBoost&quot;</p>
                  </div>
                  <p className="opacity-70 border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">Client Secret is shown only once. No admin access required.</p>
                </div>
              </div>
            </div>
          </div>
        )}

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
          {(["site", "ecommerce", "newsletter", "social", "media"] as ConnectorCategory[]).map((cat) => {
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
                          {status === "connected" ? (
                            <>
                              {connector.id === "git" && (
                                <Button variant="ghost" size="sm" className="text-xs h-8" asChild>
                                  <Link href="/website">View Index</Link>
                                </Button>
                              )}
                              <span className="text-sm font-medium text-green-600">Connected</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setDetailView(connector.id)}
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
                          ) : (connector.id === "shopware" || connector.id === "listmonk") && status === "not_connected" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDetailView(connector.id)}
                            >
                              Connect
                            </Button>
                          ) : status === "coming_soon" ? (
                            <Badge variant="secondary" className="text-xs font-normal">Coming Soon</Badge>
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
          {/* Schema Import */}
          {findConn("shopware") || findConn("wordpress") ? (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Content Types</h3>
                  <p className="text-sm text-muted-foreground">
                    Import content structures from your connected platform
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!customerId || !projectId) return;
                    try {
                      const { importConnectorSchemas } = await import("@/lib/api");
                      const result = await importConnectorSchemas(customerId, projectId);
                      alert(`Imported ${result.types.length} content types`);
                    } catch (err) {
                      console.error("Schema import failed:", err);
                      alert("Import failed — check connector credentials");
                    }
                  }}
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Import Schemas
                </Button>
              </div>
            </div>
          ) : null}
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
