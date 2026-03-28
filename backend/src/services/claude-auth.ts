import { execSync } from "node:child_process";
import { createLogger } from "../utils/logger.js";

const log = createLogger("claude-auth");

export interface ClaudeAuthStatus {
  authenticated: boolean;
  method: "cli" | "api-key" | "auth-token" | null;
  subscriptionType?: string;
}

let cachedStatus: ClaudeAuthStatus | null = null;

/** Check Claude authentication status (cached after first call) */
export function getClaudeAuthStatus(): ClaudeAuthStatus {
  if (cachedStatus) return cachedStatus;

  try {
    const raw = execSync("claude auth status", { encoding: "utf-8", timeout: 5000 });
    const status = JSON.parse(raw);
    if (status.loggedIn) {
      cachedStatus = { authenticated: true, method: "cli", subscriptionType: status.subscriptionType };
      log.info({ authMethod: status.authMethod, subscriptionType: status.subscriptionType }, "Claude CLI authenticated");
    } else {
      cachedStatus = { authenticated: false, method: null };
      log.warn("Claude CLI not authenticated — pipelines will fail");
    }
  } catch {
    if (process.env.ANTHROPIC_API_KEY) {
      cachedStatus = { authenticated: true, method: "api-key" };
      log.info("Claude auth: using ANTHROPIC_API_KEY");
    } else if (process.env.ANTHROPIC_AUTH_TOKEN) {
      cachedStatus = { authenticated: true, method: "auth-token" };
      log.info("Claude auth: using ANTHROPIC_AUTH_TOKEN");
    } else {
      cachedStatus = { authenticated: false, method: null };
      log.warn("Claude CLI not found or not authenticated — pipelines will fail");
      log.warn("Fix: set ANTHROPIC_API_KEY in .env, or run: docker compose exec api claude auth login");
    }
  }

  return cachedStatus;
}
