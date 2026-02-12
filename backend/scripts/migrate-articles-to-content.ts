#!/usr/bin/env npx tsx
/**
 * Migration: Article → ContentItem
 *
 * Reads existing articles from data/customers/{cid}/projects/{pid}/articles/
 * and creates corresponding ContentItem entries in content/ directory.
 *
 * - Articles are NOT deleted (backward-compatible, articles/ stays)
 * - Content items get the same ID as the original article
 * - Versions are migrated with auto-increment numbering
 *
 * Usage:
 *   npx tsx scripts/migrate-articles-to-content.ts [--data-dir ./data]
 */

import fs from "node:fs";
import path from "node:path";

const dataDir = process.argv.includes("--data-dir")
  ? process.argv[process.argv.indexOf("--data-dir") + 1]
  : path.join(import.meta.dirname, "..", "data");

interface OldArticle {
  id: string;
  customerId: string;
  projectId: string;
  topicId: string;
  translationKey: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

interface OldArticleVersion {
  id: string;
  articleId: string;
  lang: string;
  slug: string;
  wordCount: number;
  seoScore?: number;
  contentPath: string;
  assetsPath?: string;
  createdAt: string;
}

const STATUS_MAP: Record<string, string> = {
  draft: "draft",
  review: "review",
  approved: "approved",
  delivered: "delivered",
  published: "published",
};

let migrated = 0;
let skipped = 0;

const customersDir = path.join(dataDir, "customers");
if (!fs.existsSync(customersDir)) {
  console.log("No customers directory found at", customersDir);
  process.exit(0);
}

for (const customerDir of fs.readdirSync(customersDir, { withFileTypes: true })) {
  if (!customerDir.isDirectory()) continue;
  const customerId = customerDir.name;
  const projectsDir = path.join(customersDir, customerId, "projects");
  if (!fs.existsSync(projectsDir)) continue;

  for (const projectDir of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!projectDir.isDirectory()) continue;
    const projectId = projectDir.name;
    const articlesDir = path.join(projectsDir, projectId, "articles");
    const contentDir = path.join(projectsDir, projectId, "content");

    if (!fs.existsSync(articlesDir)) continue;

    for (const articleDir of fs.readdirSync(articlesDir, { withFileTypes: true })) {
      if (!articleDir.isDirectory()) continue;
      const articleId = articleDir.name;

      const articlePath = path.join(articlesDir, articleId, "article.json");
      if (!fs.existsSync(articlePath)) continue;

      // Check if already migrated
      const contentItemDir = path.join(contentDir, articleId);
      if (fs.existsSync(path.join(contentItemDir, "content.json"))) {
        skipped++;
        continue;
      }

      const article: OldArticle = JSON.parse(fs.readFileSync(articlePath, "utf-8"));

      // Create ContentItem
      const contentItem = {
        id: article.id,
        customerId: article.customerId,
        projectId: article.projectId,
        type: "article",
        status: STATUS_MAP[article.status] ?? "draft",
        title: article.translationKey.replace(/-/g, " "),
        topicId: article.topicId,
        translationKey: article.translationKey,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        deliveredAt: article.deliveredAt,
        ...(article.status === "published" ? { publishedAt: article.deliveredAt ?? article.updatedAt } : {}),
      };

      fs.mkdirSync(contentItemDir, { recursive: true });
      fs.writeFileSync(
        path.join(contentItemDir, "content.json"),
        JSON.stringify(contentItem, null, 2),
      );

      // Migrate versions
      const versionsDir = path.join(articlesDir, articleId, "versions");
      if (fs.existsSync(versionsDir)) {
        const versions: OldArticleVersion[] = [];

        for (const vDir of fs.readdirSync(versionsDir, { withFileTypes: true })) {
          if (!vDir.isDirectory()) continue;
          const vPath = path.join(versionsDir, vDir.name, "version.json");
          if (!fs.existsSync(vPath)) continue;
          versions.push(JSON.parse(fs.readFileSync(vPath, "utf-8")));
        }

        // Sort by createdAt for version numbering
        versions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        for (let i = 0; i < versions.length; i++) {
          const oldVersion = versions[i];
          const newVersionDir = path.join(contentItemDir, "versions", oldVersion.id);

          const contentVersion = {
            id: oldVersion.id,
            contentId: article.id,
            versionNumber: i + 1,
            languages: [{
              lang: oldVersion.lang,
              slug: oldVersion.slug,
              title: article.translationKey.replace(/-/g, " "),
              description: "",
              contentPath: oldVersion.contentPath,
              wordCount: oldVersion.wordCount,
            }],
            assets: oldVersion.assetsPath
              ? [{ assetId: "", role: "hero" as const, lang: oldVersion.lang }]
              : [],
            text: {
              wordCount: oldVersion.wordCount,
              headingCount: 0,
              hasFaq: false,
              hasAnswerCapsule: false,
            },
            seoScore: oldVersion.seoScore,
            createdAt: oldVersion.createdAt,
            createdBy: "pipeline" as const,
          };

          fs.mkdirSync(newVersionDir, { recursive: true });
          fs.writeFileSync(
            path.join(newVersionDir, "version.json"),
            JSON.stringify(contentVersion, null, 2),
          );

          // Copy content files if they exist in old version dir
          const oldVersionDir = path.join(versionsDir, oldVersion.id);
          for (const subDir of ["content", "assets"]) {
            const src = path.join(oldVersionDir, subDir);
            if (fs.existsSync(src)) {
              copyDirRecursive(src, path.join(newVersionDir, subDir));
            }
          }
        }
      }

      migrated++;
      console.log(`  ✓ ${customerId}/${projectId}: ${article.translationKey}`);
    }
  }
}

console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped (already exist)`);

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
