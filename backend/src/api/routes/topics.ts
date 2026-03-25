import type { FastifyInstance } from "fastify";
import { runSimpleAgent } from "../../pipeline/engine.js";
import { readChat, appendChat } from "../../models/chat.js";
import { PipelineContext } from "../../pipeline/context.js";
import { runProductionPipeline } from "../../pipeline/production/run.js";
import { runSocialPipeline } from "../../pipeline/social/run.js";
import { runEmailPipeline } from "../../pipeline/email/run.js";
import type { ChatMessage, Topic, BriefingInputType } from "../../models/types.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("topic-chat");

function buildSystemPrompt(topic: Topic): string {
  const parts = [
    "You are a content strategist helping refine a content brief. Be concise and actionable.",
    "",
    `## Current Brief`,
    `- **Title:** ${topic.title}`,
    `- **Format:** ${topic.format ?? "article"}`,
    `- **Category:** ${topic.category || "not set"}`,
    `- **Search Intent:** ${topic.searchIntent}`,
  ];

  if (topic.keywords?.primary) {
    parts.push(`- **Primary Keyword:** ${topic.keywords.primary}`);
    if (topic.keywords.secondary?.length > 0)
      parts.push(`- **Secondary Keywords:** ${topic.keywords.secondary.join(", ")}`);
    if (topic.keywords.longTail?.length > 0)
      parts.push(`- **Long-tail Keywords:** ${topic.keywords.longTail.join(", ")}`);
  }

  if (topic.suggestedAngle) parts.push(`- **Angle:** ${topic.suggestedAngle}`);
  if (topic.competitorInsights) parts.push(`\n## Competitor Insights\n${topic.competitorInsights}`);
  if (topic.reasoning) parts.push(`\n## AI Analysis\n${topic.reasoning}`);
  if (topic.userNotes) parts.push(`\n## User Notes\n${topic.userNotes}`);

  parts.push(
    "",
    "## Your Role",
    "Help the user refine this topic. Suggest better angles, keywords, titles, or structure.",
    "If the user asks you to change the title, keywords, or angle, include a JSON block at the end of your response:",
    "```json",
    '{"updates": {"title": "...", "suggestedAngle": "...", "keywords": {"primary": "...", "secondary": [...]}}}',
    "```",
    "Only include fields that should change. The user will confirm before applying.",
  );

  return parts.join("\n");
}

export async function topicRoutes(app: FastifyInstance) {
  // GET /customers/:customerId/projects/:projectId/topics
  app.get<{ Params: { customerId: string; projectId: string } }>("/", async (request) => {
    const { customerId, projectId } = request.params;
    return app.ctx.topicsFor(customerId, projectId).list();
  });

  // POST /customers/:customerId/projects/:projectId/topics
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { title: string; category?: string; userNotes?: string; format?: string };
  }>("/", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { title, category, userNotes, format } = (request.body ?? {}) as {
      title?: string;
      category?: string;
      userNotes?: string;
      format?: string;
    };

    if (!title?.trim()) {
      return reply.status(400).send({ error: "Title is required" });
    }

    const validFormats = ["article", "guide", "landing_page", "social_post"] as const;
    const topicFormat = validFormats.includes(format as typeof validFormats[number])
      ? (format as typeof validFormats[number])
      : "article";

    const topic = app.ctx.topicsFor(customerId, projectId).create({
      status: "proposed",
      title: title.trim(),
      category: category || "",
      priority: 0,
      keywords: { primary: "", secondary: [], longTail: [] },
      searchIntent: "informational",
      competitorInsights: "",
      suggestedAngle: "",
      estimatedSections: 0,
      reasoning: "",
      format: topicFormat,
      source: "user",
      enriched: false,
      userNotes: userNotes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    });

    return reply.status(201).send(topic);
  });

  // GET /customers/:customerId/projects/:projectId/topics/:topicId
  app.get<{ Params: { customerId: string; projectId: string; topicId: string } }>(
    "/:topicId",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const topic = app.ctx.topicsFor(customerId, projectId).get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }
      return topic;
    },
  );

  // PATCH /customers/:customerId/projects/:projectId/topics/:topicId
  app.patch<{
    Params: { customerId: string; projectId: string; topicId: string };
    Body: Partial<Topic>;
  }>(
    "/:topicId",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      const body = (request.body ?? {}) as Record<string, unknown>;
      const safeFields = [
        "title", "category", "keywords", "suggestedAngle", "searchIntent",
        "estimatedSections", "format", "userNotes", "scheduledDate",
      ];
      const updates: Record<string, unknown> = {};

      for (const key of Object.keys(body)) {
        if (safeFields.includes(key)) {
          updates[key] = body[key];
        }
      }

      // Validate title if present
      if (updates.title !== undefined && !String(updates.title).trim()) {
        return reply.status(400).send({ error: "Title cannot be empty" });
      }

      // Validate scheduledDate format if present
      if (updates.scheduledDate !== undefined && updates.scheduledDate !== null) {
        if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(String(updates.scheduledDate))) {
          return reply.status(400).send({ error: "Invalid scheduledDate format. Use YYYY-MM-DD or YYYY-MM-DDTHH:mm" });
        }
      }

      if (Object.keys(updates).length === 0) {
        return { message: "No changes", topic };
      }

      topics.update(topicId, updates);
      return { message: "Topic updated", topic: topics.get(topicId) };
    },
  );

  // POST /customers/:customerId/projects/:projectId/topics/:topicId/approve
  app.post<{ Params: { customerId: string; projectId: string; topicId: string } }>(
    "/:topicId/approve",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      topics.update(topicId, {
        status: "approved",
        approvedAt: new Date().toISOString(),
      });

      return { message: "Topic approved", topic: topics.get(topicId) };
    },
  );

  // POST /customers/:customerId/projects/:projectId/topics/:topicId/reject
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string };
    Body: { reason?: string };
  }>(
    "/:topicId/reject",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      const { reason } = (request.body ?? {}) as { reason?: string };
      topics.update(topicId, {
        status: "rejected",
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
      });

      return { message: "Topic rejected", topic: topics.get(topicId) };
    },
  );

  // POST /customers/:customerId/projects/:projectId/topics/:topicId/restore
  app.post<{ Params: { customerId: string; projectId: string; topicId: string } }>(
    "/:topicId/restore",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      if (topic.status !== "rejected") {
        return reply.status(400).send({ error: "Only rejected topics can be restored" });
      }

      topics.update(topicId, {
        status: "proposed",
        rejectedAt: undefined,
        rejectionReason: undefined,
      });

      return { message: "Topic restored", topic: topics.get(topicId) };
    },
  );

  // GET /customers/:customerId/projects/:projectId/topics/:topicId/chat
  app.get<{ Params: { customerId: string; projectId: string; topicId: string } }>(
    "/:topicId/chat",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }
      const dir = topics.entityDir(topicId);
      return readChat(dir);
    },
  );

  // POST /customers/:customerId/projects/:projectId/topics/:topicId/chat
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string };
    Body: { message: string };
  }>(
    "/:topicId/chat",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const { message } = (request.body ?? {}) as { message?: string };

      if (!message?.trim()) {
        return reply.status(400).send({ error: "Message is required" });
      }

      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      const dir = topics.entityDir(topicId);
      const history = readChat(dir);

      // Append user message
      const userMsg: ChatMessage = { role: "user", content: message.trim(), ts: new Date().toISOString() };
      appendChat(dir, userMsg);

      // Build conversation prompt: history + new message
      const promptParts: string[] = [];
      if (history.length > 0) {
        promptParts.push("Previous conversation:");
        for (const msg of history) {
          promptParts.push(`${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`);
        }
        promptParts.push("");
      }
      promptParts.push(`User: ${message.trim()}`);

      try {
        const result = await runSimpleAgent(promptParts.join("\n"), {
          model: "sonnet",
          maxTurns: 1,
          systemPrompt: buildSystemPrompt(topic),
        });

        const assistantText = result.text;

        // Append assistant message
        const assistantMsg: ChatMessage = { role: "assistant", content: assistantText, ts: new Date().toISOString() };
        appendChat(dir, assistantMsg);

        // Check if response contains field updates
        const jsonMatch = assistantText.match(/```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?\s*```/i);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]) as { updates?: Partial<Topic> };
            if (parsed.updates && Object.keys(parsed.updates).length > 0) {
              return { reply: assistantText, topic, suggestedUpdates: parsed.updates };
            }
          } catch {
            // JSON parse failed, ignore
          }
        }

        return { reply: assistantText, topic };
      } catch (err) {
        log.error({ err }, "Chat API call failed");
        return reply.status(500).send({ error: "AI chat failed" });
      }
    },
  );

  // POST /customers/:customerId/projects/:projectId/topics/:topicId/chat/apply
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string };
    Body: { updates: Partial<Topic> };
  }>(
    "/:topicId/chat/apply",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const { updates } = (request.body ?? {}) as { updates?: Partial<Topic> };

      if (!updates || Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: "No updates provided" });
      }

      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      // Only allow safe fields to be updated via chat
      const safeFields = ["title", "suggestedAngle", "keywords", "searchIntent", "estimatedSections"];
      const safeUpdates: Record<string, unknown> = {};
      for (const key of Object.keys(updates)) {
        if (safeFields.includes(key)) {
          safeUpdates[key] = (updates as Record<string, unknown>)[key];
        }
      }

      if (Object.keys(safeUpdates).length === 0) {
        return reply.status(400).send({ error: "No valid fields to update" });
      }

      topics.update(topicId, safeUpdates);
      return { message: "Topic updated", topic: topics.get(topicId) };
    },
  );

  // ── Briefing Input Endpoints ──────────────────────────────

  // POST /topics/:topicId/inputs — Add text/URL input
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string };
    Body: { type: BriefingInputType; content: string; fileName?: string };
  }>(
    "/:topicId/inputs",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const { type, content, fileName } = (request.body ?? {}) as {
        type?: BriefingInputType;
        content?: string;
        fileName?: string;
      };

      if (!type || !content?.trim()) {
        return reply.status(400).send({ error: "type and content are required" });
      }

      const validTypes: BriefingInputType[] = ["text", "transcript", "image", "url", "document"];
      if (!validTypes.includes(type)) {
        return reply.status(400).send({ error: `Invalid input type. Must be one of: ${validTypes.join(", ")}` });
      }

      const topics = app.ctx.topicsFor(customerId, projectId);
      const input = topics.addInput(topicId, { type, content: content.trim(), fileName });
      if (!input) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      return reply.status(201).send(input);
    },
  );

  // POST /topics/:topicId/inputs/upload — Upload file input
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string };
  }>(
    "/:topicId/inputs/upload",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      const mimeType = file.mimetype;
      const fileName = file.filename;

      // Validate MIME type (allowlist)
      const ALLOWED_MIMES = [
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
        "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm", "audio/x-m4a",
        "application/pdf",
        "text/plain", "text/markdown", "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!ALLOWED_MIMES.some((m) => mimeType === m || (m.endsWith("/*") && mimeType.startsWith(m.replace("/*", "/"))))) {
        return reply.status(400).send({ error: `File type not allowed: ${mimeType}` });
      }

      const buffer = await file.toBuffer();

      // Determine input type from mime
      let inputType: BriefingInputType = "document";
      if (mimeType.startsWith("image/")) inputType = "image";
      else if (mimeType.startsWith("audio/")) inputType = "transcript";

      const topics = app.ctx.topicsFor(customerId, projectId);
      const input = topics.addFileInput(topicId, { buffer, fileName, mimeType }, inputType);
      if (!input) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      return reply.status(201).send(input);
    },
  );

  // DELETE /topics/:topicId/inputs/:inputId — Remove input
  app.delete<{
    Params: { customerId: string; projectId: string; topicId: string; inputId: string };
  }>(
    "/:topicId/inputs/:inputId",
    async (request, reply) => {
      const { customerId, projectId, topicId, inputId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);

      const removed = topics.removeInput(topicId, inputId);
      if (!removed) {
        return reply.status(404).send({ error: "Topic or input not found" });
      }

      return { message: "Input removed" };
    },
  );

  // GET /topics/:topicId/inputs/:inputId/file — Serve file input
  app.get<{
    Params: { customerId: string; projectId: string; topicId: string; inputId: string };
  }>(
    "/:topicId/inputs/:inputId/file",
    async (request, reply) => {
      const { customerId, projectId, topicId, inputId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);

      const filePath = topics.getInputFilePath(topicId, inputId);
      if (!filePath) {
        return reply.status(404).send({ error: "File not found" });
      }

      const topic = topics.get(topicId);
      const input = (topic?.inputs ?? []).find((i) => i.id === inputId);
      const mimeType = input?.mimeType ?? "application/octet-stream";

      const fs = await import("node:fs");
      const stream = fs.createReadStream(filePath);
      return reply.type(mimeType).send(stream);
    },
  );

  // ── Briefing Produce Endpoint ─────────────────────────────

  // POST /topics/:topicId/produce — Create output from briefing
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string };
    Body: { type: string; platform?: string };
  }>(
    "/:topicId/produce",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const { type, platform } = (request.body ?? {}) as { type?: string; platform?: string };

      if (!type) {
        return reply.status(400).send({ error: "type is required (article, social_post, newsletter)" });
      }

      const validTypes = ["article", "guide", "social_post", "newsletter"] as const;
      if (!validTypes.includes(type as typeof validTypes[number])) {
        return reply.status(400).send({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
      }

      const validPlatforms = ["linkedin", "instagram", "x", "tiktok"] as const;
      if (type === "social_post" && platform && !validPlatforms.includes(platform as typeof validPlatforms[number])) {
        return reply.status(400).send({ error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}` });
      }

      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      const project = app.ctx.projectsFor(customerId).get(projectId);
      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      // Create ContentItem linked to this briefing
      const now = new Date().toISOString();
      const contentItem = app.ctx.contentFor(customerId, projectId).create({
        customerId,
        projectId,
        type: type as "article" | "social_post" | "newsletter",
        status: "planned",
        title: topic.title,
        category: topic.category,
        keywords: topic.keywords ? [topic.keywords.primary, ...topic.keywords.secondary] : undefined,
        topicId,
        briefingId: topicId,
        createdAt: now,
        updatedAt: now,
      });

      // Add to briefing outputs
      topics.addOutput(topicId, contentItem.id);

      // Determine pipeline type and start asynchronously
      const pipelineType = type === "social_post" ? "social_production" as const
        : type === "newsletter" ? "email_production" as const
        : "production" as const;

      // Create pipeline run
      const phases = type === "social_post"
        ? [{ name: "generate", status: "pending" as const, agentCalls: [] }, { name: "image", status: "pending" as const, agentCalls: [] }]
        : type === "newsletter"
        ? [{ name: "generate", status: "pending" as const, agentCalls: [] }]
        : [
            { name: "outline", status: "pending" as const, agentCalls: [] },
            { name: "writing", status: "pending" as const, agentCalls: [] },
            { name: "assembly", status: "pending" as const, agentCalls: [] },
            { name: "image", status: "pending" as const, agentCalls: [] },
            { name: "quality", status: "pending" as const, agentCalls: [] },
            { name: "translation", status: "pending" as const, agentCalls: [] },
          ];

      const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
        customerId,
        projectId,
        type: pipelineType,
        status: "pending",
        topicId,
        phases,
        totalCostUsd: 0,
        totalTokens: { input: 0, output: 0 },
        createdAt: now,
      });

      // Build pipeline context
      const ctx = new PipelineContext(
        customerId,
        project,
        run,
        {
          customers: app.ctx.customers,
          projects: app.ctx.projectsFor(customerId),
          articles: app.ctx.articlesFor(customerId, projectId),
          content: app.ctx.contentFor(customerId, projectId),
          pipelineRuns: app.ctx.pipelineRunsFor(customerId, projectId),
          topics: app.ctx.topicsFor(customerId, projectId),
        },
        app.ctx.dataDir,
        topic,
      );

      // Fire and forget — start the appropriate pipeline
      if (type === "article" || type === "guide") {
        // Mark topic as in production (required by production pipeline)
        if (topic.status === "approved") {
          topics.update(topicId, { status: "in_production" });
        }
        runProductionPipeline(ctx).catch((err) => {
          log.error({ runId: run.id, err }, "production pipeline failed");
        });
      } else if (type === "social_post") {
        runSocialPipeline(ctx, platform ?? "linkedin").catch((err) => {
          log.error({ runId: run.id, err }, "social pipeline failed");
        });
      } else if (type === "newsletter") {
        runEmailPipeline(ctx).catch((err) => {
          log.error({ runId: run.id, err }, "email pipeline failed");
        });
      }

      return reply.status(201).send({
        message: `${type} pipeline started`,
        contentItemId: contentItem.id,
        briefingId: topicId,
        runId: run.id,
        type,
        platform,
      });
    },
  );
}
