import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("api:skills");

export async function skillRoutes(app: FastifyInstance) {
  // GET /skills — List skill categories
  app.get<{ Params: { customerId: string; projectId: string } }>(
    "/",
    async (request) => {
      const { customerId, projectId } = request.params;
      const categories = app.ctx.projectsFor(customerId).listSkillCategories(projectId);
      return { categories };
    },
  );

  // GET /skills/:category — List skills in a category
  app.get<{ Params: { customerId: string; projectId: string; category: string } }>(
    "/:category",
    async (request) => {
      const { customerId, projectId, category } = request.params;
      const skills = app.ctx.projectsFor(customerId).listSkills(projectId, category);
      return { category, skills };
    },
  );

  // GET /skills/:category/:name — Read skill content
  app.get<{ Params: { customerId: string; projectId: string; category: string; name: string } }>(
    "/:category/:name",
    async (request, reply) => {
      const { customerId, projectId, category, name } = request.params;
      const content = app.ctx.projectsFor(customerId).getSkill(projectId, category, name);
      if (content === null) {
        return reply.status(404).send({ error: `Skill not found: ${category}/${name}` });
      }
      return { category, name, content };
    },
  );

  // PUT /skills/:category/:name — Update skill content
  app.put<{
    Params: { customerId: string; projectId: string; category: string; name: string };
    Body: { content: string };
  }>(
    "/:category/:name",
    async (request, reply) => {
      const { customerId, projectId, category, name } = request.params;
      const { content } = (request.body ?? {}) as { content?: string };
      if (content === undefined) {
        return reply.status(400).send({ error: "content is required" });
      }
      app.ctx.projectsFor(customerId).saveSkill(projectId, category, name, content);
      log.info({ projectId, skill: `${category}/${name}` }, "skill updated");
      return { message: "Skill updated" };
    },
  );

  // POST /skills/:category/:name — Create new skill
  app.post<{
    Params: { customerId: string; projectId: string; category: string; name: string };
    Body: { content: string };
  }>(
    "/:category/:name",
    async (request, reply) => {
      const { customerId, projectId, category, name } = request.params;
      const { content } = (request.body ?? {}) as { content?: string };
      if (!content) {
        return reply.status(400).send({ error: "content is required" });
      }
      // Check if already exists
      const existing = app.ctx.projectsFor(customerId).getSkill(projectId, category, name);
      if (existing !== null) {
        return reply.status(409).send({ error: `Skill already exists: ${category}/${name}. Use PUT to update.` });
      }
      app.ctx.projectsFor(customerId).saveSkill(projectId, category, name, content);
      log.info({ projectId, skill: `${category}/${name}` }, "skill created");
      return reply.status(201).send({ message: "Skill created" });
    },
  );

  // DELETE /skills/:category/:name — Delete skill
  app.delete<{
    Params: { customerId: string; projectId: string; category: string; name: string };
  }>(
    "/:category/:name",
    async (request, reply) => {
      const { customerId, projectId, category, name } = request.params;
      const deleted = app.ctx.projectsFor(customerId).deleteSkill(projectId, category, name);
      if (!deleted) {
        return reply.status(404).send({ error: `Skill not found: ${category}/${name}` });
      }
      log.info({ projectId, skill: `${category}/${name}` }, "skill deleted");
      return { message: "Skill deleted" };
    },
  );

  // POST /skills/reset — Reset all skills to defaults
  app.post<{ Params: { customerId: string; projectId: string } }>(
    "/reset",
    async (request) => {
      const { customerId, projectId } = request.params;
      const projectDir = app.ctx.projectsFor(customerId).entityDir(projectId);
      const defaultsDir = path.join(app.ctx.dataDir, "..", "data.seed", "project-defaults", "skills");

      if (!fs.existsSync(defaultsDir)) {
        return { message: "No default skills found", copied: 0 };
      }

      // Copy recursively
      let copied = 0;
      const copyRecursive = (src: string, dest: string) => {
        if (fs.statSync(src).isDirectory()) {
          fs.mkdirSync(dest, { recursive: true });
          for (const entry of fs.readdirSync(src)) {
            copyRecursive(path.join(src, entry), path.join(dest, entry));
          }
        } else {
          fs.copyFileSync(src, dest);
          copied++;
        }
      };

      const targetDir = path.join(projectDir, "skills");
      copyRecursive(defaultsDir, targetDir);
      log.info({ projectId, copied }, "skills reset to defaults");
      return { message: `Reset ${copied} skill files to defaults`, copied };
    },
  );
}
