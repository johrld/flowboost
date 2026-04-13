import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../utils/logger.js";
import { PipelineContext } from "../../pipeline/context.js";
import { JobStore } from "../../models/job.js";
import { MemoryStore } from "../../models/memory.js";
// executeJob and extractJson no longer needed — no AI classification step
import {
  discoverSitemapUrl,
  fetchSitemap,
  diffArticles,
  crawlPage,
  type CrawledPage,
} from "../../services/sitemap-crawler.js";
import { analyzeCompetitor, type CrawlProfile } from "../../services/crawl-profiler.js";
// topic-classifier.ts no longer used — categories extracted from pages directly
import { computeTopicCoverage, computeGapMatrix, computeCompetitorIndex } from "../../services/gap-analyzer.js";
import type {
  Job,
  Competitor,
  CompetitorBlogIndex,
  CompetitorArticle,
  CompetitorProfile,
  CompetitorRecentActivity,
  ContentIndex,
} from "../../models/types.js";

const log = createLogger("workflow:competitor-scan");

const MAX_PAGES_TO_CRAWL_PER_SCAN = 25; // Limit deep crawling per run

/** Generate a clean slug from a domain: "https://www.calm.com/" → "calm" */
function domainSlug(domain: string): string {
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .replace(/\..+$/, "") // Remove TLD: calm.com → calm
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();
}

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

  /** Log an event to the current run phase (visible in Monitor UI) */
  function logEvent(phase: string, tool: string, input: string) {
    try {
      ctx.stores.pipelineRuns.addAgentCall(ctx.run.id, phase, {
        agent: "competitor-scan",
        model: "code",
        status: "completed",
        costUsd: 0,
        tokens: { input: 0, output: 0 },
        durationMs: 0,
        events: [{ type: "tool_call", timestamp: now(), tool, input }],
      });
    } catch { /* ignore logging errors */ }
  }

  const allNewArticles: Array<{ competitor: string; articles: CompetitorArticle[] }> = [];

  // ── Step 1+2+3: Per-competitor crawl + classify ──────────────
  for (const comp of competitors) {
    const slug = domainSlug(comp.domain);
    const competitorDir = `areas/competitors/${slug}`;
    const phaseName = `crawl:${comp.name}`;

    log.info({ competitor: slug, domain: comp.domain }, "scanning competitor");
    ctx.startPhase(phaseName);

    // Load or create crawl profile (Playwright-based analysis on first run)
    let profile = memory.load<CrawlProfile>(`${competitorDir}/crawl-profile.json`);
    if (!profile) {
      logEvent(phaseName, "analyze-site", `First scan — analyzing ${comp.domain} with browser`);
      try {
        profile = await analyzeCompetitor(comp.domain, comp.name, ctx.projectDir);
        logEvent(phaseName, "profile-created", `Method: ${profile.extraction.method}, confidence: ${profile.validation.confidence}, avg ${profile.validation.avgWordCount} words`);
      } catch (err) {
        log.warn({ err, competitor: slug }, "crawl profiler failed, using defaults");
        logEvent(phaseName, "profile-fallback", "Profiler failed, using auto-discovery");
      }
    }

    // Load or initialize blog index
    let blogIndex = memory.load<CompetitorBlogIndex>(`${competitorDir}/blog-index.json`) ?? {
      competitorSlug: slug,
      sitemapUrl: profile?.blog.sitemapUrl ?? null,
      lastCrawlAt: "",
      totalArticles: 0,
      articles: [],
    };

    // Use profile sitemap URL if available, otherwise discover
    if (!blogIndex.sitemapUrl) {
      logEvent(phaseName, "discover-sitemap", comp.domain);
      const sitemapUrl = profile?.blog.sitemapUrl ?? await discoverSitemapUrl(comp.domain);
      blogIndex.sitemapUrl = sitemapUrl;
    }

    if (!blogIndex.sitemapUrl) {
      log.warn({ competitor: slug }, "no sitemap found, skipping");
      logEvent(phaseName, "error", "No sitemap found");
      ctx.completePhase(phaseName);
      continue;
    }

    logEvent(phaseName, "fetch-sitemap", blogIndex.sitemapUrl);

    // Fetch sitemap
    let sitemapEntries = await fetchSitemap(blogIndex.sitemapUrl);
    if (sitemapEntries.length === 0) {
      log.warn({ competitor: slug }, "empty sitemap");
      logEvent(phaseName, "error", "Empty sitemap");
      ctx.completePhase(phaseName);
      continue;
    }

    // Apply path filter from crawl profile (e.g., only /blog/ or /articles/)
    const pathFilter = profile?.blog.pathFilter;
    if (pathFilter) {
      const before = sitemapEntries.length;
      sitemapEntries = sitemapEntries.filter((e) => e.url.includes(pathFilter));
      logEvent(phaseName, "path-filter", `${pathFilter}: ${before} → ${sitemapEntries.length} URLs`);
    }

    logEvent(phaseName, "sitemap-parsed", `${sitemapEntries.length} URLs found`);

    // Diff against known articles
    const knownUrls = new Set(blogIndex.articles.map((a) => a.url));
    const { newEntries } = diffArticles(knownUrls, sitemapEntries);

    logEvent(phaseName, "diff", `${newEntries.length} new URLs (${knownUrls.size} known)`);
    log.info({ competitor: slug, total: sitemapEntries.length, new: newEntries.length }, "sitemap diffed");

    // Deep-crawl new pages (limited per scan)
    const toCrawl = newEntries.slice(0, MAX_PAGES_TO_CRAWL_PER_SCAN);
    const newArticles: CompetitorArticle[] = [];

    logEvent(phaseName, "crawl-start", `Crawling ${toCrawl.length} pages`);

    for (const entry of toCrawl) {
      const page = await crawlPage(entry.url);
      if (!page) continue;

      // Content filter: skip pages that aren't real articles
      if (page.estimatedWordCount < 200) continue; // Too short
      if (!page.title || page.title.length < 5) continue; // No title at all

      // Category: only use what the page itself declares. Never invent categories.
      const topicCluster: string | null = page.category ?? null;

      const contentHeadings = page.h2Headings.length > 0 ? page.h2Headings : page.h3Headings;

      newArticles.push({
        url: page.url,
        title: page.title,
        slug: page.slug,
        publishedAt: entry.lastmod ?? page.publishedAt ?? null,
        discoveredAt: now(),
        topicCluster,
        h2Headings: contentHeadings,
        h3Headings: page.h3Headings,
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

    logEvent(phaseName, "indexed", `${newArticles.length} articles saved (${blogIndex.totalArticles} total)`);
    ctx.completePhase(phaseName);
    log.info({ competitor: slug, newArticles: newArticles.length, total: blogIndex.totalArticles }, "blog index updated");
  }

  // ── Step 4: Report unclassified articles (no AI guessing) ──
  const unclassifiedCount = allNewArticles
    .flatMap(({ articles }) => articles)
    .filter((a) => a.topicCluster === null).length;
  const classifiedCount = allNewArticles
    .flatMap(({ articles }) => articles)
    .filter((a) => a.topicCluster !== null).length;

  ctx.startPhase("classify");
  logEvent("classify", "done", `${classifiedCount} categorized from page, ${unclassifiedCount} uncategorized`);
  ctx.completePhase("classify");

  // ── Step 5: Recompute topic coverage per competitor ──────────
  ctx.startPhase("analyze");
  logEvent("analyze", "compute-coverage", "Recomputing topic coverage per competitor");
  const competitorCoverages: Array<{ slug: string; coverage: ReturnType<typeof computeTopicCoverage> }> = [];

  for (const comp of competitors) {
    const slug = domainSlug(comp.domain);
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

  logEvent("analyze", "compute-gaps", "Computing gap matrix");
  const gapMatrix = computeGapMatrix(project.id, ourArticlesByCluster, competitorCoverages);
  memory.save("areas/competitors/_gap-matrix.json", gapMatrix, "competitor-scan");
  logEvent("analyze", "gap-matrix", `${gapMatrix.summary.totalClusters} clusters, ${gapMatrix.summary.weLag} gaps`);

  // ── Step 7: Regenerate _index.json ──────────────────────────
  const blogIndexes = competitors.map((comp) => {
    const slug = domainSlug(comp.domain);
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

  logEvent("analyze", "done", "Analysis complete — index and gap matrix updated");
  ctx.completePhase("analyze");
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

/**
 * Scan a single competitor (not all). Used by per-competitor "Re-scan" button.
 * Runs the same crawl + classify + gap-analyze flow but only for one competitor.
 */
export async function runSingleCompetitorScan(
  ctx: PipelineContext,
  jobs: JobStore,
  comp: Competitor,
): Promise<void> {
  const { project } = ctx;
  const memory = new MemoryStore(ctx.projectDir);
  const now = () => new Date().toISOString();
  const slug = domainSlug(comp.domain);
  const competitorDir = `areas/competitors/${slug}`;
  const phaseName = `crawl:${comp.name}`;

  ctx.updateRun({ status: "running", startedAt: now() });

  function logEvent(phase: string, tool: string, input: string) {
    try {
      ctx.stores.pipelineRuns.addAgentCall(ctx.run.id, phase, {
        agent: "competitor-scan",
        model: "code",
        status: "completed",
        costUsd: 0,
        tokens: { input: 0, output: 0 },
        durationMs: 0,
        events: [{ type: "tool_call", timestamp: now(), tool, input }],
      });
    } catch { /* ignore */ }
  }

  ctx.startPhase(phaseName);

  // Load profile or use auto-discovery
  let profile = memory.load<CrawlProfile>(`${competitorDir}/crawl-profile.json`);
  if (!profile) {
    logEvent(phaseName, "analyze-site", `First scan — analyzing ${comp.domain}`);
    try {
      profile = await analyzeCompetitor(comp.domain, comp.name, ctx.projectDir);
      logEvent(phaseName, "profile-created", `Method: ${profile.extraction.method}`);
    } catch {
      logEvent(phaseName, "profile-fallback", "Profiler failed, using auto-discovery");
    }
  }

  let blogIndex = memory.load<CompetitorBlogIndex>(`${competitorDir}/blog-index.json`) ?? {
    competitorSlug: slug, sitemapUrl: profile?.blog.sitemapUrl ?? null, lastCrawlAt: "", totalArticles: 0, articles: [],
  };

  if (!blogIndex.sitemapUrl) {
    blogIndex.sitemapUrl = profile?.blog.sitemapUrl ?? await discoverSitemapUrl(comp.domain);
  }

  if (!blogIndex.sitemapUrl) {
    logEvent(phaseName, "error", "No sitemap found");
    ctx.completePhase(phaseName);
    ctx.updateRun({ status: "completed", completedAt: now() });
    return;
  }

  logEvent(phaseName, "fetch-sitemap", blogIndex.sitemapUrl);
  let sitemapEntries = await fetchSitemap(blogIndex.sitemapUrl);

  const pathFilter = profile?.blog.pathFilter;
  if (pathFilter) {
    sitemapEntries = sitemapEntries.filter((e) => e.url.includes(pathFilter));
    logEvent(phaseName, "path-filter", `${pathFilter}: ${sitemapEntries.length} URLs`);
  }

  const knownUrls = new Set(blogIndex.articles.map((a) => a.url));
  const { newEntries } = diffArticles(knownUrls, sitemapEntries);
  logEvent(phaseName, "diff", `${newEntries.length} new URLs (${knownUrls.size} known)`);

  const toCrawl = newEntries.slice(0, MAX_PAGES_TO_CRAWL_PER_SCAN);
  logEvent(phaseName, "crawl-start", `Crawling ${toCrawl.length} pages`);

  const newArticles: CompetitorArticle[] = [];
  for (const entry of toCrawl) {
    const page = await crawlPage(entry.url);
    if (!page || page.estimatedWordCount < 200 || !page.title || page.title.length < 5) continue;
    const topicCluster2: string | null = page.category ?? null;
    const contentHeadings = page.h2Headings.length > 0 ? page.h2Headings : page.h3Headings;
    newArticles.push({
      url: page.url, title: page.title, slug: page.slug,
      publishedAt: entry.lastmod ?? page.publishedAt ?? null, discoveredAt: now(),
      topicCluster: topicCluster2,
      h2Headings: contentHeadings, estimatedWordCount: page.estimatedWordCount, hasBeenAnalyzed: true,
    });
  }

  blogIndex.articles.push(...newArticles);
  blogIndex.totalArticles = blogIndex.articles.length;
  blogIndex.lastCrawlAt = now();
  memory.save(`${competitorDir}/blog-index.json`, blogIndex, "competitor-scan");

  if (!memory.load(`${competitorDir}/profile.json`)) {
    memory.save(`${competitorDir}/profile.json`, {
      slug, name: comp.name, domain: comp.domain, description: "", blogUrl: comp.domain,
      sitemapUrl: blogIndex.sitemapUrl, channels: ["blog"], knownStrengths: [], knownWeaknesses: [],
      notes: comp.notes ?? "", createdAt: now(), updatedAt: now(),
    } satisfies CompetitorProfile, "competitor-scan");
  }

  memory.save(`${competitorDir}/recent-activity.json`, {
    competitorSlug: slug, updatedAt: now(),
    newArticles: newArticles.map((a) => ({ url: a.url, title: a.title, topicCluster: a.topicCluster, publishedAt: a.publishedAt })),
  } satisfies CompetitorRecentActivity, "competitor-scan");

  logEvent(phaseName, "indexed", `${newArticles.length} articles saved (${blogIndex.totalArticles} total)`);
  ctx.completePhase(phaseName);

  // Recompute coverage + gap matrix for all competitors
  ctx.startPhase("classify");
  logEvent("classify", "done", "Classification complete");
  ctx.completePhase("classify");

  ctx.startPhase("analyze");
  logEvent("analyze", "compute-coverage", "Recomputing topic coverage");

  const allCompetitors = project.competitors ?? [];
  const competitorCoverages: Array<{ slug: string; coverage: ReturnType<typeof computeTopicCoverage> }> = [];
  for (const c of allCompetitors) {
    const s = domainSlug(c.domain);
    const idx = memory.load<CompetitorBlogIndex>(`areas/competitors/${s}/blog-index.json`);
    if (!idx) continue;
    const coverage = computeTopicCoverage(s, idx);
    memory.save(`areas/competitors/${s}/topic-coverage.json`, coverage, "competitor-scan");
    competitorCoverages.push({ slug: s, coverage });
  }

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

  const blogIndexes = allCompetitors.map((c) => {
    const s = domainSlug(c.domain);
    const idx = memory.load<CompetitorBlogIndex>(`areas/competitors/${s}/blog-index.json`);
    return { slug: s, name: c.name, domain: c.domain, blogUrl: c.domain, sitemapUrl: idx?.sitemapUrl ?? null,
      index: idx ?? { competitorSlug: s, sitemapUrl: null, lastCrawlAt: "", totalArticles: 0, articles: [] } };
  });
  const ourArticleCount = Object.values(ourArticlesByCluster).reduce((a, b) => a + b, 0);
  const competitorIndex = computeCompetitorIndex(project.id, blogIndexes, gapMatrix, ourArticleCount);
  memory.save("areas/competitors/_index.json", competitorIndex, "competitor-scan");

  logEvent("analyze", "done", `Scan complete — ${newArticles.length} new articles for ${comp.name}`);
  ctx.completePhase("analyze");
  ctx.updateRun({ status: "completed", completedAt: now() });

  log.info({ competitor: slug, newArticles: newArticles.length, total: blogIndex.totalArticles }, "single competitor scan completed");
}
