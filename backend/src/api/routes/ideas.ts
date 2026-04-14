import type { FastifyInstance } from "fastify";
import type { Idea } from "../../models/idea.js";

export async function ideaRoutes(app: FastifyInstance) {
  // GET /ideas
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/",
    async (request) => {
      const { customerId, projectId } = request.params;
      return app.ctx.ideasFor(customerId, projectId).list()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  );

  // POST /ideas
  app.post<{
    Params: { customerId: string; projectId: string };
    Body: { title: string; description?: string; labels?: string[] };
  }>(
    "/",
    async (request) => {
      const { customerId, projectId } = request.params;
      const { title, description, labels } = request.body as { title?: string; description?: string; labels?: string[] };
      if (!title?.trim()) return { error: "Title required" };

      const now = new Date().toISOString();
      return app.ctx.ideasFor(customerId, projectId).create({
        title: title.trim(),
        description: description?.trim() ?? "",
        labels: labels ?? [],
        attachments: [],
        status: "inbox",
        createdAt: now,
        updatedAt: now,
      } as Omit<Idea, "id">);
    },
  );

  // PATCH /ideas/:ideaId
  app.patch<{
    Params: { customerId: string; projectId: string; ideaId: string };
    Body: Partial<Idea>;
  }>(
    "/:ideaId",
    async (request, reply) => {
      const { customerId, projectId, ideaId } = request.params;
      const store = app.ctx.ideasFor(customerId, projectId);
      const existing = store.get(ideaId);
      if (!existing) return reply.status(404).send({ error: "Idea not found" });

      const updates = request.body as Partial<Idea>;
      return store.update(ideaId, { ...updates, updatedAt: new Date().toISOString() });
    },
  );

  // DELETE /ideas/:ideaId
  app.delete<{ Params: { customerId: string; projectId: string; ideaId: string } }>(
    "/:ideaId",
    async (request, reply) => {
      const { customerId, projectId, ideaId } = request.params;
      const deleted = app.ctx.ideasFor(customerId, projectId).delete(ideaId);
      if (!deleted) return reply.status(404).send({ error: "Idea not found" });
      return { message: "Deleted" };
    },
  );
}
