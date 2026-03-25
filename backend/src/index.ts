import { execSync } from "node:child_process";
import path from "node:path";
import { buildServer } from "./api/server.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("main");

const port = parseInt(process.env.PORT ?? "6100", 10);
const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");

function checkClaudeAuth(): void {
  try {
    const raw = execSync("claude auth status", { encoding: "utf-8", timeout: 5000 });
    const status = JSON.parse(raw);
    if (status.loggedIn) {
      log.info({ authMethod: status.authMethod, subscriptionType: status.subscriptionType }, "Claude CLI authenticated");
    } else {
      log.warn("Claude CLI not authenticated — pipelines will fail");
      log.warn("Fix: set ANTHROPIC_API_KEY in .env, or run: docker compose exec api claude auth login");
    }
  } catch {
    if (process.env.ANTHROPIC_API_KEY) {
      log.info("Claude auth: using ANTHROPIC_API_KEY");
    } else if (process.env.ANTHROPIC_AUTH_TOKEN) {
      log.info("Claude auth: using ANTHROPIC_AUTH_TOKEN");
    } else {
      log.warn("Claude CLI not found or not authenticated — pipelines will fail");
      log.warn("Fix: set ANTHROPIC_API_KEY in .env, or run: docker compose exec api claude auth login");
    }
  }
}

async function main() {
  checkClaudeAuth();

  const app = await buildServer(dataDir);

  await app.listen({ port, host: "0.0.0.0" });
  log.info({ port, dataDir }, "FlowBoost server started");
}

main().catch((err) => {
  log.fatal(err, "failed to start server");
  process.exit(1);
});
