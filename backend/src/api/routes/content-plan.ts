import type { FastifyInstance } from "fastify";

export async function contentPlanRoutes(app: FastifyInstance) {
  // GET /projects/:id/content-plan
  app.get<{ Params: { id: string } }>("/:id/content-plan", async (request, reply) => {
    const project = app.ctx.projects.get(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const plan = app.ctx.projects.getContentPlan(request.params.id);
    if (!plan) {
      return reply.status(404).send({ error: "No content plan yet. Run strategy pipeline first." });
    }

    return plan;
  });

  // POST /projects/:id/content-plan/topics/:topicId/approve
  app.post<{ Params: { id: string; topicId: string } }>(
    "/:id/content-plan/topics/:topicId/approve",
    async (request, reply) => {
      const plan = app.ctx.projects.getContentPlan(request.params.id);
      if (!plan) {
        return reply.status(404).send({ error: "No content plan found" });
      }

      const topic = plan.topics.find((t) => t.id === request.params.topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      topic.status = "approved";
      topic.approvedAt = new Date().toISOString();
      plan.updatedAt = new Date().toISOString();
      app.ctx.projects.saveContentPlan(request.params.id, plan);

      return { message: "Topic approved", topic };
    },
  );

  // POST /projects/:id/content-plan/topics/:topicId/reject
  app.post<{
    Params: { id: string; topicId: string };
    Body: { reason?: string };
  }>(
    "/:id/content-plan/topics/:topicId/reject",
    async (request, reply) => {
      const plan = app.ctx.projects.getContentPlan(request.params.id);
      if (!plan) {
        return reply.status(404).send({ error: "No content plan found" });
      }

      const topic = plan.topics.find((t) => t.id === request.params.topicId);
      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      topic.status = "rejected";
      topic.rejectedAt = new Date().toISOString();
      topic.rejectionReason = (request.body as { reason?: string })?.reason;
      plan.updatedAt = new Date().toISOString();
      app.ctx.projects.saveContentPlan(request.params.id, plan);

      return { message: "Topic rejected", topic };
    },
  );
}
