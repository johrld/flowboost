import type { FastifyInstance } from "fastify";

export async function contentPlanRoutes(app: FastifyInstance) {
  // GET /customers/:customerId/projects/:projectId/content-plan
  app.get<{ Params: { customerId: string; projectId: string } }>("/content-plan", async (request, reply) => {
    const { customerId, projectId } = request.params;
    const projects = app.ctx.projectsFor(customerId);
    const project = projects.get(projectId);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const plan = projects.getContentPlan(projectId);
    if (!plan) {
      return reply.status(404).send({ error: "No content plan yet. Run strategy pipeline first." });
    }

    return plan;
  });
}
