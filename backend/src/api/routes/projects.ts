import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { getFileContent } from "../../services/github.js";
import { createLogger } from "../../utils/logger.js";
import type { Project } from "../../models/types.js";

const log = createLogger("projects");
const syncLog = createLogger("connector-sync");

/**
 * Copy project default files (section-specs, templates, SEO docs) into a new project directory.
 */
function copyProjectDefaults(projectDir: string, dataDir: string): void {
  const defaultsDir = path.join(dataDir, "..", "data.seed", "project-defaults");
  if (!fs.existsSync(defaultsDir)) {
    log.warn({ defaultsDir }, "project-defaults not found, skipping");
    return;
  }

  const copyRecursive = (src: string, dest: string) => {
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        copyRecursive(path.join(src, entry), path.join(dest, entry));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  };

  for (const entry of fs.readdirSync(defaultsDir)) {
    copyRecursive(path.join(defaultsDir, entry), path.join(projectDir, entry));
  }
  log.info({ projectDir }, "project defaults copied");
}

export async function projectRoutes(app: FastifyInstance) {
  // GET /customers/:customerId/projects
  app.get<{ Params: { customerId: string } }>("/", async (request) => {
    const { customerId } = request.params;
    return app.ctx.projectsFor(customerId).list();
  });

  // POST /customers/:customerId/projects
  app.post<{
    Params: { customerId: string };
    Body: {
      name: string;
      slug?: string;
      description?: string;
      defaultLanguage: string;
      languages?: { code: string; name: string; enabled: boolean }[];
      categories?: { id: string; labels: Record<string, string> }[];
    };
  }>("/", async (request, reply) => {
    const { customerId } = request.params;
    const customer = app.ctx.customers.get(customerId);
    if (!customer) {
      return reply.status(404).send({ error: "Customer not found" });
    }

    const { name, slug, description, defaultLanguage, languages, categories } = request.body as {
      name: string;
      slug?: string;
      description?: string;
      defaultLanguage: string;
      languages?: { code: string; name: string; enabled: boolean }[];
      categories?: { id: string; labels: Record<string, string> }[];
    };

    if (!name || !defaultLanguage) {
      return reply.status(400).send({ error: "name and defaultLanguage are required" });
    }

    const now = new Date().toISOString();
    const projectData: Omit<Project, "id"> = {
      customerId,
      name,
      slug: slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      description: description ?? "",
      defaultLanguage,
      languages: languages ?? [{ code: defaultLanguage, name: defaultLanguage, enabled: true }],
      categories: categories ?? [],
      keywords: {},
      connector: { type: "filesystem", filesystem: { outputDir: "./output" } },
      pipeline: {
        defaultModel: "sonnet",
        maxRetriesPerPhase: 2,
        maxBudgetPerArticle: 2,
        imagenModel: "imagen-4.0-fast-generate-001",
      },
      createdAt: now,
      updatedAt: now,
    };

    const store = app.ctx.projectsFor(customerId);
    const project = store.create(projectData);

    // Copy default files (section-specs, templates, SEO docs)
    const projectDir = store.entityDir(project.id);
    copyProjectDefaults(projectDir, app.ctx.dataDir);

    log.info({ projectId: project.id, name }, "project created");
    return reply.status(201).send(project);
  });

  // GET /customers/:customerId/projects/:projectId
  app.get<{ Params: { customerId: string; projectId: string } }>("/:projectId", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    return project;
  });

  // PUT /customers/:customerId/projects/:projectId
  app.put<{ Params: { customerId: string; projectId: string }; Body: Record<string, unknown> }>(
    "/:projectId",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      const existing = store.get(projectId);
      if (!existing) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const { id: _id, customerId: _cid, createdAt: _ca, ...allowed } = request.body as Record<string, unknown>;
      const updated = store.update(projectId, {
        ...allowed,
        updatedAt: new Date().toISOString(),
      } as Partial<typeof existing>);

      return updated;
    },
  );

  // GET /customers/:customerId/projects/:projectId/project-brief
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/:projectId/project-brief",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      if (!store.get(projectId)) {
        return reply.status(404).send({ error: "Project not found" });
      }
      const content = store.getProjectBrief(projectId);
      return { content: content ?? "" };
    },
  );

  // GET /customers/:customerId/projects/:projectId/api-keys
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/:projectId/api-keys",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      if (!store.get(projectId)) {
        return reply.status(404).send({ error: "Project not found" });
      }
      return store.getMaskedApiKeys(projectId);
    },
  );

  // PUT /customers/:customerId/projects/:projectId/api-keys
  app.put<{ Params: { customerId: string; projectId: string }; Body: Record<string, string> }>(
    "/:projectId/api-keys",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      if (!store.get(projectId)) {
        return reply.status(404).send({ error: "Project not found" });
      }
      store.saveApiKeys(projectId, request.body as Record<string, string>);
      return { message: "API keys updated" };
    },
  );

  // PUT /customers/:customerId/projects/:projectId/project-brief
  app.put<{ Params: { customerId: string; projectId: string }; Body: { content: string } }>(
    "/:projectId/project-brief",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      if (!store.get(projectId)) {
        return reply.status(404).send({ error: "Project not found" });
      }
      const { content } = request.body as { content: string };
      store.saveProjectBrief(projectId, content);
      return { message: "Project brief updated" };
    },
  );

  // POST /customers/:customerId/projects/:projectId/sync — Sync data from connector
  app.post<{ Params: { customerId: string; projectId: string } }>(
    "/:projectId/sync",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      const project = store.get(projectId);
      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const gh = (project as unknown as Record<string, unknown>).connector as {
        type: string;
        github?: {
          installationId: number;
          owner: string;
          repo: string;
          branch: string;
          categoriesPath?: string;
          authorsPath?: string;
        };
      };

      if (gh?.type !== "github" || !gh.github?.installationId || !gh.github.owner || !gh.github.repo) {
        return reply.status(400).send({ error: "No GitHub connector configured" });
      }

      const { installationId, owner, repo, branch, categoriesPath, authorsPath } = gh.github;
      const result: { categories?: unknown[]; authors?: unknown[]; errors: string[] } = { errors: [] };

      // Sync categories
      if (categoriesPath) {
        try {
          const raw = await getFileContent(installationId, owner, repo, categoriesPath, branch);
          result.categories = JSON.parse(raw);
          syncLog.info({ projectId, path: categoriesPath, count: result.categories!.length }, "categories synced");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`categories: ${msg}`);
          syncLog.warn({ projectId, path: categoriesPath, error: msg }, "categories sync failed");
        }
      }

      // Sync authors
      if (authorsPath) {
        try {
          const raw = await getFileContent(installationId, owner, repo, authorsPath, branch);
          result.authors = JSON.parse(raw);
          syncLog.info({ projectId, path: authorsPath, count: result.authors!.length }, "authors synced");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`authors: ${msg}`);
          syncLog.warn({ projectId, path: authorsPath, error: msg }, "authors sync failed");
        }
      }

      return result;
    },
  );
}
