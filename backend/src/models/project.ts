import fs from "node:fs";
import path from "node:path";
import { Store } from "./store.js";
import type { Project, ContentPlan, ApiKeys } from "./types.js";
import type { CustomerStore } from "./customer.js";

export class ProjectStore extends Store<Project> {
  constructor(basePath: string) {
    super(basePath, "project.json");
  }

  getContentPlan(projectId: string): ContentPlan | null {
    return this.readFile<ContentPlan>(projectId, "content-plan.json");
  }

  saveContentPlan(projectId: string, plan: ContentPlan): void {
    this.writeFile(projectId, "content-plan.json", plan);
  }

  getProjectBrief(projectId: string): string | null {
    return this.readTextFile(projectId, "project-brief.md");
  }

  saveProjectBrief(projectId: string, content: string): void {
    this.writeTextFile(projectId, "project-brief.md", content);
  }

  getApiKeys(projectId: string): ApiKeys {
    return this.readFile<ApiKeys>(projectId, "api-keys.json") ?? {};
  }

  saveApiKeys(projectId: string, keys: ApiKeys): void {
    const existing = this.getApiKeys(projectId);
    const merged: ApiKeys = { ...existing };
    for (const [key, value] of Object.entries(keys)) {
      if (value === undefined) continue; // not provided, keep existing
      if (value.includes("••••")) continue; // masked placeholder, keep existing
      if (value === "") {
        delete (merged as Record<string, string>)[key]; // clear key
      } else {
        (merged as Record<string, string>)[key] = value; // new value
      }
    }
    this.writeFile(projectId, "api-keys.json", merged);
  }

  getMaskedApiKeys(projectId: string): ApiKeys {
    const keys = this.getApiKeys(projectId);
    const masked: ApiKeys = {};
    for (const [key, value] of Object.entries(keys)) {
      if (value && value.length > 0) {
        if (value.length > 12) {
          masked[key as keyof ApiKeys] = value.slice(0, 4) + "••••" + value.slice(-4);
        } else if (value.length > 6) {
          masked[key as keyof ApiKeys] = value.slice(0, 2) + "••••" + value.slice(-2);
        } else {
          masked[key as keyof ApiKeys] = "••••••";
        }
      }
    }
    return masked;
  }

  getBrandVoice(projectId: string): string | null {
    return this.readTextFile(projectId, "brand-voice.md");
  }

  getStyleGuide(projectId: string): string | null {
    return this.readTextFile(projectId, "style-guide.md");
  }

  getSeoGuidelines(projectId: string): string | null {
    return this.readTextFile(projectId, "seo-guidelines.md");
  }

  getContentTypes(projectId: string): string | null {
    return this.readTextFile(projectId, "content-types.md");
  }

  getTemplate(projectId: string, name: string): string | null {
    return this.readTextFile(projectId, `templates/${name}.md`);
  }

  getSectionSpec(projectId: string, name: string): string | null {
    return this.readTextFile(projectId, `section-specs/${name}.md`);
  }

  /** Project-level override > Customer-level fallback */
  getEffectiveBrandVoice(projectId: string, customers: CustomerStore, customerId: string): string | null {
    return this.getBrandVoice(projectId) ?? customers.getBrandVoice(customerId);
  }

  /** Project-level override > Customer-level fallback */
  getEffectiveStyleGuide(projectId: string, customers: CustomerStore, customerId: string): string | null {
    return this.getStyleGuide(projectId) ?? customers.getStyleGuide(customerId);
  }

  // ── Agent Skills ──────────────────────────────────────

  /** Read a skill file (e.g. category="social", name="linkedin") */
  getSkill(projectId: string, category: string, name: string): string | null {
    return this.readTextFile(projectId, `skills/${category}/${name}.md`);
  }

  /** List skill names in a category */
  listSkillCategories(projectId: string): string[] {
    const dir = path.join(this.entityDir(projectId), "skills");
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  /** List skills in a category */
  listSkills(projectId: string, category: string): string[] {
    const dir = path.join(this.entityDir(projectId), "skills", category);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(".md", ""));
  }

  /** Save/update a skill file */
  saveSkill(projectId: string, category: string, name: string, content: string): void {
    const dir = path.join(this.entityDir(projectId), "skills", category);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.md`), content, "utf-8");
  }

  /** Delete a skill file */
  deleteSkill(projectId: string, category: string, name: string): boolean {
    const filePath = path.join(this.entityDir(projectId), "skills", category, `${name}.md`);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  }
}

export function createProjectStore(dataDir: string, customerId: string): ProjectStore {
  return new ProjectStore(path.join(dataDir, "customers", customerId, "projects"));
}
