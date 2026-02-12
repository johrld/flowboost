import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";
import { ContentIndexStore } from "../../models/content-index.js";
import { SyncService } from "../../services/sync.js";
import { createSiteConnector } from "../../connectors/site/factory.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";

const log = createLogger("webhooks");

// Track processed delivery IDs for idempotency
const processedDeliveries = new Set<string>();
const MAX_DELIVERY_CACHE = 1000;

/**
 * Central webhook router — receives events from all platforms.
 * Returns 200 immediately, processes async in background.
 */
export async function webhookRoutes(app: FastifyInstance) {
  const indexStore = new ContentIndexStore(app.ctx.dataDir);
  const syncService = new SyncService(indexStore, parseFrontmatter);

  // Custom parser to preserve raw body for HMAC verification
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

  // POST /webhooks/github — GitHub App events
  app.post("/github", async (request, reply) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      log.error("GITHUB_WEBHOOK_SECRET not configured");
      return reply.status(500).send({ error: "Webhook secret not configured" });
    }

    // Verify HMAC signature
    const signature = request.headers["x-hub-signature-256"] as string | undefined;
    if (!signature) {
      return reply.status(401).send({ error: "Missing signature" });
    }

    const { raw, parsed } = request.body as {
      raw: Buffer;
      parsed: Record<string, unknown>;
    };
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(raw).digest("hex");

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      log.warn("invalid webhook signature");
      return reply.status(401).send({ error: "Invalid signature" });
    }

    const event = request.headers["x-github-event"] as string;
    const deliveryId = request.headers["x-github-delivery"] as string;
    const action = parsed.action as string | undefined;

    log.info({ event, action, deliveryId }, "webhook received");

    // Idempotency: skip if already processed
    if (deliveryId && processedDeliveries.has(deliveryId)) {
      log.info({ deliveryId }, "duplicate delivery, skipping");
      return reply.status(200).send({ ok: true, skipped: true });
    }

    // Return 200 immediately (GitHub has 10s timeout)
    reply.status(200).send({ ok: true, processing: "async" });

    // Track delivery ID
    if (deliveryId) {
      processedDeliveries.add(deliveryId);
      if (processedDeliveries.size > MAX_DELIVERY_CACHE) {
        // Remove oldest entries
        const iter = processedDeliveries.values();
        for (let i = 0; i < 200; i++) iter.next();
        const toKeep = new Set<string>();
        for (const v of iter) toKeep.add(v);
        processedDeliveries.clear();
        for (const v of toKeep) processedDeliveries.add(v);
      }
    }

    // Process async
    setImmediate(async () => {
      try {
        if (event === "push") {
          await handleGitHubPush(app, parsed, syncService);
        } else if (
          event === "installation" &&
          (action === "deleted" || action === "suspend")
        ) {
          await handleGitHubDisconnect(app, parsed, action);
        }
      } catch (err) {
        log.error({ err, event }, "webhook processing failed");
      }
    });
  });

  // Placeholder for future platforms:
  // app.post("/wordpress", ...)
  // app.post("/shopify", ...)
}

/**
 * Handle GitHub push event — trigger delta sync for affected project.
 */
async function handleGitHubPush(
  app: FastifyInstance,
  payload: Record<string, unknown>,
  syncService: SyncService,
) {
  const repository = payload.repository as {
    full_name: string;
    owner: { login: string };
    name: string;
  } | undefined;

  if (!repository) return;

  const installationId = (payload.installation as { id: number })?.id;
  if (!installationId) return;

  const ref = payload.ref as string;
  const branch = ref?.replace("refs/heads/", "");

  // Find the project using this repo
  const customers = app.ctx.customers.list();
  for (const customer of customers) {
    const projects = app.ctx.projectsFor(customer.id).list();
    for (const project of projects) {
      const ghConfig = project.connector?.github;
      if (
        ghConfig &&
        ghConfig.installationId === installationId &&
        ghConfig.owner === repository.owner.login &&
        ghConfig.repo === repository.name &&
        ghConfig.branch === branch
      ) {
        log.info(
          {
            customerId: customer.id,
            projectId: project.id,
            repo: repository.full_name,
            branch,
          },
          "push event matched project, starting delta sync",
        );

        const connector = createSiteConnector(project);
        const reader = connector.createReader();

        const result = await syncService.deltaSync(
          customer.id,
          project.id,
          reader,
        );

        log.info(
          { customerId: customer.id, projectId: project.id, ...result },
          "push sync complete",
        );
      }
    }
  }
}

/**
 * Handle GitHub installation deleted/suspended — disconnect affected projects.
 */
async function handleGitHubDisconnect(
  app: FastifyInstance,
  payload: Record<string, unknown>,
  reason: string,
) {
  const installationId = (payload.installation as { id: number })?.id;
  if (!installationId) return;

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
        log.info(
          {
            customerId: customer.id,
            projectId: project.id,
            installationId,
            reason,
          },
          "disconnected GitHub connector",
        );
      }
    }
  }

  log.info({ installationId, disconnected, reason }, "installation cleanup done");
}
