import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { isConfigured, listRepos, listBranches } from "../../services/github.js";
import { createLogger } from "../../utils/logger.js";

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

const webhookLog = createLogger("github-webhook");

export async function githubWebhookRoutes(app: FastifyInstance) {
  // Custom parser to preserve raw body for HMAC signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body: Buffer, done) => {
      try {
        done(null, { raw: body, parsed: JSON.parse(body.toString()) });
      } catch (err) {
        done(err as Error);
      }
    },
  );

  // POST /github/webhook — Receive GitHub App events
  app.post("/webhook", async (request, reply) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      webhookLog.error("GITHUB_WEBHOOK_SECRET not configured");
      return reply.status(500).send({ error: "Webhook secret not configured" });
    }

    // Verify signature
    const signature = request.headers["x-hub-signature-256"] as string | undefined;
    if (!signature) {
      return reply.status(401).send({ error: "Missing signature" });
    }

    const { raw, parsed } = request.body as { raw: Buffer; parsed: Record<string, unknown> };
    const expected =
      "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      webhookLog.warn("Invalid webhook signature");
      return reply.status(401).send({ error: "Invalid signature" });
    }

    const event = request.headers["x-github-event"] as string;
    const action = parsed.action as string | undefined;
    webhookLog.info({ event, action }, "webhook received");

    // Handle installation deleted/suspended → disconnect affected projects
    if (event === "installation" && (action === "deleted" || action === "suspend")) {
      const installationId = (parsed.installation as { id: number })?.id;
      if (installationId) {
        await disconnectInstallation(app, installationId, action);
      }
    }

    return { ok: true };
  });
}

/** Find all projects using this GitHub installation and clear their connector. */
async function disconnectInstallation(
  app: FastifyInstance,
  installationId: number,
  reason: string,
) {
  const customers = app.ctx.customers.list();
  let disconnected = 0;

  for (const customer of customers) {
    const projects = app.ctx.projectsFor(customer.id).list();
    for (const project of projects) {
      if (
        project.connector?.type === "github" &&
        project.connector.github?.installationId === installationId
      ) {
        app.ctx.projectsFor(customer.id).update(project.id, {
          connector: { type: "filesystem" },
          updatedAt: new Date().toISOString(),
        } as Partial<typeof project>);
        disconnected++;
        webhookLog.info(
          { customerId: customer.id, projectId: project.id, installationId, reason },
          "disconnected GitHub connector",
        );
      }
    }
  }

  webhookLog.info({ installationId, disconnected, reason }, "installation cleanup done");
}
