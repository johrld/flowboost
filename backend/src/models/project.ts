import path from "node:path";
import { Store } from "./store.js";
import type { Project, ContentPlan } from "./types.js";

export class ProjectStore extends Store<Project> {
  constructor(dataDir: string) {
    super(path.join(dataDir, "projects"), "project.json");
  }

  getContentPlan(projectId: string): ContentPlan | null {
    return this.readFile<ContentPlan>(projectId, "content-plan.json");
  }

  saveContentPlan(projectId: string, plan: ContentPlan): void {
    this.writeFile(projectId, "content-plan.json", plan);
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
}
