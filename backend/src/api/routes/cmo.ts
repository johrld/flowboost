import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { runSimpleAgent, getMcpServerPath } from "../../pipeline/engine.js";
import { readChat, appendChat } from "../../models/chat.js";
import { MemoryStore } from "../../models/memory.js";
import { loadSkills } from "../../agents/executor.js";
import { getAgent, listAgents } from "../../agents/registry.js";
import type { ChatMessage } from "../../models/types.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("cmo-chat");

const CMO_CHAT_FILE = "cmo-chat.jsonl";

function getCmoChatDir(dataDir: string, customerId: string, projectId: string): string {
  return path.join(dataDir, "customers", customerId, "projects", projectId);
}

/**
 * Build the project-level CMO system prompt (no specific topic context).
 */
function buildProjectCmoPrompt(projectDir: string, projectName: string): string {
  const cmoAgent = getAgent("cmo");
  const skillContent = loadSkills(cmoAgent?.skills ?? ["flowboost-api", "cmo"]);

  const parts: string[] = [skillContent];

  parts.push(`\n## Project: ${projectName}`);
  parts.push("You are in the project-level chat — not within a specific flow. Help with overall content strategy.");

  // Project Memory
  const memory = new MemoryStore(projectDir);
  const allMemory = memory.getAll();
  if (Object.keys(allMemory).length > 0) {
    parts.push("\n## Project Memory");
    for (const [key, value] of Object.entries(allMemory)) {
      const label = key.replace(/\./g, " / ").replace(/-/g, " ");
      const json = JSON.stringify(value);
      parts.push(`\n### ${label}\n${json.length > 2000 ? json.slice(0, 2000) + "..." : json}`);
    }
  }

  // Content Index Summary
  const indexPath = path.join(projectDir, "content-index.json");
  if (fs.existsSync(indexPath)) {
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      const entries = index.entries ?? [];
      if (entries.length > 0) {
        parts.push(`\n## Content Portfolio\n${entries.length} published items.`);
        const summary = entries.slice(0, 20).map((e: { site?: { translationKey: string }; status: string }) =>
          `- ${e.site?.translationKey ?? "unknown"} (${e.status})`
        ).join("\n");
        parts.push(summary);
        if (entries.length > 20) parts.push(`... and ${entries.length - 20} more`);
      }
    } catch { /* ignore */ }
  }

  // Topics summary
  const topicsDir = path.join(projectDir, "topics");
  if (fs.existsSync(topicsDir)) {
    const topicDirs = fs.readdirSync(topicsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    if (topicDirs.length > 0) {
      parts.push(`\n## Active Flows\n${topicDirs.length} flows in this project.`);
    }
  }

  // Memory meta (last scan times)
  const meta = memory.getMeta();
  if (Object.keys(meta.lastUpdated).length > 0) {
    parts.push("\n## Memory Status");
    for (const [file, ts] of Object.entries(meta.lastUpdated)) {
      parts.push(`- ${file}: last updated ${ts} by ${meta.lastRunBy[file] ?? "unknown"}`);
    }
  }

  return parts.join("\n");
}

/**
 * Project-level CMO chat routes.
 * Prefix: /customers/:customerId/projects/:projectId/cmo
 */
export async function cmoRoutes(app: FastifyInstance) {
  // GET /cmo/chat — get chat history
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/chat",
    async (request) => {
      const { customerId, projectId } = request.params;
      const dir = getCmoChatDir(app.ctx.dataDir, customerId, projectId);
      const filePath = path.join(dir, CMO_CHAT_FILE);
      if (!fs.existsSync(filePath)) return [];
      const content = fs.readFileSync(filePath, "utf-8").trim();
      if (!content) return [];
      return content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as ChatMessage);
    },
  );

  // POST /cmo/chat — send message
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { message: string };
  }>(
    "/chat",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const { message } = (request.body ?? {}) as { message?: string };

      if (!message?.trim()) {
        return reply.status(400).send({ error: "Message is required" });
      }

      const projectDir = path.join(app.ctx.dataDir, "customers", customerId, "projects", projectId);
      const chatDir = getCmoChatDir(app.ctx.dataDir, customerId, projectId);
      const chatFile = path.join(chatDir, CMO_CHAT_FILE);

      // Read history
      let history: ChatMessage[] = [];
      if (fs.existsSync(chatFile)) {
        const content = fs.readFileSync(chatFile, "utf-8").trim();
        if (content) {
          history = content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as ChatMessage);
        }
      }

      // Append user message
      const userMsg: ChatMessage = { role: "user", content: message.trim(), ts: new Date().toISOString() };
      fs.mkdirSync(chatDir, { recursive: true });
      fs.appendFileSync(chatFile, JSON.stringify(userMsg) + "\n", "utf-8");

      // Build conversation
      const promptParts: string[] = [];
      if (history.length > 0) {
        promptParts.push("Previous conversation:");
        for (const msg of history.slice(-20)) { // last 20 messages for context
          promptParts.push(`${msg.role === "user" ? "User" : "CMO"}: ${msg.content}`);
        }
        promptParts.push("");
      }
      promptParts.push(`User: ${message.trim()}`);

      try {
        // Get project name
        const project = app.ctx.projectsFor(customerId).get(projectId);
        const projectName = project?.name ?? "Unknown Project";

        // MCP server config
        const mcpServers = {
          flowboost: {
            command: "node",
            args: [getMcpServerPath()],
            env: {
              FLOWBOOST_DATA_DIR: app.ctx.dataDir,
              FLOWBOOST_CUSTOMER_DIR: path.join(app.ctx.dataDir, "customers", customerId),
              FLOWBOOST_PROJECT_DIR: projectDir,
              GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
            },
          },
        };

        const cmoAgent = getAgent("cmo");
        const result = await runSimpleAgent(promptParts.join("\n"), {
          model: "sonnet",
          maxTurns: cmoAgent?.maxTurns ?? 5,
          systemPrompt: buildProjectCmoPrompt(projectDir, projectName),
          allowedTools: cmoAgent?.tools,
          mcpServers,
        });

        // Append assistant response
        const assistantMsg: ChatMessage = { role: "assistant", content: result.text, ts: new Date().toISOString() };
        fs.appendFileSync(chatFile, JSON.stringify(assistantMsg) + "\n", "utf-8");

        return { reply: result.text };
      } catch (err) {
        log.error({ err }, "CMO chat failed");
        return reply.status(500).send({ error: "CMO chat failed" });
      }
    },
  );

  // GET /cmo/agents — list all registered agents
  app.get("/agents", async () => {
    return listAgents().map((a) => ({
      name: a.name,
      role: a.role,
      model: a.model,
      canDelegate: a.canDelegate,
      heartbeat: a.heartbeat,
    }));
  });

  // GET /cmo/memory — get memory status
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/memory",
    async (request) => {
      const { customerId, projectId } = request.params;
      const memory = app.ctx.memoryFor(customerId, projectId);
      return {
        meta: memory.getMeta(),
        files: memory.listFiles(),
      };
    },
  );
}
