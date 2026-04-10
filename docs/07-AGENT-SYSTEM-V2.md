# FlowBoost Agent System v2

## Overview

FlowBoost v2 replaces the fixed pipeline architecture with a **CMO-driven hierarchical agent system** inspired by [Paperclip AI](https://github.com/paperclipai/paperclip) and [OpenClaw](https://github.com/openclaw/openclaw). Work is organized into **Jobs** delegated to specialized agents, with persistent **Project Memory** that accumulates intelligence across runs, and a **Competitor Intelligence System** that builds deep knowledge about the competitive landscape.

```
┌──────────────────────────────────────────────────────────────┐
│  CMO Agent (Chat Interface)                                  │
│  Knows: content portfolio, competitors, gaps, trends         │
│  Can: suggest topics, delegate work, review quality          │
└────────────────────┬─────────────────────────────────────────┘
                     │
     ┌───────────────┼──────────────────────┐
     ▼               ▼                      ▼
┌──────────┐  ┌────────────┐  ┌───────────────────┐
│ Background│  │ Production │  │ Quality Pipeline  │
│ Monitors  │  │ Agents     │  │                   │
├──────────┤  ├────────────┤  ├───────────────────┤
│Competitor │  │Research    │  │SEO Checker        │
│Trend      │  │Outline     │  │Citation Checker   │
│Content    │  │Section     │  │E-E-A-T Checker    │
│           │  │Writers (N) │  │Health Claims      │
│           │  │Editor      │  │AI Citability      │
│           │  │Social      │  │                   │
│           │  │Newsletter  │  │                   │
│           │  │Translator  │  │                   │
│           │  │Image Gen   │  │                   │
└──────────┘  └────────────┘  └───────────────────┘
```

## Implementation Status

### Done (in this branch)
- [x] Job System (JobStore, status lifecycle, comments, delegation)
- [x] Agent Registry (16 agents with skills, tools, models)
- [x] Agent Executor (skill loading, prompt building, job execution)
- [x] 15 Skill Files (CMO, research, writers, quality, monitors, social, newsletter)
- [x] Memory Store (PARA structure, MCP tools read/write)
- [x] CMO Chat (project-level + topic-level, with memory + MCP tools)
- [x] Article Workflow (Research → Outline → Writers → Editor → Quality)
- [x] Social Workflow (platform-specific, optional article derivation)
- [x] Background Monitors (competitor, trend, content — heartbeat endpoints)
- [x] Frontend: Content Library, Intelligence page, CMO Chat sidebar, job-based generate buttons
- [x] Docs: architecture + UI roadmap

### Next: Competitor Intelligence System
- [ ] Sitemap Crawler Service (code, not agent)
- [ ] Per-Competitor Entity Storage
- [ ] Topic Classification (hybrid: code + agent)
- [ ] Gap Matrix (code-based, deterministic)
- [ ] Competitor Blog Query MCP Tool
- [ ] Tiered Memory Loading (hot/warm/cold)
- [ ] Skill updates with expert findings (article structure, citations, AI citability)

### Later
- [ ] Perplexity API citation tracking
- [ ] Content freshness scoring + auto-flagging
- [ ] Monitor page upgrade (show jobs instead of pipeline runs)
- [ ] Settings: monitors tab, healthContentChecks toggle

---

## Part 1: Core Architecture

### Jobs (not Pipelines)

A **Job** is a concrete work assignment for an agent. Jobs have:
- **Type**: `research`, `write_article`, `write_section`, `write_social`, `quality_check`, `monitor_competitors`, etc.
- **Status lifecycle**: `queued → in_progress → in_review → done | failed | blocked | cancelled`
- **Delegation**: Jobs can have a `parentJobId` (e.g., section-writer jobs are children of the outline job)
- **Comments**: Agent-to-agent communication thread on each job
- **Input/Output**: Structured JSON data flowing between agents

### Agent Registry

16 agents defined in code (`backend/src/agents/registry.ts`). Behavior defined by Markdown skill files (`backend/src/agents/skills/*.md`).

| Agent | Role | Model | Key Tools |
|-------|------|-------|-----------|
| `cmo` | Chief Marketing Officer | sonnet | All MCP + WebSearch |
| `research` | Content Researcher | sonnet | Memory + WebSearch + Competitor Query |
| `outline-architect` | Article Outline | sonnet | MCP tools |
| `section-writer` | Section Writer (N parallel) | sonnet | Validate section |
| `content-editor` | Assembler | sonnet | Assemble + validate |
| `quality-seo` | SEO + AI Citability Checker | haiku | Content index |
| `quality-citations` | Citation Checker | sonnet | Memory + WebSearch |
| `quality-eeat` | E-E-A-T Checker | haiku | Project data + memory |
| `quality-health` | Health Claims Validator | sonnet | None (text analysis) |
| `social-writer` | Social Media Writer | sonnet | Validate social |
| `newsletter-writer` | Newsletter Writer | sonnet | Validate newsletter |
| `translator` | Translator | sonnet | Project data |
| `image-generator` | Image Generator | haiku | Imagen 4 |
| `monitor-competitors` | Competitor Monitor | haiku | Memory + WebSearch |
| `monitor-trends` | Trend Scanner | haiku | Memory + WebSearch |
| `monitor-content` | Content Watcher | haiku | Memory + content index |

### Heartbeat System

Background agents run on schedule via external cron calling HTTP endpoints:

```bash
0 6 * * *    curl -X POST .../heartbeat/competitor-scan  # Daily sitemap check
0 9 * * 3    curl -X POST .../heartbeat/trend-scan       # Weekly trends
0 6 * * *    curl -X POST .../heartbeat/content-watch    # Daily content freshness
*/30 * * * * curl -X POST .../heartbeat/trigger           # Or: run all due monitors
```

---

## Part 2: Competitor Intelligence System

### Per-Competitor Entity Storage

Each competitor gets its own folder (inspired by Paperclip's entity-per-folder pattern):

```
memory/areas/competitors/
  _index.json                        # HOT — cross-competitor summary (~2 KB)
  _gap-matrix.json                   # HOT — gap analysis with priorities
  calm/
    profile.json                     # WARM — identity, positioning, strengths/weaknesses
    blog-index.json                  # COLD — complete article catalog (10-100 KB)
    topic-coverage.json              # WARM — cluster depth scores
    recent-activity.json             # WARM — delta since last scan
  headspace/
    ...
  insighttimer/
    ...
```

### Three Memory Access Tiers

| Tier | Files | When Loaded | Size |
|------|-------|-------------|------|
| **HOT** | `_index.json`, `_gap-matrix.json` summary, `trend-watch.json` | Always in CMO/research prompt | ~4-6 KB |
| **WARM** | `profile.json`, `topic-coverage.json`, `recent-activity.json` | On demand via `flowboost_read_memory` MCP tool | ~2-4 KB each |
| **COLD** | `blog-index.json` | Only via `flowboost_query_competitor_blog` with filters | 10-100 KB each |

### What We Index Per Competitor

Based on SEO expert analysis, index these (high ROI):

| What | Why | Frequency |
|------|-----|-----------|
| **Blog articles** (URL, title, date, H2/H3 headings, word count) | H2 structure reveals semantic coverage depth | Daily delta |
| **Landing pages** (/meditation-for-beginners, etc.) | Reveal commercially valuable topics | Monthly |
| **FAQ pages + schema markup** | Reverse-engineer People Also Ask strategy | Monthly |
| **Structured data types used** | E-E-A-T signal tracking | Monthly |
| **App store descriptions** | Keyword strategy signals | Quarterly |

Skip: social media posts, newsletters (too noisy for automation).

### Hybrid Processing Pipeline

```
Daily Cron
  │
  ├── Code: Sitemap fetch + XML parse (no LLM)          ~$0.00
  ├── Code: URL diff (new articles since last scan)      ~$0.00
  ├── Code: Update blog-index.json per competitor        ~$0.00
  │
  ├── Agent (Haiku): Classify new articles               ~$0.01
  │   Input: batch of titles → Output: topic clusters
  │
  ├── Code: Recompute topic-coverage.json per competitor ~$0.00
  ├── Code: Recompute _gap-matrix.json (deterministic)   ~$0.00
  ├── Code: Regenerate _index.json summary               ~$0.00
  │
  └── Weekly: Agent (Sonnet): Strategic recommendations  ~$0.10
      → recommended-topics.json

  Total daily: ~$0.01-0.05
  Total weekly: ~$0.10-0.20
```

### Gap Matrix

Three-level analysis (code-based, not agent-based):

1. **Topic Gap**: "They have it, we don't"
2. **Depth Gap**: "Both cover it, they go deeper" (article count per cluster)
3. **Quality Gap**: "Both cover it, theirs is better" (word count, citations, schema)

Scoring: `Opportunity = (SearchVolume × Relevance) / (Competition × Effort)`

### New MCP Tool: `flowboost_query_competitor_blog`

```
flowboost_query_competitor_blog({
  competitor: "calm",
  cluster: "breathing-techniques",
  search: "box breathing",
  limit: 10
})
→ Returns filtered subset, not 100 KB of raw index
```

---

## Part 3: Article Production

### Research Brief Format

The Research Agent produces a structured brief (not a wall of text):

```
CONTENT BRIEF: Progressive Muscle Relaxation for Sleep
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TARGET
- Primary KW: progressive muscle relaxation for sleep (3,200/mo, KD 34)
- Secondary KWs: [list with volumes]
- Target word count: 2,200-2,600

COMPETITOR LANDSCAPE
- #1: Healthline (2,400 words) — clinical tone, no audio, no app CTA
- #2: Sleep Foundation (1,800 words) — good science, weak practical
- GAP: None address modifications for chronic pain, none offer audio script

REQUIRED SOURCES
- [Study 1]: Author, Year, Key stat: "PMR reduced sleep onset latency by 12.4 min"

USER QUESTIONS TO ANSWER
- "Does PMR actually work for sleep?" (Reddit, 340 upvotes)
- "How long should I do PMR before bed?" (PAA)

RECOMMENDED STRUCTURE
- H2: What is PMR | H2: Why PMR works for sleep | H2: Step-by-step | ...

INTERNAL LINKS
- FROM this → "Body Scan Guide" | TO this → update "Sleep Meditation Guide"
```

### Article Structure for AI Citability

Based on AI search expert analysis, every article must follow:

1. **Answer-first paragraphs** — first sentence after each H2 is a standalone answer
2. **Specific citations** — "A 2023 Stanford study (n=108) found..." not "studies show"
3. **Comparison tables** — at least one per article (AI extraction rate increasing)
4. **FAQ with schema** — 4+ questions, each answer starts with direct answer, max 100 words
5. **Key Takeaways box** — 3-5 extractable bullets near top of article
6. **Max 4 sentences per paragraph** — AI extracts at paragraph level
7. **Named medical reviewer** — consistent across all health content

### Quality Checks

| Check | What | Model | Threshold |
|-------|------|-------|-----------|
| SEO + AI Citability | Title, meta, headings, keyword density, extractability test, table check | haiku | 70/100 |
| Citations | Every health claim has source with year + data point | sonnet | 70/100 |
| E-E-A-T | Author schema, reviewer, disclaimer, freshness | haiku | 70/100 |
| Health Claims | No absolute claims, proper hedging, no unsupported assertions | sonnet | 80/100 |

### Content Freshness Rules

- Auto-flag articles >6 months old for review
- Mandatory update triggers: new research published, competitor updates competing article, Google core update
- Composite review urgency: `(months × 0.3) + (traffic_decline × 0.3) + (ranking_change × 0.2) + (competitor_update × 0.2)`
- Display "Medically reviewed and updated: [date]" prominently

---

## Part 4: Topic Cluster Strategy

### Breathe Pillar Architecture (7 pillars, ~150-200 articles total)

1. **Meditation** — techniques, guided, mindfulness, types
2. **Sleep** — insomnia, hygiene, meditation, techniques
3. **Anxiety** — management, relief, specific situations
4. **Stress** — management, relief, workplace, relationships
5. **Breathing** — techniques, breathwork, exercises
6. **Mindfulness** — practice, daily, benefits
7. **Focus/Productivity** — meditation for focus, mental clarity

### Cluster Depth (Breathing example)

```
PILLAR: Breathing Techniques Guide (3,000 words)
├── Technique Spokes:
│   ├── Box Breathing (1,800w)
│   │   ├── Box Breathing for Anxiety (1,200w)
│   │   ├── Box Breathing for Sleep (1,200w)
│   │   └── Box Breathing for Focus (1,000w)
│   ├── 4-7-8 Breathing (1,500w)
│   ├── Diaphragmatic Breathing (1,800w)
│   ├── Alternate Nostril Breathing (1,400w)
│   └── Wim Hof Breathing (1,600w)
├── Use-Case Spokes:
│   ├── Breathing for Beginners (1,500w)
│   ├── Breathing for Panic Attacks (1,400w)
│   └── Morning Breathing Routine (1,200w)
└── Science Spokes:
    ├── How Breathing Affects the Nervous System (2,000w)
    └── Breathwork vs Meditation (1,500w)
```

### Content Mix

- 70% foundational (beginners, high search volume)
- 20% intermediate (specific techniques, moderate volume)
- 10% advanced (science, E-E-A-T signaling, newsletter/LinkedIn depth)

---

## Part 5: Multi-Format Strategy

From one blog article, derive:

| Format | Approach | Not |
|--------|----------|-----|
| **LinkedIn** | Unique angle from the topic, productivity/performance frame, science hook | Not a summary |
| **Instagram** | One visual technique (carousel), "save this for later" format | Not text-heavy |
| **TikTok** | Demonstration video script, hook in 2 seconds, visual timer | Not a blog recap |
| **X Thread** | 5-7 tweets, one insight per tweet, lead with surprising stat | Not a link dump |
| **Newsletter** | Insider angle, unique data from Breathe app, teaser not excerpt | Not the blog post |

---

## API Endpoints

### CMO Chat
```
GET  /customers/:cid/projects/:pid/cmo/chat        # Chat history
POST /customers/:cid/projects/:pid/cmo/chat        # Send message
GET  /customers/:cid/projects/:pid/cmo/agents      # List all agents
GET  /customers/:cid/projects/:pid/cmo/memory      # Memory status + data
```

### Jobs
```
GET  /customers/:cid/projects/:pid/jobs             # List jobs
GET  /customers/:cid/projects/:pid/jobs/:id         # Get job details
POST /customers/:cid/projects/:pid/jobs/article     # Trigger article workflow
POST /customers/:cid/projects/:pid/jobs/social      # Trigger social post workflow
```

### Heartbeat
```
POST /customers/:cid/projects/:pid/heartbeat/competitor-scan
POST /customers/:cid/projects/:pid/heartbeat/trend-scan
POST /customers/:cid/projects/:pid/heartbeat/content-watch
POST /customers/:cid/projects/:pid/heartbeat/trigger
GET  /customers/:cid/projects/:pid/heartbeat/status
```

---

## Migration from v1

The v1 pipelines remain functional. v2 runs in parallel:
- **Topic Chat**: Uses CMO agent (done)
- **Article Production**: `/jobs/article` replaces `/pipeline/produce` (done)
- **Social Posts**: `/jobs/social` replaces topic produce endpoint (done)
- **Monitoring**: New capability (done)
- **Competitor Intelligence**: Replacing flat `competitor-landscape.json` with per-entity system (next)

Long-term: v1 pipeline files will be removed once fully migrated.
