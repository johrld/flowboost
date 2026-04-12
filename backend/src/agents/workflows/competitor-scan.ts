import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import { PipelineContext } from "../../pipeline/context.js";
import { JobStore } from "../../models/job.js";
import { MemoryStore } from "../../models/memory.js";
import { executeJob } from "../executor.js";
import { extractJson } from "../../pipeline/extract-json.js";
import {
  discoverSitemapUrl,
  fetchSitemap,
  diffArticles,
  crawlPage,
  type CrawledPage,
} from "../../services/sitemap-crawler.js";
import { classifyBatch } from "../../services/topic-classifier.js";
import { computeTopicCoverage, computeGapMatrix, computeCompetitorIndex } from "../../services/gap-analyzer.js";
import type {
  Job,
  CompetitorBlogIndex,
  CompetitorArticle,
  CompetitorProfile,
  CompetitorRecentActivity,
  ContentIndex,
} from "../../models/types.js";

const log = createLogger("workflow:competitor-scan");

const MAX_PAGES_TO_CRAWL_PER_SCAN = 25; // Limit deep crawling per run

/**
 * Full competitor scan workflow (hybrid: code + agent).
 *
 * 1. Code: Crawl sitemaps, find new URLs
 * 2. Code: Deep-crawl new pages (H2s, word count)
 * 3. Code: Keyword-classify articles
 * 4. Agent (Haiku): Classify remaining unclassified articles
 * 5. Code: Recompute topic coverage per competitor
 * 6. Code: Recompute gap matrix
 * 7. Code: Regenerate _index.json summary
 */
export async function runCompetitorScan(
  ctx: PipelineContext,
  jobs: JobStore,
): Promise<void> {
  const { project } = ctx;
  const competitors = project.competitors ?? [];
  if (competitors.length === 0) {
    log.warn("no competitors configured, skipping scan");
    return;
  }

  const memory = new MemoryStore(ctx.projectDir);
  const now = () => new Date().toISOString();

  ctx.updateRun({ status: "running", startedAt: now() });
  ctx.startPhase("competitor-scan");

  const allNewArticles: Array<{ competitor: string; articles: CompetitorArticle[] }> = [];

  // ── Step 1+2+3: Per-competitor crawl + classify ──────────────
  for (const comp of competitors) {
    const slug = comp.domain.replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const competitorDir = `areas/competitors/${slug}`;

    log.info({ competitor: slug, domain: comp.domain }, "scanning competitor");

    // Load or initialize blog index
    let blogIndex = memory.load<CompetitorBlogIndex>(`${competitorDir}/blog-index.json`) ?? {
      competitorSlug: slug,
      sitemapUrl: null,
      lastCrawlAt: "",
      totalArticles: 0,
      articles: [],
    };

    // Discover sitemap if not known
    if (!blogIndex.sitemapUrl) {
      const sitemapUrl = await discoverSitemapUrl(comp.domain);
      blogIndex.sitemapUrl = sitemapUrl;
    }

    if (!blogIndex.sitemapUrl) {
      log.warn({ competitor: slug }, "no sitemap found, skipping");
      continue;
    }

    // Fetch sitemap
    const sitemapEntries = await fetchSitemap(blogIndex.sitemapUrl);
    if (sitemapEntries.length === 0) {
      log.warn({ competitor: slug }, "empty sitemap");
      continue;
    }

    // Diff against known articles
    const knownUrls = new Set(blogIndex.articles.map((a) => a.url));
    const { newEntries } = diffArticles(knownUrls, sitemapEntries);

    log.info({ competitor: slug, total: sitemapEntries.length, new: newEntries.length }, "sitemap diffed");

    // Deep-crawl new pages (limited per scan)
    const toCrawl = newEntries.slice(0, MAX_PAGES_TO_CRAWL_PER_SCAN);
    const newArticles: CompetitorArticle[] = [];

    for (const entry of toCrawl) {
      const page = await crawlPage(entry.url);
      if (!page) continue;

      // Content filter: skip pages that aren't real articles
      if (page.estimatedWordCount < 200) continue; // Too short (nav/footer pages)
      if (page.h2Headings.length === 0 && page.estimatedWordCount < 500) continue; // No structure + short
      if (!page.title || page.title.length < 10) continue; // No real title

      // Keyword-classify immediately
      const cluster = classifyBatch([{ url: page.url, title: page.title, h2Headings: page.h2Headings }]);
      const topicCluster = cluster.classified[0]?.topicCluster ?? null;

      newArticles.push({
        url: page.url,
        title: page.title,
        slug: page.slug,
        publishedAt: entry.lastmod ?? null,
        discoveredAt: now(),
        topicCluster,
        h2Headings: page.h2Headings,
        estimatedWordCount: page.estimatedWordCount,
        hasBeenAnalyzed: true,
      });
    }

    // Update blog index
    blogIndex.articles.push(...newArticles);
    blogIndex.totalArticles = blogIndex.articles.length;
    blogIndex.lastCrawlAt = now();
    memory.save(`${competitorDir}/blog-index.json`, blogIndex, "competitor-scan");

    // Save/update profile
    const existingProfile = memory.load<CompetitorProfile>(`${competitorDir}/profile.json`);
    if (!existingProfile) {
      memory.save(`${competitorDir}/profile.json`, {
        slug,
        name: comp.name,
        domain: comp.domain,
        description: "",
        blogUrl: comp.domain,
        sitemapUrl: blogIndex.sitemapUrl,
        channels: ["blog"],
        knownStrengths: [],
        knownWeaknesses: [],
        notes: comp.notes ?? "",
        createdAt: now(),
        updatedAt: now(),
      } satisfies CompetitorProfile, "competitor-scan");
    }

    // Save recent activity
    memory.save(`${competitorDir}/recent-activity.json`, {
      competitorSlug: slug,
      updatedAt: now(),
      newArticles: newArticles.map((a) => ({
        url: a.url,
        title: a.title,
        topicCluster: a.topicCluster,
        publishedAt: a.publishedAt,
      })),
    } satisfies CompetitorRecentActivity, "competitor-scan");

    allNewArticles.push({ competitor: slug, articles: newArticles });

    log.info({ competitor: slug, newArticles: newArticles.length, total: blogIndex.totalArticles }, "blog index updated");
  }

  // ── Step 4: Agent classification for unclassified articles ───
  const unclassified = allNewArticles
    .flatMap(({ articles }) => articles)
    .filter((a) => a.topicCluster === null && a.title);

  if (unclassified.length > 0) {
    log.info({ count: unclassified.length }, "classifying unclassified articles via agent");

    const classifyJob = jobs.create({
      customerId: ctx.customerId,
      projectId: project.id,
      type: "custom" as Job["type"],
      assigneeAgent: "monitor-competitors",
      status: "queued",
      title: `Classify ${unclassified.length} competitor articles`,
      description: "Assign topic clusters to articles that couldn't be classified by keywords",
      input: {
        articles: unclassified.map((a) => ({ url: a.url, title: a.title, h2s: a.h2Headings?.slice(0, 5) })),
      },
      comments: [],
      createdAt: now(),
      runId: ctx.run.id,
    }) as Job;

    jobs.transition(classifyJob.id, "in_progress");
    try {
      const result = await executeJob(ctx, classifyJob);
      const classifications = extractJson(result.text) as Array<{ url: string; cluster: string }> | null;
      if (Array.isArray(classifications)) {
        // Apply classifications back to blog indexes
        for (const { url, cluster } of classifications) {
          for (const { competitor } of allNewArticles) {
            const dir = `areas/competitors/${competitor}`;
            const idx = memory.load<CompetitorBlogIndex>(`${dir}/blog-index.json`);
            if (!idx) continue;
            const article = idx.articles.find((a) => a.url === url);
            if (article) {
              article.topicCluster = cluster;
              memory.save(`${dir}/blog-index.json`, idx, "competitor-scan");
            }
          }
        }
      }
      jobs.transition(classifyJob.id, "done");
    } catch (err) {
      log.warn({ err }, "agent classification failed, proceeding with keyword-only classifications");
      jobs.transition(classifyJob.id, "failed");
    }
  }

  // ── Step 5: Recompute topic coverage per competitor ──────────
  const competitorCoverages: Array<{ slug: string; coverage: ReturnType<typeof computeTopicCoverage> }> = [];

  for (const comp of competitors) {
    const slug = comp.domain.replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const dir = `areas/competitors/${slug}`;
    const blogIndex = memory.load<CompetitorBlogIndex>(`${dir}/blog-index.json`);
    if (!blogIndex) continue;

    const coverage = computeTopicCoverage(slug, blogIndex);
    memory.save(`${dir}/topic-coverage.json`, coverage, "competitor-scan");
    competitorCoverages.push({ slug, coverage });
  }

  // ── Step 6: Recompute gap matrix ────────────────────────────
  // Load our content index to count our articles per cluster
  const ourArticlesByCluster: Record<string, number> = {};
  const contentIndexPath = path.join(ctx.projectDir, "content-index.json");
  if (fs.existsSync(contentIndexPath)) {
    try {
      const contentIndex = JSON.parse(fs.readFileSync(contentIndexPath, "utf-8")) as ContentIndex;
      for (const entry of contentIndex.entries ?? []) {
        const category = entry.site?.category ?? "uncategorized";
        ourArticlesByCluster[category] = (ourArticlesByCluster[category] ?? 0) + 1;
      }
    } catch { /* ignore */ }
  }

  const gapMatrix = computeGapMatrix(project.id, ourArticlesByCluster, competitorCoverages);
  memory.save("areas/competitors/_gap-matrix.json", gapMatrix, "competitor-scan");

  // ── Step 7: Regenerate _index.json ──────────────────────────
  const blogIndexes = competitors.map((comp) => {
    const slug = comp.domain.replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const idx = memory.load<CompetitorBlogIndex>(`areas/competitors/${slug}/blog-index.json`);
    return {
      slug,
      name: comp.name,
      domain: comp.domain,
      blogUrl: comp.domain,
      sitemapUrl: idx?.sitemapUrl ?? null,
      index: idx ?? { competitorSlug: slug, sitemapUrl: null, lastCrawlAt: "", totalArticles: 0, articles: [] },
    };
  });

  const ourArticleCount = Object.values(ourArticlesByCluster).reduce((a, b) => a + b, 0);
  const competitorIndex = computeCompetitorIndex(project.id, blogIndexes, gapMatrix, ourArticleCount);
  memory.save("areas/competitors/_index.json", competitorIndex, "competitor-scan");

  ctx.completePhase("competitor-scan");
  ctx.updateRun({ status: "completed", completedAt: now() });

  log.info(
    {
      competitors: competitors.length,
      totalNewArticles: allNewArticles.reduce((sum, c) => sum + c.articles.length, 0),
      gapClusters: gapMatrix.summary.totalClusters,
      weLag: gapMatrix.summary.weLag,
    },
    "competitor scan completed",
  );
}
