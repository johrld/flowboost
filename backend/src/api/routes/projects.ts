import type { FastifyInstance } from "fastify";

export async function projectRoutes(app: FastifyInstance) {
  // GET /customers/:customerId/projects
  app.get<{ Params: { customerId: string } }>("/", async (request) => {
    const { customerId } = request.params;
    return app.ctx.projectsFor(customerId).list();
  });

  // GET /customers/:customerId/projects/:projectId
  app.get<{ Params: { customerId: string; projectId: string } }>("/:projectId", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const project = app.ctx.projectsFor(customerId).get(projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    return project;
  });

  // PUT /customers/:customerId/projects/:projectId
  app.put<{ Params: { customerId: string; projectId: string }; Body: Record<string, unknown> }>(
    "/:projectId",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      const existing = store.get(projectId);
      if (!existing) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const { id: _id, customerId: _cid, createdAt: _ca, ...allowed } = request.body as Record<string, unknown>;
      const updated = store.update(projectId, {
        ...allowed,
        updatedAt: new Date().toISOString(),
      } as Partial<typeof existing>);

      return updated;
    },
  );

  // GET /customers/:customerId/projects/:projectId/project-brief
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/:projectId/project-brief",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      if (!store.get(projectId)) {
        return reply.status(404).send({ error: "Project not found" });
      }
      const content = store.getProjectBrief(projectId);
      return { content: content ?? "" };
    },
  );

  // GET /customers/:customerId/projects/:projectId/api-keys
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/:projectId/api-keys",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      if (!store.get(projectId)) {
        return reply.status(404).send({ error: "Project not found" });
      }
      return store.getMaskedApiKeys(projectId);
    },
  );

  // PUT /customers/:customerId/projects/:projectId/api-keys
  app.put<{ Params: { customerId: string; projectId: string }; Body: Record<string, string> }>(
    "/:projectId/api-keys",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      if (!store.get(projectId)) {
        return reply.status(404).send({ error: "Project not found" });
      }
      store.saveApiKeys(projectId, request.body as Record<string, string>);
      return { message: "API keys updated" };
    },
  );

  // PUT /customers/:customerId/projects/:projectId/project-brief
  app.put<{ Params: { customerId: string; projectId: string }; Body: { content: string } }>(
    "/:projectId/project-brief",
    async (request, reply) => {
      const { customerId, projectId } = request.params;
      const store = app.ctx.projectsFor(customerId);
      if (!store.get(projectId)) {
        return reply.status(404).send({ error: "Project not found" });
      }
      const { content } = request.body as { content: string };
      store.saveProjectBrief(projectId, content);
      return { message: "Project brief updated" };
    },
  );
}
