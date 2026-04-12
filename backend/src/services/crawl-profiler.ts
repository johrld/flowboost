import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createLogger } from "../utils/logger.js";
import { discoverSitemapUrl, fetchSitemap, crawlPage, type CrawledPage } from "./sitemap-crawler.js";
import { MemoryStore } from "../models/memory.js";

const log = createLogger("crawl-profiler");

export interface CrawlProfile {
  domain: string;
  name: string;
  analyzedAt: string;
  blog: {
    url: string;
    sitemapUrl: string | null;
    pathFilter: string | null;
    totalUrlsInSitemap: number;
  };
  extraction: {
    method: "readability" | "dom-fallback";
    contentSelector: string | null;
    titleSource: "readability" | "h1" | "og:title" | "title-tag";
    headingLevel: "h2" | "h3";
    readabilityWorksWell: boolean;
  };
  validation: {
    sampleArticles: number;
    samples: Array<{
      url: string;
      title: string;
      wordCount: number;
      h2Count: number;
      validated: boolean;
    }>;
    avgWordCount: number;
    avgH2Count: number;
    confidence: "high" | "medium" | "low";
  };
}

/**
 * Analyze a competitor website and create a crawl profile.
 * Uses Playwright to render pages in a real browser and validate extraction.
 */
export async function analyzeCompetitor(
  domain: string,
  name: string,
  projectDir: string,
): Promise<CrawlProfile> {
  const slug = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").replace(/\..+$/, "").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const memory = new MemoryStore(projectDir);
  const now = new Date().toISOString();

  log.info({ domain, name }, "analyzing competitor site structure");

  // ── Step 1: Discover sitemap ────────────────────────────
  const sitemapUrl = await discoverSitemapUrl(domain);
  let sitemapEntries: Array<{ url: string; lastmod?: string }> = [];
  if (sitemapUrl) {
    sitemapEntries = await fetchSitemap(sitemapUrl);
  }

  // Detect blog path pattern from URLs
  const pathCounts = new Map<string, number>();
  for (const entry of sitemapEntries) {
    try {
      const parts = new URL(entry.url).pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        pathCounts.set(parts[0], (pathCounts.get(parts[0]) ?? 0) + 1);
      }
    } catch { /* skip */ }
  }

  // Find the most common content path
  const contentPaths = ["blog", "articles", "posts", "resources", "learn", "guides", "journal", "stories", "news"];
  let blogPathFilter: string | null = null;
  let maxCount = 0;
  for (const [p, count] of pathCounts) {
    if (contentPaths.includes(p.toLowerCase()) && count > maxCount) {
      blogPathFilter = `/${p}/`;
      maxCount = count;
    }
  }

  // Also check blog subdomain
  const hostname = new URL(domain).hostname.replace(/^www\./, "");
  const blogSubdomain = `https://blog.${hostname}`;
  let blogUrl = domain;
  try {
    const subRes = await fetch(`${blogSubdomain}/sitemap.xml`, { signal: AbortSignal.timeout(5000) });
    if (subRes.ok) {
      blogUrl = blogSubdomain;
      if (!sitemapUrl) {
        // Re-discover from blog subdomain
        const blogSitemap = await discoverSitemapUrl(blogSubdomain);
        if (blogSitemap) {
          sitemapEntries = await fetchSitemap(blogSitemap);
        }
      }
    }
  } catch { /* no blog subdomain */ }

  log.info({ sitemapUrl, blogPathFilter, totalUrls: sitemapEntries.length }, "sitemap analysis done");

  // ── Step 2: Pick 3 sample article URLs ──────────────────
  const contentPattern = blogPathFilter ? new RegExp(blogPathFilter, "i") : /\/(blog|articles|posts|resources|learn|guides)\//i;
  const articleUrls = sitemapEntries
    .filter((e) => contentPattern.test(e.url))
    .filter((e) => !/privacy|terms|legal|about|contact|sitemap/i.test(e.url))
    .slice(0, 3)
    .map((e) => e.url);

  // Fallback: take any URL with a long path
  if (articleUrls.length === 0) {
    const longPathUrls = sitemapEntries
      .filter((e) => new URL(e.url).pathname.split("/").filter(Boolean).length >= 2)
      .filter((e) => !/privacy|terms|legal/i.test(e.url))
      .slice(0, 3)
      .map((e) => e.url);
    articleUrls.push(...longPathUrls);
  }

  if (articleUrls.length === 0) {
    log.warn({ domain }, "no sample articles found");
    return createEmptyProfile(domain, name, sitemapUrl, sitemapEntries.length);
  }

  // ── Step 3: Crawl samples with code + validate with Playwright ──
  const samples: CrawlProfile["validation"]["samples"] = [];
  let readabilitySuccessCount = 0;
  let domFallbackCount = 0;
  let headingLevel: "h2" | "h3" = "h2";

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: "FlowBoost/1.0 (content research bot)" });

    for (const url of articleUrls) {
      log.info({ url }, "analyzing sample article");

      // Code-based extraction
      const codePage = await crawlPage(url);

      // Browser-based extraction
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(2000); // Wait for JS rendering

        // Extract from rendered page
        const browserData = await page.evaluate(() => {
          const main = document.querySelector("main") ?? document.querySelector("article") ?? document.body;

          // Title
          const h1 = document.querySelector("h1");
          const title = h1?.textContent?.trim() ?? document.title;

          // H2s from content area
          const h2s = [...main.querySelectorAll("h2")]
            .map((el) => el.textContent?.trim() ?? "")
            .filter((h) => h.length > 3 && h.length < 200);

          // H3s
          const h3s = [...main.querySelectorAll("h3")]
            .map((el) => el.textContent?.trim() ?? "")
            .filter((h) => h.length > 3 && h.length < 200);

          // Word count from main content
          const textContent = main.innerText ?? main.textContent ?? "";
          const wordCount = textContent.split(/\s+/).filter(Boolean).length;

          // Check which content selector works
          const hasArticle = !!document.querySelector("article");
          const hasMain = !!document.querySelector("main");
          const hasRichText = !!document.querySelector(".rich-text, .post-content, .article-body, .entry-content, .blog-post-content");

          return { title, h2s, h3s, wordCount, hasArticle, hasMain, hasRichText };
        });

        // Compare code vs browser
        const codeWords = codePage?.estimatedWordCount ?? 0;
        const browserWords = browserData.wordCount;
        const codeH2s = codePage?.h2Headings?.length ?? 0;
        const browserH2s = browserData.h2s.length;
        const browserH3s = browserData.h3s.length;

        // Determine if Readability works well
        const readabilityOk = codeWords > 500 && Math.abs(codeWords - browserWords) < browserWords * 0.3;
        if (readabilityOk) readabilitySuccessCount++;
        else domFallbackCount++;

        // Determine heading level
        if (browserH2s === 0 && browserH3s > 0) headingLevel = "h3";

        const validated = browserWords > 200;

        samples.push({
          url,
          title: browserData.title,
          wordCount: browserWords,
          h2Count: browserH2s || browserH3s,
          validated,
        });

        log.info({
          url: url.split("/").pop(),
          codeWords,
          browserWords,
          codeH2s,
          browserH2s,
          readabilityOk,
        }, "sample analyzed");
      } catch (err) {
        log.warn({ url, err }, "browser page failed, using code result");
        if (codePage) {
          samples.push({
            url,
            title: codePage.title,
            wordCount: codePage.estimatedWordCount,
            h2Count: codePage.h2Headings.length,
            validated: false,
          });
        }
      } finally {
        await page.close();
      }
    }

    await browser.close();
  } catch (err) {
    log.error({ err }, "Playwright failed, falling back to code-only analysis");
    if (browser) await browser.close().catch(() => {});

    // Use code-only results
    for (const url of articleUrls) {
      const codePage = await crawlPage(url);
      if (codePage) {
        samples.push({
          url,
          title: codePage.title,
          wordCount: codePage.estimatedWordCount,
          h2Count: codePage.h2Headings.length,
          validated: false,
        });
      }
    }
  }

  // ── Step 4: Build the profile ───────────────────────────
  const readabilityWorksWell = readabilitySuccessCount >= domFallbackCount;
  const avgWordCount = samples.length > 0 ? Math.round(samples.reduce((s, a) => s + a.wordCount, 0) / samples.length) : 0;
  const avgH2Count = samples.length > 0 ? Math.round(samples.reduce((s, a) => s + a.h2Count, 0) / samples.length) : 0;
  const allValidated = samples.every((s) => s.validated);

  const profile: CrawlProfile = {
    domain,
    name,
    analyzedAt: now,
    blog: {
      url: blogUrl,
      sitemapUrl: sitemapUrl,
      pathFilter: blogPathFilter,
      totalUrlsInSitemap: sitemapEntries.length,
    },
    extraction: {
      method: readabilityWorksWell ? "readability" : "dom-fallback",
      contentSelector: null,
      titleSource: "readability",
      headingLevel,
      readabilityWorksWell,
    },
    validation: {
      sampleArticles: samples.length,
      samples,
      avgWordCount,
      avgH2Count,
      confidence: allValidated && samples.length >= 2 ? "high" : samples.length >= 1 ? "medium" : "low",
    },
  };

  // Save the profile
  const profileDir = `areas/competitors/${slug}`;
  memory.save(`${profileDir}/crawl-profile.json`, profile, "crawl-profiler");

  log.info({
    domain,
    method: profile.extraction.method,
    confidence: profile.validation.confidence,
    avgWordCount,
    avgH2Count,
    sampleCount: samples.length,
  }, "crawl profile created");

  return profile;
}

function createEmptyProfile(domain: string, name: string, sitemapUrl: string | null, totalUrls: number): CrawlProfile {
  return {
    domain,
    name,
    analyzedAt: new Date().toISOString(),
    blog: { url: domain, sitemapUrl, pathFilter: null, totalUrlsInSitemap: totalUrls },
    extraction: { method: "dom-fallback", contentSelector: null, titleSource: "h1", headingLevel: "h2", readabilityWorksWell: false },
    validation: { sampleArticles: 0, samples: [], avgWordCount: 0, avgH2Count: 0, confidence: "low" },
  };
}
