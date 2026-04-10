# FlowBoost Agent System v2

## Overview

FlowBoost v2 replaces the fixed pipeline architecture with a **CMO-driven hierarchical agent system** inspired by [Paperclip AI](https://github.com/paperclipai/paperclip). Instead of hardcoded pipeline chains, work is organized into **Jobs** delegated to specialized agents, with persistent **Project Memory** that accumulates intelligence across runs.

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
│           │  │Editor      │  │                   │
│           │  │Social      │  │                   │
│           │  │Newsletter  │  │                   │
│           │  │Translator  │  │                   │
│           │  │Image Gen   │  │                   │
└──────────┘  └────────────┘  └───────────────────┘
```

## Core Concepts

### Jobs (not Pipelines)

A **Job** is a concrete work assignment for an agent. Jobs have:
- **Type**: `research`, `write_article`, `write_section`, `write_social`, `quality_check`, `monitor_competitors`, etc.
- **Status lifecycle**: `queued → in_progress → in_review → done | failed | blocked | cancelled`
- **Delegation**: Jobs can have a `parentJobId` (e.g., section-writer jobs are children of the outline job)
- **Comments**: Agent-to-agent communication thread on each job
- **Input/Output**: Structured JSON data flowing between agents

```
POST /customers/:cid/projects/:pid/jobs/article
  → creates Research Job → Outline Job → N Section Writer Jobs → Editor Job → Quality Jobs
  → each agent reads the previous job's output
```

### Agent Registry

16 agents defined in code (`backend/src/agents/registry.ts`). Each agent has:
- **Model**: sonnet, haiku, or opus
- **Skills**: Markdown instruction files loaded at runtime
- **Tools**: MCP tools + WebSearch access
- **Capabilities**: canDelegate, canApprove, heartbeat schedule

| Agent | Role | Model | Key Tools |
|-------|------|-------|-----------|
| `cmo` | Chief Marketing Officer | sonnet | All MCP + WebSearch |
| `research` | Content Researcher | sonnet | Memory + WebSearch |
| `outline-architect` | Article Outline | sonnet | MCP tools |
| `section-writer` | Section Writer (N parallel) | sonnet | Validate section |
| `content-editor` | Assembler | sonnet | Assemble + validate |
| `quality-seo` | SEO Checker | haiku | Content index |
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

### Skills (Markdown Injection)

Agent behavior is defined by **Markdown skill files** (`backend/src/agents/skills/*.md`), not by code. To change how an agent writes, edit its skill file. No recompilation needed.

Skills are loaded at execution time and injected into the agent's system prompt. Each agent's `skills` array in the registry determines which files are loaded.

### Project Memory (PARA Structure)

Persistent knowledge stored as JSON files using the PARA method:

```
data/customers/{cid}/projects/{pid}/memory/
  areas/
    competitor-landscape.json   # What competitors publish
    content-portfolio.json      # Summary of our content
    brand-context.json          # Brand voice, audience, tone
  resources/
    citation-sources.json       # Vetted authoritative sources
    topic-clusters.json         # Pillar → subtopic mapping
    seo-guidelines.json         # SEO rules for the niche
    author-profiles.json        # Authors with credentials
  projects/
    current-campaign.json       # Active campaign with goals
  archives/
    competitor-2026-Q1.json     # Historical snapshots
  meta.json                     # Last-updated timestamps
```

Memory is **project-level** (shared across all agents, not per-agent). Background monitors update it; the CMO and production agents read it.

MCP tools: `flowboost_read_memory`, `flowboost_write_memory`

### Heartbeat System

Background agents run on schedule, triggered by external cron calling HTTP endpoints:

```bash
# Crontab example
0 9 * * 1  curl -X POST http://localhost:6100/customers/.../heartbeat/competitor-scan
0 9 * * 3  curl -X POST http://localhost:6100/customers/.../heartbeat/trend-scan
0 6 * * *  curl -X POST http://localhost:6100/customers/.../heartbeat/content-watch

# Or: trigger all due monitors at once
*/30 * * * *  curl -X POST http://localhost:6100/customers/.../heartbeat/trigger
```

## API Endpoints

### CMO Chat
```
GET  /customers/:cid/projects/:pid/cmo/chat        # Chat history
POST /customers/:cid/projects/:pid/cmo/chat        # Send message
GET  /customers/:cid/projects/:pid/cmo/agents      # List all agents
GET  /customers/:cid/projects/:pid/cmo/memory      # Memory status
```

### Jobs
```
GET  /customers/:cid/projects/:pid/jobs             # List jobs (filter: status, flowId, type)
GET  /customers/:cid/projects/:pid/jobs/:id         # Get job details
POST /customers/:cid/projects/:pid/jobs/article     # Trigger article workflow
POST /customers/:cid/projects/:pid/jobs/social      # Trigger social post workflow
```

### Heartbeat
```
POST /customers/:cid/projects/:pid/heartbeat/competitor-scan
POST /customers/:cid/projects/:pid/heartbeat/trend-scan
POST /customers/:cid/projects/:pid/heartbeat/content-watch
POST /customers/:cid/projects/:pid/heartbeat/trigger    # Run all due monitors
GET  /customers/:cid/projects/:pid/heartbeat/status     # Last-run timestamps
```

## Article Workflow

```
User creates Flow → CMO Chat discusses strategy
  │
  ├── POST /jobs/article { flowId, skipResearch? }
  │
  ├── Research Agent
  │   Reads: memory (competitors, gaps, trends)
  │   Searches: keywords, competitor articles, sources
  │   Output: { keywords, competitorArticles, suggestedAngle, sources }
  │
  ├── Outline Architect
  │   Reads: research output + memory (clusters, citations)
  │   Output: { title, sections[], targetWordCount, faqTopics }
  │
  ├── Section Writers (N parallel jobs)
  │   Each writes one section to target word count
  │   Output: Markdown per section
  │
  ├── Content Editor
  │   Assembles all sections into complete article
  │   Output: Full Markdown with front matter
  │
  ├── Quality Checks (parallel)
  │   ├── SEO Check (always)
  │   ├── Citation Check (if healthContentChecks)
  │   ├── E-E-A-T Check (if healthContentChecks)
  │   └── Health Claims (if healthContentChecks)
  │
  └── ContentItem created as "draft" or "review"
```

## Health Content Quality (E-E-A-T)

Enabled per project via `pipeline.healthContentChecks: true`. Adds three quality agents:

1. **Citation Checker** — verifies all health claims have PubMed/WHO/NIH citations
2. **E-E-A-T Checker** — validates author schema, medical reviewer, disclaimers
3. **Health Claims Validator** — flags absolute claims ("cures"), unsupported assertions

## Migration from v1

The v1 pipelines (`pipeline/strategy/`, `pipeline/production/`, etc.) remain functional. The v2 system runs in parallel:

- **Topic Chat**: Automatically uses CMO agent (no migration needed)
- **Article Production**: Use `/jobs/article` instead of `/pipeline/produce`
- **Social Posts**: Use `/jobs/social` instead of topic produce endpoint
- **Monitoring**: New capability, no v1 equivalent

Long-term: v1 pipeline files will be removed once all frontend endpoints are migrated to the job system.
