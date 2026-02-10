import type { FastifyInstance } from "fastify";
import { isConfigured, listRepos, listBranches } from "../../services/github.js";

/**
 * GitHub App auth routes (/auth/github/*) and API routes (/github/*).
 */
export async function githubAuthRoutes(app: FastifyInstance) {
  // GET /auth/github/install — Redirect to GitHub App installation page
  app.get("/github/install", async (_request, reply) => {
    const appSlug = process.env.GITHUB_APP_SLUG ?? "flowboost";
    return reply.redirect(`https://github.com/apps/${appSlug}/installations/new`);
  });

  // GET /auth/github/callback — Receives installation_id after user installs the app
  app.get<{
    Querystring: {
      installation_id?: string;
      setup_action?: string;
    };
  }>("/github/callback", async (request, reply) => {
    const { installation_id, setup_action } = request.query;

    if (!installation_id) {
      return reply.redirect(
        `${process.env.FRONTEND_URL ?? "http://localhost:6001"}/settings?tab=connector&github=error&reason=no_installation_id`,
      );
    }

    // Redirect to frontend with installation_id so it can update the project connector
    return reply.redirect(
      `${process.env.FRONTEND_URL ?? "http://localhost:6001"}/settings?tab=connector&github=connected&installation_id=${installation_id}`,
    );
  });
}

export async function githubApiRoutes(app: FastifyInstance) {
  // GET /github/status — Check if GitHub App is configured
  app.get("/status", async () => {
    return { configured: isConfigured() };
  });

  // GET /github/installations/:installationId/repos — List repos for an installation
  app.get<{ Params: { installationId: string } }>(
    "/installations/:installationId/repos",
    async (request, reply) => {
      const installationId = Number(request.params.installationId);
      if (!installationId) {
        return reply.status(400).send({ error: "Invalid installation ID" });
      }

      try {
        const repos = await listRepos(installationId);
        return repos.map((r) => ({
          fullName: r.full_name,
          name: r.name,
          owner: r.owner.login,
          defaultBranch: r.default_branch,
          private: r.private,
        }));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return reply.status(502).send({ error: `GitHub API error: ${msg}` });
      }
    },
  );

  // GET /github/repos/:owner/:repo/branches — List branches for a repo
  app.get<{
    Params: { owner: string; repo: string };
    Querystring: { installation_id: string };
  }>(
    "/repos/:owner/:repo/branches",
    async (request, reply) => {
      const { owner, repo } = request.params;
      const installationId = Number(request.query.installation_id);

      if (!installationId) {
        return reply.status(400).send({ error: "installation_id query parameter required" });
      }

      try {
        const branches = await listBranches(installationId, owner, repo);
        return branches;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return reply.status(502).send({ error: `GitHub API error: ${msg}` });
      }
    },
  );
}
