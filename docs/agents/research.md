# Research & Strategy Agents

Two pipelines handle topic research: **Strategy** (full content planning) and **Enrich** (single topic enrichment).

## Strategy Pipeline

Triggered via `POST /pipeline/strategy`. Runs three agents sequentially.

```
Content Index Sync → Auditor → Researcher → Strategist → Topics saved
```

Before the first agent runs, the content index is synced from GitHub to ensure fresh data.

---

### Agent 1: Content Auditor

**Role**: Analyze existing published content and identify gaps.

| Property | Value |
|----------|-------|
| Name | `content-auditor` |
| Model | project default (sonnet) |
| Max Turns | 10 |
| Tools | `flowboost_read_project_data`, `flowboost_read_content_index` |
| Source | `pipeline/prompts/auditor.ts` |

**What it does**:
1. Loads all published content from the content index (status: "live", channel: "website")
2. Reads project categories and languages
3. Counts articles per category and language
4. Identifies missing translations and underrepresented categories
5. Outputs structured JSON audit

**Output format**:
```json
{
  "totalArticles": 12,
  "byCategory": { "breathing": 4, "meditation": 3, "sleep": 2, "stress": 3 },
  "byLanguage": { "de": 12, "en": 10, "es": 8 },
  "existingArticles": [
    { "title": "...", "slug": "...", "category": "...", "languages": ["de", "en"], "keywords": ["..."] }
  ],
  "missingTranslations": [
    { "translationKey": "...", "existsIn": ["de"], "missingIn": ["en", "es"] }
  ],
  "categoryGaps": ["sleep", "stress"],
  "recommendations": ["Add more sleep content", "Translate 2 articles to Spanish"]
}
```

**Passes to**: Researcher (category gaps, existing articles, recommendations)

---

### Agent 2: Topic Researcher

**Role**: Research 3-5 new article topics based on audit gaps. Does actual web research.

| Property | Value |
|----------|-------|
| Name | `topic-researcher` |
| Model | project default (sonnet) |
| Max Turns | 30 |
| Tools | `WebSearch`, `WebFetch`, `Read`, `flowboost_read_project_data` |
| Source | `pipeline/prompts/researcher.ts` |

**What it does**:
1. Reads project brand voice and SEO guidelines
2. For each underrepresented category, proposes 1-2 topics
3. Uses WebSearch to verify search demand and find keywords
4. Analyzes top 3 search results for each topic (competitor gaps)
5. Determines search intent, suggested angle, estimated sections

**Input from Auditor**:
- Category gaps (e.g., "sleep, stress")
- Existing articles (to avoid duplicates)
- Recommendations

**Output format**:
```json
{
  "topics": [
    {
      "title": "Body Scan Meditation for Sleep: A Complete Beginner's Guide",
      "category": "sleep",
      "keywords": {
        "primary": "body scan meditation for sleep",
        "secondary": ["body scan meditation", "sleep meditation techniques", "guided body scan"],
        "longTail": ["how to do body scan meditation for better sleep", "body scan meditation script for beginners"]
      },
      "searchIntent": "how-to",
      "competitorInsights": "Top results from Headspace, Mindful.org provide basic definitions. Gaps: No beginner-to-advanced progression, limited scientific citations.",
      "suggestedAngle": "Create a complete step-by-step guide with multiple script lengths (5-min, 10-min, 20-min)",
      "estimatedSections": 5,
      "reasoning": "Fills critical sleep category gap, high search demand, naturally integrates with app features"
    }
  ]
}
```

**Passes to**: Strategist (full topics array)

---

### Agent 3: Content Strategist

**Role**: Prioritize topics and create the final content plan.

| Property | Value |
|----------|-------|
| Name | `content-strategist` |
| Model | project default (sonnet) |
| Max Turns | 10 |
| Tools | `Read`, `Write`, `flowboost_read_project_data` |
| Source | `pipeline/prompts/strategist.ts` |

**What it does**:
1. Reads project content types and brand voice
2. Receives audit summary + researched topics
3. Prioritizes based on: category balance, search demand, competition, brand fit, content cluster strength
4. Assigns priority (1 = highest) and IDs (`topic-1`, `topic-2`, ...)
5. Writes content plan JSON to disk

**Input from Auditor + Researcher**:
- Audit summary (totals, gaps, recommendations)
- Researched topics array

**After agent completes**:
- Topics extracted and saved individually to TopicStore (each gets UUID, status: "proposed")
- Content plan (audit data) saved to `content-plan.json`
- Topics appear in the UI as "Proposed" ideas

---

## Enrich Pipeline

Triggered via `POST /pipeline/enrich`. Runs a single agent.

```
User topic → Topic Enricher → Enriched topic saved
```

### Agent 4: Topic Enricher

**Role**: Enrich a user-submitted topic with SEO research.

| Property | Value |
|----------|-------|
| Name | `topic-enricher` |
| Model | project default (sonnet) |
| Max Turns | 15 |
| Tools | `WebSearch`, `WebFetch`, `Read`, `flowboost_read_project_data`, `flowboost_read_content_index` |
| Source | `pipeline/prompts/enricher.ts` |

**When triggered**: User creates a topic manually (title + optional category/notes) and clicks "Analyze".

**What it does**:
1. Reads project brand voice and SEO guidelines
2. Checks published content index for duplicates
3. Checks planned topics for overlap
4. Researches keywords via WebSearch (primary, secondary, long-tail)
5. Analyzes top 3 search results for competitor insights
6. Determines search intent
7. Suggests unique angle and estimated section count
8. Optionally refines title for SEO
9. Assigns/confirms category

**Output format**:
```json
{
  "title": "Refined title for SEO (or original kept)",
  "category": "breathing",
  "keywords": {
    "primary": "breathing techniques",
    "secondary": ["breathing exercises for stress", "box breathing", "4-7-8 breathing"],
    "longTail": ["breathing techniques for beginners", "best breathing exercises for anxiety"]
  },
  "searchIntent": "how-to",
  "competitorInsights": "Top results (Healthline, Cleveland Clinic) provide technique lists but lack beginner progression frameworks.",
  "suggestedAngle": "Beginner-friendly starter guide focusing on 3-4 core techniques with decision framework.",
  "estimatedSections": 5,
  "reasoning": "Strong strategic fit: breathing techniques are the app's core differentiator."
}
```

**After agent completes**:
- Enrichment data merged into existing topic (`enriched: true`)
- Topic now shows full research data in UI (keywords, competitor analysis, strategic fit)

---

## Key Differences: Strategy vs. Enrich

| Aspect | Strategy Pipeline | Enrich Pipeline |
|--------|-------------------|-----------------|
| Scope | Full content planning (3-5 topics) | Single topic enrichment |
| Agents | 3 sequential | 1 |
| Web Research | Yes (Researcher) | Yes (Enricher) |
| Content Index | Synced before audit | Read during enrichment |
| Trigger | User initiates planning | User submits topic + clicks Analyze |
| Output | Multiple proposed topics | Enriched single topic |
| Cost | Higher (~3 agent runs) | Lower (~1 agent run) |

The Enricher is essentially a focused version of the Researcher — same web research capabilities, but applied to one specific user-submitted topic instead of discovering new ones from scratch.
