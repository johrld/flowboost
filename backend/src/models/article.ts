import fs from "node:fs";
import path from "node:path";
import { Store } from "./store.js";
import type { Article, ArticleVersion } from "./types.js";

export class ArticleStore extends Store<Article> {
  constructor(basePath: string) {
    super(basePath, "article.json");
  }

  createVersion(articleId: string, version: Omit<ArticleVersion, "id">): ArticleVersion {
    const id = crypto.randomUUID();
    const v: ArticleVersion = { id, ...version };
    const dir = path.join(this.entityDir(articleId), "versions", id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "version.json"), JSON.stringify(v, null, 2));
    return v;
  }

  getVersions(articleId: string): ArticleVersion[] {
    const versionsDir = path.join(this.entityDir(articleId), "versions");
    if (!fs.existsSync(versionsDir)) return [];
    return fs
      .readdirSync(versionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const vPath = path.join(versionsDir, d.name, "version.json");
        if (!fs.existsSync(vPath)) return null;
        return JSON.parse(fs.readFileSync(vPath, "utf-8")) as ArticleVersion;
      })
      .filter((v): v is ArticleVersion => v !== null);
  }

  getVersionDir(articleId: string, versionId: string): string {
    return path.join(this.entityDir(articleId), "versions", versionId);
  }
}

export function createArticleStore(dataDir: string, customerId: string, projectId: string): ArticleStore {
  return new ArticleStore(path.join(dataDir, "customers", customerId, "projects", projectId, "articles"));
}
