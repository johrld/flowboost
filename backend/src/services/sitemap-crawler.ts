import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const robotsParser = (await import("robots-parser")).default as unknown as (url: string, contents: string) => { isAllowed(url: string, ua?: string): boolean | undefined; getCrawlDelay(ua?: string): number | undefined };
import { createLogger } from "../utils/logger.js";

const log = createLogger("sitemap-crawler");

const USER_AGENT = "FlowBoost/1.0 (content research bot)";
const REQUEST_DELAY_MS = 1000; // Politeness: 1s between requests to same domain

// robots.txt cache per domain
const robotsCache = new Map<string, { allowed: (url: string) => boolean; delay: number }>();

async function checkRobots(url: string): Promise<boolean> {
  const origin = new URL(url).origin;
  if (!robotsCache.has(origin)) {
    try {
      const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
      const txt = res.ok ? await res.text() : "";
      const robots = robotsParser(`${origin}/robots.txt`, txt);
      robotsCache.set(origin, {
        allowed: (u: string) => robots.isAllowed(u, USER_AGENT) ?? true,
        delay: robots.getCrawlDelay(USER_AGENT) ?? REQUEST_DELAY_MS / 1000,
      });
    } catch {
      robotsCache.set(origin, { allowed: () => true, delay: REQUEST_DELAY_MS / 1000 });
    }
  }
  return robotsCache.get(origin)!.allowed(url);
}

async function politeDelay(): Promise<void> {
  await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
}

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
  author?: string;
  publishedAt?: string;
  category?: string;
}

/**
 * Discover the sitemap URL for a blog.
 * Tries common patterns: /sitemap.xml, /blog/sitemap.xml, /post-sitemap.xml
 */
export async function discoverSitemapUrl(blogUrl: string): Promise<string | null> {
  // Normalize URL
  let normalizedUrl = blogUrl;
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  const base = normalizedUrl.replace(/\/$/, "");
  const domain = new URL(base).origin;
  const hostname = new URL(base).hostname;

  // Try blog subdomain first (blog.calm.com, blog.headspace.com)
  const blogSubdomain = `https://blog.${hostname.replace(/^www\./, "")}`;

  const candidates = [
    `${blogSubdomain}/sitemap.xml`,
    `${domain}/blog/sitemap_index.xml`,
    `${domain}/blog/sitemap.xml`,
    `${domain}/blog/post-sitemap.xml`,
    `${domain}/blog/wp-sitemap-posts-post-1.xml`,
    `${base}/sitemap.xml`,
    `${domain}/sitemap.xml`,
    `${domain}/post-sitemap.xml`,
    `${domain}/sitemap_index.xml`,
    `${domain}/articles/sitemap.xml`,
    `${domain}/wp-sitemap.xml`,
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

  // Sort: prioritize URLs with content-like paths (/blog/, /articles/) first
  const contentPattern = /\/(blog|articles|posts|resources|learn|guides|journal|stories)\//i;
  newEntries.sort((a, b) => {
    const aContent = contentPattern.test(a.url) ? 0 : 1;
    const bContent = contentPattern.test(b.url) ? 0 : 1;
    return aContent - bContent;
  });

  return { newEntries, removedUrls };
}

/**
 * Fetch a page and extract article content using Mozilla Readability.
 * Falls back to regex parsing if Readability fails.
 * Extracts JSON-LD structured data when available.
 */
export async function crawlPage(url: string): Promise<CrawledPage | null> {
  try {
    // Check robots.txt
    const allowed = await checkRobots(url);
    if (!allowed) {
      log.debug({ url }, "blocked by robots.txt");
      return null;
    }

    // Polite delay
    await politeDelay();

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";

    // ── Try JSON-LD first for metadata ────────────────────
    let jsonLdTitle: string | undefined;
    let jsonLdDate: string | undefined;
    let jsonLdWordCount: number | undefined;
    let jsonLdAuthor: string | undefined;
    let extractedCategory: string | undefined;

    const jsonLdMatches = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
          const data = JSON.parse(jsonStr);
          const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
          const article = items.find((i: Record<string, unknown>) =>
            ["Article", "BlogPosting", "NewsArticle", "WebPage"].includes(String(i["@type"] ?? "")),
          );
          if (article) {
            jsonLdTitle = article.headline as string | undefined;
            jsonLdDate = (article.datePublished ?? article.dateModified) as string | undefined;
            jsonLdWordCount = article.wordCount as number | undefined;
            jsonLdAuthor = typeof article.author === "string" ? article.author
              : (article.author as Record<string, unknown>)?.name as string | undefined;
            // Category from JSON-LD
            if (article.articleSection) extractedCategory = String(article.articleSection);
            else if (article.genre) extractedCategory = String(article.genre);
            else if (Array.isArray(article.keywords) && article.keywords.length > 0) extractedCategory = String(article.keywords[0]);
          }
        } catch { /* malformed JSON-LD */ }
      }
    }

    // ── Use Readability for content extraction ────────────
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    // ── Extract category from page ──────────────────────────
    if (!extractedCategory) {
      // Try meta tags
      const articleSection = html.match(/<meta\s+property="article:section"\s+content="([^"]*)"/) ??
        html.match(/<meta\s+content="([^"]*)"\s+property="article:section"/);
      if (articleSection) extractedCategory = articleSection[1];
    }
    if (!extractedCategory) {
      // Try WordPress category tags (rel="category tag" or rel="category")
      const wpCategory = html.match(/<a[^>]*rel="category[^"]*"[^>]*>([^<]+)<\/a>/i);
      if (wpCategory) extractedCategory = wpCategory[1].trim();
    }
    if (!extractedCategory) {
      // Try elements with "category" in class name (Squarespace, custom themes)
      const catElements = html.match(/<(?:a|span|div)[^>]*class="[^"]*category[^"]*"[^>]*>([^<]{2,50})<\/(?:a|span|div)>/gi) ?? [];
      for (const el of catElements) {
        const text = el.replace(/<[^>]+>/g, "").trim();
        // Skip template variables and very long texts (descriptions, not categories)
        if (text && text.length > 1 && text.length < 40 && !text.startsWith("$") && !text.includes("{")) {
          extractedCategory = text;
          break;
        }
      }
    }
    if (!extractedCategory) {
      // Try breadcrumbs
      const breadcrumb = html.match(/<nav[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>([\s\S]*?)<\/nav>/i);
      if (breadcrumb) {
        const crumbLinks = breadcrumb[1].match(/<a[^>]*>([^<]+)<\/a>/gi) ?? [];
        // Take the last crumb before the article title (usually the category)
        if (crumbLinks.length >= 3) {
          const cat = crumbLinks[crumbLinks.length - 2].replace(/<[^>]+>/g, "").trim();
          if (cat && cat.length > 1 && cat.length < 50) extractedCategory = cat;
        }
      }
    }
    if (!extractedCategory) {
      // Try URL path — e.g., /blog/category/sleep/article-slug → "sleep"
      const pathParts = new URL(url).pathname.split("/").filter(Boolean);
      if (pathParts.length >= 3) {
        // Common patterns: /blog/category/article, /blog/topic/article
        const possibleCat = pathParts[pathParts.length - 2];
        // Skip generic path segments
        if (possibleCat && !/^(blog|articles|posts|page|\d+)$/i.test(possibleCat)) {
          extractedCategory = possibleCat.replace(/-/g, " ");
        }
      }
    }

    // ── Extract headings from full DOM (jsdom, not regex) ───
    // This works better than Readability for some sites (React SPAs)
    const fullDoc = dom.window.document;

    // Get H2/H3 from <main> or <article> if available, else from full body
    const contentRoot = fullDoc.querySelector("main") ?? fullDoc.querySelector("article") ?? fullDoc.body;
    const domH2s = [...contentRoot.querySelectorAll("h2")]
      .map((el) => decodeHtmlEntities(el.textContent?.trim() ?? ""))
      .filter((h) => h.length > 3 && h.length < 200 && !(h === h.toUpperCase() && h.split(/\s+/).length <= 2));
    const h2Set = new Set(domH2s.map((h) => h.toLowerCase()));
    const domH3s = [...contentRoot.querySelectorAll("h3")]
      .map((el) => decodeHtmlEntities(el.textContent?.trim() ?? ""))
      .filter((h) => h.length > 3 && h.length < 200 && !h2Set.has(h.toLowerCase()));

    // ── Use Readability for content + word count ─────────
    const readabilityWordCount = article?.textContent
      ? article.textContent.split(/\s+/).filter(Boolean).length
      : 0;

    // Compute raw HTML word count (stripped, as fallback)
    const strippedText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const rawWordCount = strippedText.split(/\s+/).length;

    // Use Readability word count if it captured enough, otherwise use raw (with inflation factor)
    // Readability is more accurate when it works; raw includes nav/footer text
    const estimatedWordCount = jsonLdWordCount
      ?? (readabilityWordCount > 500 ? readabilityWordCount : Math.round(rawWordCount * 0.7)); // ~70% of raw is usually article content

    // Use Readability headings if it extracted enough, otherwise use DOM headings
    let h2Headings: string[];
    let h3Headings: string[];
    if (article && readabilityWordCount > 500) {
      const articleDom2 = new JSDOM(article.content ?? "");
      h2Headings = [...articleDom2.window.document.querySelectorAll("h2")]
        .map((el) => decodeHtmlEntities(el.textContent?.trim() ?? ""))
        .filter((h) => h.length > 3 && h.length < 200);
      const rH2Set = new Set(h2Headings.map((h) => h.toLowerCase()));
      h3Headings = [...articleDom2.window.document.querySelectorAll("h3")]
        .map((el) => decodeHtmlEntities(el.textContent?.trim() ?? ""))
        .filter((h) => h.length > 3 && h.length < 200 && !rH2Set.has(h.toLowerCase()));
    } else {
      h2Headings = domH2s;
      h3Headings = domH3s;
    }

    // Title: JSON-LD > Readability > H1 > og:title > <title>
    const h1El = fullDoc.querySelector("h1");
    const h1Title = h1El?.textContent?.trim();
    const ogMeta = fullDoc.querySelector('meta[property="og:title"]');
    const ogTitle = ogMeta?.getAttribute("content");
    const titleEl = fullDoc.querySelector("title");
    const rawTitle = titleEl?.textContent?.replace(/\s*[|–-]\s*.+$/, "").trim();
    const title = decodeHtmlEntities(
      jsonLdTitle ?? article?.title ?? (h1Title && h1Title.length > 5 ? h1Title : ogTitle ?? rawTitle ?? ""),
    );

    return {
      url,
      title,
      slug,
      h2Headings,
      h3Headings,
      estimatedWordCount,
      metaDescription: article?.excerpt ?? undefined,
      author: jsonLdAuthor ?? article?.byline ?? undefined,
      publishedAt: jsonLdDate,
      category: extractedCategory ? decodeHtmlEntities(extractedCategory) : undefined,
    };
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
    // Skip known non-content patterns
    if (/privacy|terms|conditions|cookie|gdpr|imprint|legal|accessibility|compliance|notice|applicant|careers|jobs|press-release|subscribe|signup|login|account|checkout|cart|pricing|gift|partner|store|wallpaper|calendar|landing-page|our-team|editorial-team|newsroom|media-/i.test(loc)) continue;
    // Skip very short paths (homepage, section indexes)
    const pathParts = new URL(loc).pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) continue;
    // Skip non-content paths: only keep /blog/, /articles/, /posts/, /resources/, /learn/, /guides/ or similar content paths
    // If the URL has a recognizable content prefix, keep it. If it's a single-segment path like /intentions/, skip.
    const contentPrefixes = /^\/(blog|articles|posts|resources|learn|guides|journal|stories|news)\//i;
    if (pathParts.length >= 2 && !contentPrefixes.test(new URL(loc).pathname)) continue;

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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "...")
    .replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1))))
    .trim();
}

function extractHeadings(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gis");
  const headings: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "").trim());
    if (text && text.length > 2 && text.length < 200) {
      headings.push(text);
    }
  }
  return headings;
}
