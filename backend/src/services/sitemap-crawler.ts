import { createLogger } from "../utils/logger.js";

const log = createLogger("sitemap-crawler");

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  title?: string;
}

export interface CrawledPage {
  url: string;
  title: string;
  slug: string;
  lastmod?: string;
  h2Headings: string[];
  h3Headings: string[];
  estimatedWordCount: number;
  metaDescription?: string;
}

/**
 * Discover the sitemap URL for a blog.
 * Tries common patterns: /sitemap.xml, /blog/sitemap.xml, /post-sitemap.xml
 */
export async function discoverSitemapUrl(blogUrl: string): Promise<string | null> {
  const base = blogUrl.replace(/\/$/, "");
  const domain = new URL(base).origin;
  const hostname = new URL(base).hostname;

  // Try blog subdomain first (blog.calm.com, blog.headspace.com)
  const blogSubdomain = `https://blog.${hostname.replace(/^www\./, "")}`;

  const candidates = [
    `${blogSubdomain}/sitemap.xml`,
    `${base}/blog/sitemap.xml`,
    `${domain}/blog/sitemap.xml`,
    `${base}/sitemap.xml`,
    `${domain}/sitemap.xml`,
    `${domain}/post-sitemap.xml`,
    `${domain}/sitemap_index.xml`,
    `${domain}/articles/sitemap.xml`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const text = await res.text();
        if (text.includes("<urlset") || text.includes("<sitemapindex")) {
          log.debug({ url }, "sitemap found");
          return url;
        }
      }
    } catch { /* try next */ }
  }

  log.warn({ blogUrl }, "no sitemap found");
  return null;
}

/**
 * Fetch and parse a sitemap XML. Handles both urlset and sitemapindex (recursive).
 */
export async function fetchSitemap(sitemapUrl: string, maxDepth = 2): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];

  try {
    const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      log.warn({ sitemapUrl, status: res.status }, "sitemap fetch failed");
      return entries;
    }
    const xml = await res.text();

    // Check if this is a sitemap index (contains links to other sitemaps)
    if (xml.includes("<sitemapindex") && maxDepth > 0) {
      const sitemapUrls = extractTagContent(xml, "loc");
      // Only follow sitemaps that look like blog/post/article content
      const blogSitemaps = sitemapUrls.filter((u) =>
        /post|blog|article|news|stories|resources|learn|guide/i.test(u),
      );
      // If no blog-specific sitemaps found, take first 3 (skip image/video sitemaps)
      const nonMediaSitemaps = sitemapUrls.filter((u) => !/image|video|media|product|shop/i.test(u));
      const toFollow = blogSitemaps.length > 0 ? blogSitemaps : nonMediaSitemaps.slice(0, 3);

      for (const subUrl of toFollow) {
        const subEntries = await fetchSitemap(subUrl, maxDepth - 1);
        entries.push(...subEntries);
      }
      return entries;
    }

    // Parse urlset
    const urls = extractUrls(xml);
    entries.push(...urls);

    log.info({ sitemapUrl, count: entries.length }, "sitemap parsed");
  } catch (err) {
    log.error({ sitemapUrl, err }, "sitemap parse failed");
  }

  return entries;
}

/**
 * Diff new sitemap entries against known articles.
 * Returns URLs that are new (not in the known set).
 */
export function diffArticles(
  knownUrls: Set<string>,
  crawled: SitemapEntry[],
): { newEntries: SitemapEntry[]; removedUrls: string[] } {
  const crawledUrls = new Set(crawled.map((e) => e.url));
  const newEntries = crawled.filter((e) => !knownUrls.has(e.url));
  const removedUrls = [...knownUrls].filter((u) => !crawledUrls.has(u));
  return { newEntries, removedUrls };
}

/**
 * Fetch a page and extract title, H2/H3 headings, word count, meta description.
 * Used for deep-indexing new articles.
 */
export async function crawlPage(url: string): Promise<CrawledPage | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "FlowBoost/1.0 (content research bot)" },
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Extract title — prefer H1 > og:title > <title>
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
    const h1Title = h1Match?.[1]?.replace(/<[^>]+>/g, "").trim();
    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/) ||
      html.match(/<meta\s+content="([^"]*)"\s+property="og:title"/);
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const rawTitle = titleMatch?.[1]?.replace(/\s*[|–-]\s*.+$/, "").trim();
    // Use H1 if it looks like a real article title (not generic brand name)
    const title = (h1Title && h1Title.length > 5 && h1Title.length < 200) ? h1Title
      : ogTitleMatch?.[1] ?? rawTitle ?? "";

    // Extract slug from URL
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";

    // Extract H2 headings
    const h2Headings = extractHeadings(html, "h2");
    const h3Headings = extractHeadings(html, "h3");

    // Estimate word count from text content
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const estimatedWordCount = textContent.split(/\s+/).length;

    // Extract meta description
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/) ||
      html.match(/<meta\s+content="([^"]*)"\s+name="description"/);
    const metaDescription = metaMatch?.[1];

    return { url, title, slug, h2Headings, h3Headings, estimatedWordCount, metaDescription };
  } catch (err) {
    log.warn({ url, err }, "page crawl failed");
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function extractUrls(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const urlBlocks = xml.match(/<url>([\s\S]*?)<\/url>/g) ?? [];

  for (const block of urlBlocks) {
    const loc = extractFirstTag(block, "loc");
    if (!loc) continue;

    // Skip non-content URLs
    if (/\.(jpg|png|gif|svg|pdf|zip|css|js)$/i.test(loc)) continue;
    // Skip known non-content patterns anywhere in URL
    if (/privacy|terms|conditions|cookie|gdpr|imprint|impressum|legal|accessibility|compliance|notice|applicant|careers|jobs|press-release|subscribe|signup|login|account|checkout|cart|pricing|gift|partner/i.test(loc)) continue;
    // Skip very short paths (homepage, section indexes)
    const pathParts = new URL(loc).pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) continue;

    const lastmod = extractFirstTag(block, "lastmod") ?? undefined;
    entries.push({ url: loc, lastmod });
  }

  return entries;
}

function extractFirstTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "is"));
  return match?.[1]?.trim() ?? null;
}

function extractTagContent(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gis");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function extractHeadings(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gis");
  const headings: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text && text.length > 2 && text.length < 200) {
      headings.push(text);
    }
  }
  return headings;
}
