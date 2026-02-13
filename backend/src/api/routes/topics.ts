import type { FastifyInstance } from "fastify";

export async function topicRoutes(app: FastifyInstance) {
  // GET /customers/:customerId/projects/:projectId/topics
  app.get<{ Params: { customerId: string; projectId: string } }>("/", async (request) => {
    const { customerId, projectId } = request.params;
    return app.ctx.topicsFor(customerId, projectId).list();
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
    Body: { scheduledDate?: string | null };
  }>(
    "/:topicId",
    async (request, reply) => {
      const { customerId, projectId, topicId } = request.params;
      const topics = app.ctx.topicsFor(customerId, projectId);
      const topic = topics.get(topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      const body = request.body as { scheduledDate?: string | null };
      const updates: Record<string, unknown> = {};
      if (body.scheduledDate !== undefined) {
        if (body.scheduledDate !== null && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(body.scheduledDate)) {
          return reply.status(400).send({ error: "Invalid scheduledDate format. Use YYYY-MM-DD or YYYY-MM-DDTHH:mm" });
        }
        updates.scheduledDate = body.scheduledDate;
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: "No updates provided" });
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
}
