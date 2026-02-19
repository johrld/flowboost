#!/usr/bin/env npx tsx
/**
 * Migration: Article (V2) → ContentItem (V3)
 *
 * Reads existing articles from data/customers/{cid}/projects/{pid}/articles/
 * and creates corresponding ContentItem + ContentVersion entries in content/.
 *
 * - Articles are NOT deleted (backward-compatible)
 * - Multiple ArticleVersions (per-language) are grouped into one ContentVersion
 *   with a `languages[]` array
 * - Content files (markdown + assets) are copied to the new version dir
 * - Topic metadata (title, category, keywords) is used to enrich the ContentItem
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

interface TopicData {
  id: string;
  title: string;
  category: string;
  keywords?: {
    primary: string;
    secondary: string[];
    longTail: string[];
  };
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
    const topicsDir = path.join(projectsDir, projectId, "topics");

    if (!fs.existsSync(articlesDir)) continue;

    // Load topics for enrichment
    const topicMap = new Map<string, TopicData>();
    if (fs.existsSync(topicsDir)) {
      for (const td of fs.readdirSync(topicsDir, { withFileTypes: true })) {
        if (!td.isDirectory()) continue;
        const tp = path.join(topicsDir, td.name, "topic.json");
        if (fs.existsSync(tp)) {
          const topic: TopicData = JSON.parse(fs.readFileSync(tp, "utf-8"));
          topicMap.set(topic.id, topic);
        }
      }
    }

    for (const articleDir of fs.readdirSync(articlesDir, { withFileTypes: true })) {
      if (!articleDir.isDirectory()) continue;
      const articleId = articleDir.name;

      const articlePath = path.join(articlesDir, articleId, "article.json");
      if (!fs.existsSync(articlePath)) continue;

      // Check if already migrated
      const contentItemDir = path.join(contentDir, articleId);
      if (fs.existsSync(path.join(contentItemDir, "content.json"))) {
        console.log(`  SKIP: ${articleId} (already migrated)`);
        skipped++;
        continue;
      }

      const article: OldArticle = JSON.parse(fs.readFileSync(articlePath, "utf-8"));
      const topic = article.topicId ? topicMap.get(article.topicId) : null;

      // Extract title + description from frontmatter of first version
      let title = topic?.title ?? article.translationKey.replace(/-/g, " ");
      let description: string | undefined;
      let tags: string[] | undefined;
      let hasFaq = false;

      const versionsDir = path.join(articlesDir, articleId, "versions");
      const versions: OldArticleVersion[] = [];

      if (fs.existsSync(versionsDir)) {
        for (const vDir of fs.readdirSync(versionsDir, { withFileTypes: true })) {
          if (!vDir.isDirectory()) continue;
          const vPath = path.join(versionsDir, vDir.name, "version.json");
          if (!fs.existsSync(vPath)) continue;
          versions.push(JSON.parse(fs.readFileSync(vPath, "utf-8")));
        }
        versions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      }

      // Read frontmatter from first version's markdown
      if (versions.length > 0) {
        const firstVersion = versions[0];
        const versionDir = path.join(versionsDir, firstVersion.id);
        const mdPath = path.join(versionDir, firstVersion.contentPath);
        if (fs.existsSync(mdPath)) {
          const mdContent = fs.readFileSync(mdPath, "utf-8");
          const fmMatch = mdContent.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const fm = fmMatch[1];
            const titleMatch = fm.match(/^title:\s*"(.+?)"\s*$/m);
            const descMatch = fm.match(/^description:\s*"(.+?)"\s*$/m);
            const tagsMatch = fm.match(/^tags:\n((?:\s+-\s+.+\n?)+)/m);
            if (titleMatch) title = titleMatch[1];
            if (descMatch) description = descMatch[1];
            if (tagsMatch) {
              tags = tagsMatch[1]
                .split("\n")
                .map((l) => l.replace(/^\s+-\s+/, "").trim())
                .filter(Boolean);
            }
            hasFaq = fm.includes("faq:");
          }
        }
      }

      // Create ContentItem
      const contentItem: Record<string, unknown> = {
        id: article.id,
        customerId: article.customerId,
        projectId: article.projectId,
        type: "article",
        status: STATUS_MAP[article.status] ?? "draft",
        title,
        description,
        category: topic?.category,
        tags,
        keywords: topic?.keywords
          ? [topic.keywords.primary, ...topic.keywords.secondary]
          : undefined,
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

      // Group versions into one ContentVersion with multiple languages
      if (versions.length > 0) {
        // Use the first version's ID as the ContentVersion ID
        const primaryVersion = versions[0];
        const newVersionDir = path.join(contentItemDir, "versions", primaryVersion.id);

        const languages = versions.map((v) => ({
          lang: v.lang,
          slug: v.slug,
          title: title,
          description: description ?? "",
          contentPath: v.contentPath,
          wordCount: v.wordCount ?? 0,
        }));

        const totalWords = versions.reduce((sum, v) => sum + (v.wordCount || 0), 0);

        const contentVersion = {
          id: primaryVersion.id,
          contentId: article.id,
          versionNumber: 1,
          languages,
          assets: [],
          text: {
            wordCount: totalWords,
            headingCount: 0,
            hasFaq,
            hasAnswerCapsule: true,
          },
          seoScore: primaryVersion.seoScore,
          pipelineRunId: undefined,
          createdAt: primaryVersion.createdAt,
          createdBy: "pipeline" as const,
        };

        fs.mkdirSync(newVersionDir, { recursive: true });
        fs.writeFileSync(
          path.join(newVersionDir, "version.json"),
          JSON.stringify(contentVersion, null, 2),
        );

        // Copy content files from all versions into one version dir
        for (const v of versions) {
          const oldVersionDir = path.join(versionsDir, v.id);
          for (const subDir of ["content", "assets"]) {
            const src = path.join(oldVersionDir, subDir);
            if (fs.existsSync(src)) {
              copyDirRecursive(src, path.join(newVersionDir, subDir));
            }
          }
        }

        // Update contentItem with currentVersionId
        contentItem.currentVersionId = primaryVersion.id;
        fs.writeFileSync(
          path.join(contentItemDir, "content.json"),
          JSON.stringify(contentItem, null, 2),
        );
      }

      migrated++;
      const langCount = new Set(versions.map((v) => v.lang)).size;
      console.log(`  OK: ${article.translationKey} → ${contentItem.id} (${langCount} langs, status: ${contentItem.status})`);
    }
  }
}

console.log(`\nDone: ${migrated} migrated, ${skipped} skipped`);

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
