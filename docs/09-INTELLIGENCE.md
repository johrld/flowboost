# FlowBoost Intelligence System

## Overview

The Intelligence System automatically builds and maintains knowledge about your competitive landscape. It crawls competitor blogs, classifies articles by topic, computes content gaps, and feeds this intelligence to the CMO agent and Research agents.

```
┌──────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE PIPELINE                      │
│                                                               │
│  1. Crawl Profiling (Playwright, once per competitor)         │
│  2. Sitemap Crawling (code, daily)                            │
│  3. Content Extraction (Readability + DOM fallback)           │
│  4. Topic Classification (keywords + AI fallback)             │
│  5. Gap Analysis (deterministic computation)                  │
│  6. CMO Memory Update (hot/warm/cold tiers)                   │
└──────────────────────────────────────────────────────────────┘
```

## How It Works

### Step 1: Crawl Profiling (First Scan Only)

When a competitor is scanned for the first time, the system analyzes their website structure using a real browser (Playwright + Chromium):

1. **Sitemap Discovery** — tries blog subdomain (`blog.calm.com`), common paths (`/blog/sitemap.xml`, `/articles/sitemap.xml`), and main sitemap
2. **Sample Crawling** — picks 3 article URLs from the sitemap
3. **Browser Validation** — opens each sample in Chromium, waits for JavaScript rendering, extracts:
   - Title (from rendered H1)
   - H2/H3 headings (from content area only)
   - Word count (from rendered `innerText`)
4. **Method Comparison** — compares browser results against code-based extraction (Readability):
   - If Readability gets >500 words and matches browser within 30% → `readability` method
   - Otherwise → `dom-fallback` method
5. **Profile Saved** — stores `crawl-profile.json` with sitemap URL, path filter, extraction method, and validation results

```json
// memory/areas/competitors/calm/crawl-profile.json
{
  "blog": {
    "url": "https://blog.calm.com",
    "sitemapUrl": "https://blog.calm.com/sitemap.xml",
    "pathFilter": "/blog/"
  },
  "extraction": {
    "method": "readability",
    "readabilityWorksWell": true
  },
  "validation": {
    "sampleArticles": 3,
    "avgWordCount": 2088,
    "confidence": "high"
  }
}
```

All subsequent scans reuse this profile — no Playwright needed.

### Step 2: Sitemap Crawling (Daily)

Code-based, no AI tokens consumed:

1. Fetch the sitemap XML (URL from crawl profile)
2. Parse all `<url>` entries
3. Apply path filter from profile (e.g., only `/blog/` or `/articles/` URLs)
4. Filter out non-content URLs (privacy, terms, legal, product pages)
5. Diff against known blog index — identify new URLs
6. Sort: content paths (`/blog/`, `/articles/`) first
7. Crawl up to 25 new pages per scan

### Step 3: Content Extraction

For each new page, the system uses a hybrid approach:

**Primary: Mozilla Readability**
- Parses the HTML into a DOM (via jsdom)
- Readability extracts only the article body (strips navigation, sidebar, footer, ads)
- Returns: clean HTML content, plain text, title, excerpt, byline

**Fallback: DOM-based extraction**
- When Readability extracts <500 words (common with React SPAs)
- Finds `<main>` or `<article>` element in the DOM
- Extracts headings and text from that container
- Applies 0.7 correction factor to raw word count (removes nav/footer inflation)

**JSON-LD extraction** (supplementary):
- Parses `<script type="application/ld+json">` blocks
- Extracts: `datePublished`, `author`, `wordCount` when available
- Overrides computed values when present

**Per-page output:**
```json
{
  "url": "https://blog.calm.com/blog/box-breathing",
  "title": "Box Breathing: How to Do It and Why It Works",
  "h2Headings": ["What is box breathing?", "Benefits of box breathing", "How to practice"],
  "estimatedWordCount": 2196,
  "topicCluster": "breathing-techniques",
  "publishedAt": "2025-11-04"
}
```

### Step 4: Topic Classification

Two-stage classification:

**Stage 1: Keyword matching (code, ~80% hit rate)**
- Matches article title + H2 headings against predefined keyword clusters
- Clusters: meditation, breathing-techniques, sleep, stress, anxiety, mindfulness, focus-productivity, body-wellness, emotional-health, relationships, beginners, science-research, depression, pain-management, children-family, workplace
- Scores by keyword specificity (longer keywords = higher score)

**Stage 2: AI classification (Haiku, for unmatched articles)**
- Batches unclassified article titles
- Single agent call assigns clusters
- Cost: ~$0.01 per scan

### Step 5: Gap Analysis

Fully deterministic (code, no AI):

- Loads our content index (published articles by category)
- Loads all competitor `topic-coverage.json` files
- For each topic cluster, computes:
  - Our article count and depth (deep/moderate/thin/none)
  - Each competitor's count and depth
  - Gap type: `we_lead`, `we_lag`, `mutual_gap`, `saturated`, `our_exclusive`
  - Priority: high (multiple competitors cover it, we don't), medium, low
  - Recommendation text

Output: `_gap-matrix.json`

### Step 6: Memory Update

Results are stored in the per-competitor PARA memory structure:

```
memory/areas/competitors/
  _index.json              ← HOT: always in CMO prompt (~2 KB)
  _gap-matrix.json         ← HOT: gap analysis summary
  calm/
    crawl-profile.json     ← Saved extraction config (Playwright-validated)
    blog-index.json        ← COLD: full article catalog (query via MCP tool)
    topic-coverage.json    ← WARM: cluster depth scores
    profile.json           ← WARM: competitor identity
    recent-activity.json   ← WARM: new articles since last scan
  headspace/...
  insighttimer/...
```

## Memory Access Tiers

| Tier | Files | When Loaded | Max Size |
|------|-------|-------------|----------|
| **HOT** | `_index.json`, `_gap-matrix.json` summary | Always in CMO/research prompt | ~4-6 KB |
| **WARM** | `profile.json`, `topic-coverage.json`, `recent-activity.json` | On demand via `flowboost_read_memory` MCP tool | ~2-4 KB each |
| **COLD** | `blog-index.json` | Only via `flowboost_query_competitor_blog` with filters | 10-100 KB each |

The CMO agent always knows the competitive overview and top gaps. For details, it uses MCP tools to drill into specific competitors or query individual articles.

## API Endpoints

### Triggering Scans

```
POST /customers/:cid/projects/:pid/heartbeat/competitor-scan
POST /customers/:cid/projects/:pid/heartbeat/trend-scan
POST /customers/:cid/projects/:pid/heartbeat/content-watch
POST /customers/:cid/projects/:pid/heartbeat/trigger      # Run all due monitors
GET  /customers/:cid/projects/:pid/heartbeat/status        # Last-run timestamps
```

### Viewing Intelligence

```
GET /customers/:cid/projects/:pid/cmo/memory          # Memory status + hot data
GET /customers/:cid/projects/:pid/cmo/competitors      # All competitors + gap matrix
GET /customers/:cid/projects/:pid/cmo/competitors/:slug # Competitor detail (profile, coverage, articles)
```

### MCP Tools (for agents)

```
flowboost_read_memory({ resource: "areas/competitors/calm/topic-coverage.json" })
flowboost_query_competitor_blog({ competitor: "calm", cluster: "breathing-techniques", limit: 10 })
```

## Costs

| Step | Method | Cost per Scan |
|------|--------|---------------|
| Sitemap fetch + parse | Code (HTTP + XML) | $0.00 |
| URL diff + filtering | Code | $0.00 |
| Page crawling (25 pages) | Code (Readability + jsdom) | $0.00 |
| Keyword classification | Code | $0.00 |
| AI classification (unmatched) | Agent (Haiku) | ~$0.01-0.05 |
| Gap matrix computation | Code | $0.00 |
| Crawl profiling (first scan only) | Playwright + Code | $0.00 (no AI) |
| **Total per daily scan** | | **~$0.01-0.05** |

## Monitor UI

The Intelligence page (`/intelligence`) shows:

- **Competitor cards** — name, article count, top clusters, last scan time
- **Gap matrix** — prioritized list of content gaps with recommendations
- **Competitor detail** (click a card) — topic coverage, article list with expandable H2 structure

The Monitor page shows real-time scan progress with granular phases:
- `crawl:Calm` → discover-sitemap, fetch-sitemap, path-filter, diff, crawl-start, indexed
- `crawl:Headspace` → ...
- `classify` → agent-classify
- `analyze` → compute-coverage, compute-gaps, gap-matrix

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Sitemap parsing | Custom XML regex parser | Extract URLs from sitemap.xml |
| Content extraction | Mozilla Readability + jsdom | Article body isolation |
| Browser rendering | Playwright + Chromium | Crawl profile validation (first scan) |
| robots.txt | robots-parser npm package | Crawl politeness |
| Topic classification | Keyword matching + Haiku agent | Article categorization |
| Gap analysis | Custom TypeScript functions | Deterministic gap computation |
| Storage | JSON files (PARA structure) | Per-competitor entity storage |

## Adding a New Competitor

1. Add the competitor in Project Settings (domain + name)
2. Trigger a scan (click "Scan Competitors" or wait for cron)
3. The system automatically:
   - Discovers the blog sitemap
   - Analyzes site structure with Playwright (renders 3 sample pages)
   - Creates a crawl profile with the best extraction method
   - Crawls 25 initial articles
   - Classifies by topic cluster
   - Computes the gap matrix
4. All subsequent scans are incremental (only new/changed articles)
