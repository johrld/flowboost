import path from "node:path";
import type { FastifyInstance } from "fastify";
import { runSimpleAgent } from "../../pipeline/engine.js";
import { readChat, appendChat } from "../../models/chat.js";
import { PipelineContext } from "../../pipeline/context.js";
import { runProductionPipeline } from "../../pipeline/production/run.js";
import { runContentPipeline } from "../../pipeline/content/run.js";
import { ContentTypeStore } from "../../models/content-type.js";
import type { ChatMessage, Topic, FlowInputType, ContentItem } from "../../models/types.js";
import { processInput } from "../../pipeline/ingest/process-input.js";
import { distillChat } from "../../pipeline/ingest/distill-chat.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("topic-chat");

function buildSystemPrompt(topic: Topic): string {
  const seo = topic.enrichment?.seo;
  const parts = [
    "You are a content strategist helping refine a content brief. Be concise and actionable.",
    "",
    `## Current Brief`,
    `- **Title:** ${topic.title}`,
    `- **Category:** ${topic.category || "not set"}`,
  ];

  if (seo?.searchIntent) {
    parts.push(`- **Search Intent:** ${seo.searchIntent}`);
  }

  if (seo?.keywords?.primary) {
    parts.push(`- **Primary Keyword:** ${seo.keywords.primary}`);
    if (seo.keywords.secondary?.length > 0)
      parts.push(`- **Secondary Keywords:** ${seo.keywords.secondary.join(", ")}`);
    if (seo.keywords.longTail?.length > 0)
      parts.push(`- **Long-tail Keywords:** ${seo.keywords.longTail.join(", ")}`);
  }

  if (topic.direction) parts.push(`- **Angle:** ${topic.direction}`);
  if (seo?.competitorInsights) parts.push(`\n## Competitor Insights\n${seo.competitorInsights}`);
  if (topic.enrichment?.reasoning) parts.push(`\n## AI Analysis\n${topic.enrichment.reasoning}`);
  if (topic.userNotes) parts.push(`\n## User Notes\n${topic.userNotes}`);

  // Flow Inputs — uses processed summaries when available
  const inputs = topic.inputs ?? [];
  if (inputs.length > 0) {
    parts.push("\n## Flow Inputs (uploaded by user)");
    for (const input of inputs) {
      if (input.type === "text" || input.type === "transcript") {
        if (input.processed?.status === "completed" && input.processed.summary) {
          parts.push(`\n### ${input.type === "transcript" ? "Voice Memo (Transcribed)" : "Note (Summarized)"}\n${input.processed.summary}`);
          if (input.processed.keyPoints?.length) {
            parts.push(`Key points: ${input.processed.keyPoints.join("; ")}`);
          }
        } else {
          parts.push(`\n### ${input.type === "transcript" ? "Voice Memo" : "Note"}\n${input.content.slice(0, 2000)}`);
        }
      } else if (input.type === "url") {
        if (input.processed?.status === "completed" && input.processed.summary) {
          parts.push(`- **URL:** ${input.content}\n  Summary: ${input.processed.summary}`);
        } else {
          parts.push(`- **URL:** ${input.content}`);
        }
      } else if (input.type === "image") {
        if (input.processed?.status === "completed" && input.processed.description) {
          parts.push(`- **Image (${input.fileName ?? "image"}):** ${input.processed.description}`);
        } else {
          parts.push(`- **File:** ${input.fileName ?? input.type} (${input.mimeType ?? "unknown"})`);
        }
      } else if (input.type === "document") {
        if (input.processed?.status === "completed" && input.processed.summary) {
          parts.push(`- **Document (${input.fileName ?? "document"}):** ${input.processed.summary}`);
        } else {
          parts.push(`- **File:** ${input.fileName ?? input.type} (${input.mimeType ?? "unknown"})`);
        }
      }
    }
  }

  parts.push(
    "",
    "## Your Role",
    "Help the user refine this topic. Suggest better angles, keywords, titles, or structure.",
    "If the user asks you to change the title, keywords, or angle, include a JSON block at the end of your response:",
    "```json",
    '{"updates": {"title": "...", "direction": "...", "category": "..."}}',
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
    Body: { title: string; category?: string; userNotes?: string; direction?: string };
  }>("/", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const { title, category, userNotes, direction } = (request.body ?? {}) as {
      title?: string;
      category?: string;
      userNotes?: string;
      direction?: string;
    };

    if (!title?.trim()) {
      return reply.status(400).send({ error: "Title is required" });
    }

    const topic = app.ctx.topicsFor(customerId, projectId).create({
      status: "proposed",
      title: title.trim(),
      category: category || "",
      priority: 0,
      source: "user",
      direction: direction?.trim() || undefined,
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
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      // Cleanup stale outputIds on read
      if (topic.outputIds && topic.outputIds.length > 0) {
        const content = app.ctx.contentFor(customerId, projectId);
        const valid = topic.outputIds.filter((id) => content.get(id) != null);
        if (valid.length !== topic.outputIds.length) {
          topics.update(topicId, { outputIds: valid } as Partial<Topic>);
          topic.outputIds = valid;
        }
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
        "title", "category", "briefing", "direction", "userNotes", "status",
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

      if (Object.keys(updates).length === 0) {
        return { message: "No changes", topic };
      }

      topics.update(topicId, updates);
      return { message: "Topic updated", topic: topics.get(topicId) };
    },
  );

  // DELETE /customers/:customerId/projects/:projectId/topics/:topicId
  // Default: Archive (soft-delete). ?hard=true for permanent deletion.
  app.delete<{
    Params: { customerId: string; projectId: string; topicId: string };
    Querystring: { hard?: string };
  }>(
    "/:topicId",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const hard = (request.query as { hard?: string }).hard === "true";
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      const content = app.ctx.contentFor(customerId, projectId);
      const linked = content.list().filter(
        (item) => item.topicId === topicId || item.briefingId === topicId || item.flowId === topicId,
      );

      if (hard) {
        // Hard delete: refuse if published content exists
        const published = linked.filter((item) =>
          ["published", "delivered", "approved"].includes(item.status),
        );
        if (published.length > 0) {
          return reply.status(400).send({
            error: `Cannot hard-delete: ${published.length} published/approved content piece(s) exist. Archive instead, or remove published content first.`,
          });
        }
        // Delete all linked content + flow
        for (const item of linked) content.delete(item.id);
        topics.delete(topicId);
        return { message: "Flow and content permanently deleted", deleted: linked.length };
      }

      // Soft delete (archive): content-status-aware
      const now = new Date().toISOString();
      let contentDetached = 0;
      let contentArchived = 0;

      for (const item of linked) {
        if (["published", "delivered", "approved"].includes(item.status)) {
          // Detach published content — clear flow reference but keep content
          content.update(item.id, { topicId: undefined, briefingId: undefined, flowId: undefined, updatedAt: now });
          contentDetached++;
        } else if (["planned", "producing", "draft", "review"].includes(item.status)) {
          // Archive in-progress content along with the flow
          content.update(item.id, { status: "archived" as ContentItem["status"], updatedAt: now });
          contentArchived++;
        }
      }

      // Archive the flow itself
      topics.update(topicId, { status: "archived" as Topic["status"] });

      return {
        message: "Flow archived",
        archived: true,
        contentDetached,
        contentArchived,
      };
    },
  );

  // POST /customers/:customerId/projects/:projectId/topics/:topicId/restore
  // Handles both archived flows and rejected topics
  app.post<{ Params: { customerId: string; projectId: string; topicId: string } }>(
    "/:topicId/restore",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      if (topic.status === "archived") {
        // Restore archived flow
        topics.update(topicId, { status: "proposed" as Topic["status"] });

        // Restore archived content pieces linked to this flow
        const content = app.ctx.contentFor(customerId, projectId);
        const linked = content.list().filter(
          (item) => (item.topicId === topicId || item.briefingId === topicId || item.flowId === topicId) && item.status === "archived",
        );
        for (const item of linked) {
          content.update(item.id, { status: "draft" as ContentItem["status"], updatedAt: new Date().toISOString() });
        }

        return { message: "Flow restored", contentRestored: linked.length };
      }

      if (topic.status === "rejected") {
        // Restore rejected topic
        topics.update(topicId, {
          status: "proposed",
          rejectedAt: undefined,
          rejectionReason: undefined,
        });

        return { message: "Topic restored", topic: topics.get(topicId) };
      }

      return reply.status(400).send({ error: `Cannot restore from '${topic.status}' (must be 'archived' or 'rejected')` });
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

        // Auto-generate title if still "Untitled Flow"
        if (topic.title === "Untitled Flow" && message.trim().length > 5) {
          try {
            const { callClaude } = await import("../../pipeline/ingest/process-input.js");
            const titleResponse = await callClaude([{
              type: "text",
              text: `Generate a short, descriptive title (max 6 words, no quotes) for a content flow about:\n\nUser said: "${message.trim().slice(0, 200)}"\n\nAI responded: "${assistantText.slice(0, 200)}"\n\nReturn ONLY the title, nothing else.`,
            }]);
            const newTitle = titleResponse.trim().replace(/^["']|["']$/g, "").slice(0, 60);
            if (newTitle && newTitle.length > 2) {
              topics.update(topicId, { title: newTitle });
            }
          } catch {
            // Auto-title failed, not critical
          }
        }

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
      const safeFields = ["title", "direction", "category"];
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

  // ── Flow Input Endpoints ──────────────────────────────

  // POST /topics/:topicId/inputs — Add text/URL input
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string };
    Body: { type: FlowInputType; content: string; fileName?: string };
  }>(
    "/:topicId/inputs",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const { type, content, fileName } = (request.body ?? {}) as {
        type?: FlowInputType;
        content?: string;
        fileName?: string;
      };

      if (!type || !content?.trim()) {
        return reply.status(400).send({ error: "type and content are required" });
      }

      const validTypes: FlowInputType[] = ["text", "transcript", "image", "url", "document"];
      if (!validTypes.includes(type)) {
        return reply.status(400).send({ error: `Invalid input type. Must be one of: ${validTypes.join(", ")}` });
      }

      const topics = app.ctx.topicsFor(customerId, projectId);
      const input = topics.addInput(topicId, { type, content: content.trim(), fileName });
      if (!input) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      // Fire-and-forget async processing
      processInput(topics, topicId, input).catch((err) => {
        log.error({ topicId, inputId: input.id, err }, "input processing failed");
      });

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
      if (!ALLOWED_MIMES.includes(mimeType)) {
        return reply.status(400).send({ error: `File type not allowed: ${mimeType}` });
      }

      const buffer = await file.toBuffer();

      // Determine input type from mime
      let inputType: FlowInputType = "document";
      if (mimeType.startsWith("image/")) inputType = "image";
      else if (mimeType.startsWith("audio/")) inputType = "transcript";

      const topics = app.ctx.topicsFor(customerId, projectId);
      const input = topics.addFileInput(topicId, { buffer, fileName, mimeType }, inputType);
      if (!input) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      // Fire-and-forget async processing
      processInput(topics, topicId, input).catch((err) => {
        log.error({ topicId, inputId: input.id, err }, "input processing failed");
      });

      return reply.status(201).send(input);
    },
  );

  // POST /topics/:topicId/inputs/:inputId/reprocess — Re-process input with optional note
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string; inputId: string };
    Body: { note?: string };
  }>(
    "/:topicId/inputs/:inputId/reprocess",
    async (request, reply) => {
      const { customerId, projectId, topicId, inputId } = request.params;
      const { note } = (request.body ?? {}) as { note?: string };
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      const input = (topic.inputs ?? []).find((i) => i.id === inputId);
      if (!input) return reply.status(404).send({ error: "Input not found" });

      // Reset status and optionally set new note, then re-process
      topics.updateInputProcessed(topicId, inputId, {
        status: "pending",
        ...(note ? { userNote: note } : {}),
      });

      // Re-read to get the updated input with correct processed state
      const updated = topics.get(topicId);
      const updatedInput = (updated?.inputs ?? []).find((i) => i.id === inputId);
      if (updatedInput) {
        processInput(topics, topicId, updatedInput).catch((err) => {
          log.error({ topicId, inputId, err }, "reprocessing failed");
        });
      }

      return { message: "Reprocessing started" };
    },
  );

  // POST /topics/:topicId/distill — Manually trigger chat distillation
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string };
  }>(
    "/:topicId/distill",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      const chatDir = topics.entityDir(topicId);
      const chatMessages = readChat(chatDir);
      if (chatMessages.length === 0) {
        return reply.status(400).send({ error: "No chat messages to distill" });
      }

      const distillation = await distillChat(topics, topicId, chatMessages, topic.chatDistillation);
      return { message: "Chat distilled", distillation };
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

  // ── Flow Produce Endpoint ─────────────────────────────

  // POST /topics/:topicId/produce — Create content output from flow
  // Accepts either { contentTypeId } (new) or { type, platform } (legacy compat)
  app.post<{
    Params: { customerId: string; projectId: string; topicId: string };
    Body: { contentTypeId?: string; type?: string; platform?: string };
  }>(
    "/:topicId/produce",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const body = (request.body ?? {}) as { contentTypeId?: string; type?: string; platform?: string };

      // Resolve contentTypeId — from body directly, or from legacy type+platform
      const ctStore = new ContentTypeStore(
        path.join(app.ctx.dataDir, "customers", customerId, "projects", projectId),
      );

      let contentTypeId = body.contentTypeId;
      let platform = body.platform;

      // Legacy compat: map type+platform to contentTypeId
      if (!contentTypeId && body.type) {
        const legacyMap: Record<string, string> = {
          article: "blog-post",
          guide: "blog-post",
          social_post: platform ? `${platform}-post` : "linkedin-post",
          newsletter: "newsletter",
        };
        contentTypeId = legacyMap[body.type];
      }

      if (!contentTypeId) {
        return reply.status(400).send({ error: "contentTypeId is required (e.g. 'blog-post', 'linkedin-post', 'newsletter')" });
      }

      const contentType = ctStore.get(contentTypeId);
      if (!contentType) {
        return reply.status(400).send({ error: `Content type not found: ${contentTypeId}` });
      }

      // Derive platform from content type ID for social types
      if (contentType.category === "social" && !platform) {
        platform = contentTypeId.replace("-post", "");
      }

      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      // Block production if inputs are still processing
      const pendingInputs = (topic.inputs ?? []).filter(
        (i) => i.processed?.status === "processing" || i.processed?.status === "pending",
      );
      if (pendingInputs.length > 0) {
        return reply.status(400).send({
          error: `${pendingInputs.length} input(s) still processing. Wait for all inputs to finish before producing content.`,
        });
      }

      const project = app.ctx.projectsFor(customerId).get(projectId);
      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      // Distill chat before production (merge with existing distillation)
      try {
        const chatDir = topics.entityDir(topicId);
        const chatMessages = readChat(chatDir);
        if (chatMessages.length > 0) {
          await distillChat(topics, topicId, chatMessages, topic.chatDistillation);
        }
      } catch (err) {
        log.warn({ topicId, err }, "chat distillation failed, proceeding without it");
      }

      // Create ContentItem linked to this flow
      const now = new Date().toISOString();
      const contentTitle = contentType.category === "social" && platform
        ? `${topic.title} — ${contentType.label}`
        : contentType.category === "email"
        ? `${topic.title} — ${contentType.label}`
        : topic.title;

      // Map content type category to ContentItem type
      const itemType = contentType.category === "social" ? "social_post" as const
        : contentType.category === "email" ? "newsletter" as const
        : "article" as const;

      const contentItem = app.ctx.contentFor(customerId, projectId).create({
        customerId,
        projectId,
        type: itemType,
        status: "planned",
        title: contentTitle,
        category: platform ?? topic.category,
        keywords: topic.enrichment?.seo?.keywords
          ? [topic.enrichment.seo.keywords.primary, ...topic.enrichment.seo.keywords.secondary]
          : undefined,
        flowId: topicId,
        originFlowId: topicId,
        topicId, // @deprecated — kept for backward compat
        createdAt: now,
        updatedAt: now,
      });

      // Add to flow outputs
      topics.addOutput(topicId, contentItem.id);

      // Determine pipeline config from ContentType
      const pipelineMode = contentType.pipeline?.mode ?? "single-phase";
      const pipelinePhases = contentType.pipeline?.phases ?? ["write"];
      const pipelineType = pipelineMode === "multi-phase"
        ? "production" as const
        : contentType.category === "email"
        ? "email_production" as const
        : "social_production" as const;

      // Create pipeline run with phases from ContentType
      const phases = pipelinePhases.map((name) => ({
        name,
        status: "pending" as const,
        agentCalls: [],
      }));

      const run = app.ctx.pipelineRunsFor(customerId, projectId).create({
        customerId,
        projectId,
        type: pipelineType,
        status: "pending",
        topicId,
        flowId: topicId,
        contentId: contentItem.id,
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
          content: app.ctx.contentFor(customerId, projectId),
          pipelineRuns: app.ctx.pipelineRunsFor(customerId, projectId),
          topics: app.ctx.topicsFor(customerId, projectId),
        },
        app.ctx.dataDir,
        topic,
      );

      // Fire and forget — start the appropriate pipeline
      if (pipelineMode === "multi-phase") {
        // Multi-phase: article production (outline → write → quality → translate)
        if (topic.status === "approved") {
          topics.update(topicId, { status: "in_production" });
        }
        runProductionPipeline(ctx).catch((err) => {
          log.error({ runId: run.id, err }, "production pipeline failed");
        });
      } else {
        // Single-phase: generic content pipeline (social, email, etc.)
        runContentPipeline(ctx, contentTypeId).catch((err) => {
          log.error({ runId: run.id, err }, "content pipeline failed");
        });
      }

      return reply.status(201).send({
        message: `${contentType.label} pipeline started`,
        contentItemId: contentItem.id,
        contentTypeId,
        flowId: topicId,
        runId: run.id,
        type: itemType,
        platform,
      });
    },
  );
}
