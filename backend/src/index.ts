import path from "node:path";
import { buildServer } from "./api/server.js";
import { CustomerStore } from "./models/customer.js";
import { createLogger } from "./utils/logger.js";
import { getClaudeAuthStatus } from "./services/claude-auth.js";

const log = createLogger("main");

const port = parseInt(process.env.PORT ?? "6100", 10);
const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");

async function main() {
  getClaudeAuthStatus(); // check + log on startup

  // Auto-seed default customer on first run (empty data volume)
  const customerStore = new CustomerStore(dataDir);
  if (customerStore.list().length === 0) {
    const now = new Date().toISOString();
    customerStore.create({
      name: "FlowBoost User",
      slug: "default",
      plan: "pro" as const,
      authors: [],
      createdAt: now,
      updatedAt: now,
    });
    log.info("Created default customer (first run)");
  }

  const app = await buildServer(dataDir);

  await app.listen({ port, host: "0.0.0.0" });
  log.info({ port, dataDir }, "FlowBoost server started");
}

main().catch((err) => {
  log.fatal(err, "failed to start server");
  process.exit(1);
});
