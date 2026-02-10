import type { FastifyInstance } from "fastify";

export async function customerRoutes(app: FastifyInstance) {
  // GET /customers
  app.get("/", async () => {
    return app.ctx.customers.list();
  });

  // GET /customers/:customerId
  app.get<{ Params: { customerId: string } }>("/:customerId", async (request, reply) => {
    const customer = app.ctx.customers.get(request.params.customerId);
    if (!customer) {
      return reply.status(404).send({ error: "Customer not found" });
    }
    return customer;
  });

  // PUT /customers/:customerId/authors
  app.put<{ Params: { customerId: string }; Body: { authors: unknown[] } }>(
    "/:customerId/authors",
    async (request, reply) => {
      const customer = app.ctx.customers.get(request.params.customerId);
      if (!customer) {
        return reply.status(404).send({ error: "Customer not found" });
      }

      const { authors } = request.body as { authors: typeof customer.authors };
      app.ctx.customers.update(request.params.customerId, {
        authors,
        updatedAt: new Date().toISOString(),
      });

      return { message: "Authors updated", authors };
    },
  );

  // GET /customers/:customerId/brand-voice
  app.get<{ Params: { customerId: string } }>("/:customerId/brand-voice", async (request, reply) => {
    const customer = app.ctx.customers.get(request.params.customerId);
    if (!customer) {
      return reply.status(404).send({ error: "Customer not found" });
    }
    const content = app.ctx.customers.getBrandVoice(request.params.customerId);
    return { content: content ?? "" };
  });

  // PUT /customers/:customerId/brand-voice
  app.put<{ Params: { customerId: string }; Body: { content: string } }>(
    "/:customerId/brand-voice",
    async (request, reply) => {
      const customer = app.ctx.customers.get(request.params.customerId);
      if (!customer) {
        return reply.status(404).send({ error: "Customer not found" });
      }
      const { content } = request.body as { content: string };
      app.ctx.customers.saveBrandVoice(request.params.customerId, content);
      return { message: "Brand voice updated" };
    },
  );
}
