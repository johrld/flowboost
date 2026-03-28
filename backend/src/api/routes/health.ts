import type { FastifyInstance } from "fastify";
import { getClaudeAuthStatus } from "../../services/claude-auth.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    claude: getClaudeAuthStatus(),
  }));
}
