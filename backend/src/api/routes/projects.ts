import type { FastifyInstance } from "fastify";

export async function projectRoutes(app: FastifyInstance) {
  // GET /projects
  app.get("/", async () => {
    return app.ctx.projects.list();
  });

  // GET /projects/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const project = app.ctx.projects.get(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    return project;
  });
}
