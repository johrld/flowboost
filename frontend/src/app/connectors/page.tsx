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
import {
  Loader2,
  Check,
  AlertCircle,
  Github,
  GitBranch,
  ChevronLeft,
  ChevronDown,
  Info,
  Cable,
  Settings,
  Download,
} from "lucide-react";
import { CONNECTORS, FRAMEWORKS, CATEGORY_LABELS } from "./_lib/types";
import type { SaveStatus, Framework, ConnectorCategory } from "./_lib/types";
import { GenericConnectorConfig, SaveButton, withSave } from "./_components/generic-connector-config";

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

  // Generic connector config state — keyed by connector type
  const [configValues, setConfigValues] = useState<Record<string, Record<string, string>>>({});
  const [testStatus, setTestStatus] = useState<Record<string, "idle" | "testing" | "success" | "error">>({});
  const [testError, setTestError] = useState<Record<string, string>>({});
  const [testInfo, setTestInfo] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});

  // Schema discovery state (shared for all connectors with hasSchemaDiscovery)
  const [schemas, setSchemas] = useState<Array<{ id: string; label: string; description: string; slots: unknown[] }>>([]);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [selectedSchemas, setSelectedSchemas] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);
  const [schemaToTypeId, setSchemaToTypeId] = useState<Record<string, string>>({});

  // Listmonk connector state
  // Listmonk-specific data (templates + lists — not generic config)
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

  // Populate state from project data — generic for all connectors + GitHub special case
  useEffect(() => {
    if (!project || initialized) return;

    // Load GitHub connector (special — has its own state)
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

    // Load all standard connectors generically
    const loadedConfigs: Record<string, Record<string, string>> = {};
    for (const def of CONNECTORS) {
      if (!def.configKey || !def.fields) continue;
      const conn = findConn(def.id);
      const configData = conn?.[def.configKey as keyof typeof conn] as Record<string, string> | undefined;
      if (configData) {
        const values: Record<string, string> = {};
        for (const field of def.fields) {
          values[field.key] = (configData[field.key] as string) ?? "";
        }
        loadedConfigs[def.id] = values;
      }
    }
    setConfigValues(loadedConfigs);
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

  // Connection status derived purely from project data
  const isGitConnected = !!findConn("github")?.github?.installationId;
  const isConnected = useCallback((connectorId: string) => {
    if (connectorId === "git") return isGitConnected;
    const def = CONNECTORS.find((c) => c.id === connectorId);
    if (!def?.configKey) return false;
    const conn = findConn(connectorId);
    return !!conn?.[def.configKey as keyof typeof conn];
  }, [findConn, isGitConnected]);

  // Backward compat aliases
  const isSwConnected = isConnected("shopware");
  const isLmConnected = isConnected("listmonk");

  // Generic test handler for any connector with fields
  const handleGenericTest = useCallback(async (connectorId: string) => {
    const def = CONNECTORS.find((c) => c.id === connectorId);
    if (!def?.fields || !def.configKey) return;
    const values = configValues[connectorId] ?? {};
    const allFilled = def.fields.every((f) => !!values[f.key]);
    if (!allFilled) return;

    setTestStatus((prev) => ({ ...prev, [connectorId]: "testing" }));
    setTestError((prev) => ({ ...prev, [connectorId]: "" }));
    try {
      const config: Record<string, string> = {};
      for (const field of def.fields) {
        let val = values[field.key] ?? "";
        if (field.type === "url") val = val.replace(/\/+$/, "");
        config[field.key] = val;
      }
      const result = await testConnector(customerId, projectId, { type: connectorId, config });
      if (result.success) {
        setTestStatus((prev) => ({ ...prev, [connectorId]: "success" }));
        const infoStr = (result as Record<string, unknown>).shopName
          ?? (result as Record<string, unknown>).siteName
          ?? (result as Record<string, unknown>).listCount
          ?? "";
        setTestInfo((prev) => ({ ...prev, [connectorId]: String(infoStr) }));
      } else {
        setTestStatus((prev) => ({ ...prev, [connectorId]: "error" }));
        setTestError((prev) => ({ ...prev, [connectorId]: result.error ?? "Unknown error" }));
      }
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [connectorId]: "error" }));
      setTestError((prev) => ({ ...prev, [connectorId]: err instanceof Error ? err.message : "Connection failed" }));
    }
  }, [configValues, customerId, projectId]);

  // Generic save handler for any connector with fields
  const handleGenericSave = useCallback(async (connectorId: string) => {
    const def = CONNECTORS.find((c) => c.id === connectorId);
    if (!def?.fields || !def.configKey) return;
    const values = configValues[connectorId] ?? {};

    setSaveStatus((prev) => ({ ...prev, [connectorId]: "saving" as SaveStatus }));
    try {
      const configData: Record<string, string> = {};
      for (const field of def.fields) {
        let val = values[field.key] ?? "";
        if (field.type === "url") val = val.replace(/\/+$/, "");
        configData[field.key] = val;
      }
      await upsertConnector({ type: connectorId, [def.configKey]: configData });
      setSaveStatus((prev) => ({ ...prev, [connectorId]: "saved" as SaveStatus }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [connectorId]: "idle" as SaveStatus })), 2000);
    } catch {
      setSaveStatus((prev) => ({ ...prev, [connectorId]: "error" as SaveStatus }));
    }
  }, [configValues, upsertConnector]);

  // Generic stream toggle handler
  const handleStreamToggle = useCallback(async (connectorId: string, streamId: string, enabled: boolean) => {
    const def = CONNECTORS.find((c) => c.id === connectorId);
    if (!def?.streams) return;

    const conn = findConn(connectorId);
    // Current enabled streams, or defaults
    const current = conn?.enabledStreams
      ?? def.streams.filter((s) => s.defaultEnabled).map((s) => s.id);

    const updated = enabled
      ? [...new Set([...current, streamId])]
      : current.filter((id) => id !== streamId);

    // Get current config data to preserve it
    const configData: Record<string, unknown> = {};
    if (def.configKey && conn) {
      configData[def.configKey] = conn[def.configKey as keyof typeof conn];
    }

    await upsertConnector({ type: connectorId, ...configData, enabledStreams: updated });
  }, [findConn, upsertConnector]);

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

  // Auto-load schemas when entering a detail view with schema discovery
  useEffect(() => {
    const def = CONNECTORS.find((c) => c.id === detailView);
    if (def?.hasSchemaDiscovery && isConnected(def.id) && schemas.length === 0 && !schemasLoading && customerId && projectId) {
      handleLoadSchemas();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailView]);

  const getConnectorStatus = (id: string): "connected" | "not_connected" | "coming_soon" => {
    if (isConnected(id)) return "connected";
    const def = CONNECTORS.find((c) => c.id === id);
    if (def?.comingSoon) return "coming_soon";
    return "not_connected";
  };

  // Schema discovery handlers (generic, used by any connector with hasSchemaDiscovery)
  const handleLoadSchemas = async () => {
    if (!customerId || !projectId) return;
    setSchemasLoading(true);
    try {
      const [schemasResult, typesResult] = await Promise.all([
        getConnectorSchemas(customerId, projectId),
        import("@/lib/api").then((m) => m.getContentTypes(customerId, projectId)),
      ]);
      setSchemas(schemasResult.schemas);
      const types = typesResult as Array<{ id: string; connectorRef?: string }>;
      const importedIds = new Set<string>();
      const refToId: Record<string, string> = {};
      for (const t of types) {
        if (t.connectorRef) {
          importedIds.add(t.connectorRef);
          refToId[t.connectorRef] = t.id;
        }
      }
      setSelectedSchemas(importedIds);
      setSchemaToTypeId(refToId);
    } catch (err) {
      console.error("Schema discovery failed:", err);
    } finally {
      setSchemasLoading(false);
    }
  };

  const handleImportSchemas = async () => {
    if (!customerId || !projectId || selectedSchemas.size === 0) return;
    setImporting(true);
    try {
      const result = await importConnectorSchemas(customerId, projectId, Array.from(selectedSchemas));
      alert(`${result.types?.length ?? 0} Content Types imported`);
      setSchemas([]);
    } catch (err) {
      console.error("Schema import failed:", err);
      alert("Import failed");
    } finally {
      setImporting(false);
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

        {/* Generic Connector Configuration (for connectors with fields) */}
        {connector.fields && connector.id !== "shopware" && (
          <GenericConnectorConfig
            connector={connector}
            values={configValues[connector.id] ?? {}}
            onValueChange={(key, val) => setConfigValues((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], [key]: val } }))}
            testStatus={testStatus[connector.id] ?? "idle"}
            testError={testError[connector.id] ?? ""}
            testInfo={testInfo[connector.id] ?? ""}
            onTest={() => handleGenericTest(connector.id)}
            saveStatus={saveStatus[connector.id] ?? "idle"}
            onSave={() => handleGenericSave(connector.id)}
            isConnected={isConnected(connector.id)}
            enabledStreams={findConn(connector.id)?.enabledStreams}
            onStreamToggle={(streamId, enabled) => handleStreamToggle(connector.id, streamId, enabled)}
          />
        )}

        {/* Shopware Configuration */}
        {/* Shopware: generic config + connector-specific extras */}
        {connector.id === "shopware" && (
          <div className="space-y-6">
            <GenericConnectorConfig
              connector={connector}
              values={configValues[connector.id] ?? {}}
              onValueChange={(key, val) => setConfigValues((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], [key]: val } }))}
              testStatus={testStatus[connector.id] ?? "idle"}
              testError={testError[connector.id] ?? ""}
              testInfo={testInfo[connector.id] ?? ""}
              onTest={() => handleGenericTest(connector.id)}
              saveStatus={saveStatus[connector.id] ?? "idle"}
              onSave={() => handleGenericSave(connector.id)}
              isConnected={isSwConnected}
              enabledStreams={findConn(connector.id)?.enabledStreams}
              onStreamToggle={(streamId, enabled) => handleStreamToggle(connector.id, streamId, enabled)}
            />

            {/* Schema Discovery (Shopware-specific) */}
            {isSwConnected && (
                <div className="border-t pt-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">CMS Layouts</h2>
                    <p className="text-sm text-muted-foreground">
                      Import Shopping Experiences from Shopware as Content Types
                    </p>
                  </div>

                  {schemasLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading layouts...
                    </div>
                  ) : schemas.length > 0 ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border divide-y max-h-[400px] overflow-y-auto">
                        {schemas.map((schema) => {
                          const slots = schema.slots as Array<{ id: string; label: string; type: string }>;
                          const isExpanded = expandedSchema === schema.id;
                          const isImported = selectedSchemas.has(schema.id);
                          return (
                            <div key={schema.id}>
                              <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50">
                                <button
                                  type="button"
                                  onClick={() => setExpandedSchema(isExpanded ? null : schema.id)}
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
                                      const typeId = schemaToTypeId[schema.id];
                                      if (!typeId) return;
                                      try {
                                        const { deleteContentType } = await import("@/lib/api");
                                        await deleteContentType(customerId, projectId, typeId);
                                        const next = new Set(selectedSchemas);
                                        next.delete(schema.id);
                                        setSelectedSchemas(next);
                                        const nextMap = { ...schemaToTypeId };
                                        delete nextMap[schema.id];
                                        setSchemaToTypeId(nextMap);
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
                                        const next = new Set(selectedSchemas);
                                        next.add(schema.id);
                                        setSelectedSchemas(next);
                                        // Track the created type ID for later removal
                                        if (result.types?.[0]) {
                                          setSchemaToTypeId((prev) => ({
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
                        <span>{selectedSchemas.size} imported</span>
                        <span>&middot;</span>
                        <button type="button" onClick={handleLoadSchemas} className="hover:text-foreground transition-colors">
                          Refresh
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleLoadSchemas}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Load Schemas
                    </Button>
                  )}
                </div>
              )}
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
                          ) : connector.fields && status === "not_connected" ? (
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
