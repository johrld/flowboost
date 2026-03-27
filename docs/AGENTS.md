# FlowBoost AI Agents

## The Key Concept

FlowBoost has **one generic Content Writer agent** that works for every content type. It gets its personality, writing rules, and output format from the **ContentType JSON definition** — not from code.

When you produce a LinkedIn Post, the agent becomes a "Senior LinkedIn strategist". When you produce a Newsletter, the same agent becomes a "Newsletter writer". The difference is entirely in the configuration (role, guidelines, fields), not in the code.

The only exception: **Blog Posts** use a specialized 6-agent pipeline because articles need research, outlining, section-by-section writing, quality checks, and translation — tasks too complex for a single agent call.

## Which Agent Handles What?

```
LinkedIn Post     → Content Writer (1 agent, 1 call)
Instagram Post    → Content Writer (1 agent, 1 call)
X Post            → Content Writer (1 agent, 1 call)
TikTok Post       → Content Writer (1 agent, 1 call)
Newsletter        → Content Writer (1 agent, 1 call)
Any custom type   → Content Writer (1 agent, 1 call)

Blog Post         → 6 specialized agents (research, outline, write, quality, image, translate)
```

## Single-Phase Pipeline: Content Writer

Used for **all** content types except blog posts. One agent generates the complete output in a single call.

```
Flow Context (title, sources, chat)
  +
ContentType Definition (role, guidelines, fields)
  │
  ▼
Content Writer Agent
  ├── Identity: ContentType.agent.role
  │   e.g. "Senior LinkedIn content strategist"
  │
  ├── Rules: ContentType.agent.guidelines
  │   e.g. "Hook in first line, max 5 hashtags, 800-1500 chars"
  │
  ├── Output: auto-generated from ContentType.fields
  │   e.g. { "text": "...", "hashtags": [...], "image": "..." }
  │
  ├── Context: Flow sources + chat distillation + enrichment (if available)
  │
  └── Tools: Read, WebSearch, WebFetch, Brand Voice (MCP)
```

The agent can research on-demand via WebSearch if no sources were provided. The prompt is built by `pipeline/prompts/content-writer.ts` — fully data-driven from the ContentType.

**To add a new content type, you only create a JSON file.** No agent code changes needed.

## Multi-Phase Pipeline: Blog Post Production

Used exclusively for blog posts (`pipeline.mode: "multi-phase"`). Six specialized agents run in sequence, each with a focused task and dedicated tools.

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: RESEARCH                                              │
│  Agent: SEO Researcher                                          │
│  Task: Find keywords, analyze competitors, determine structure  │
│  Tools: WebSearch, WebFetch                                     │
│  Skipped if: Flow already has enrichment.seo data              │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: OUTLINE                                               │
│  Agent: Outline Architect                                       │
│  Task: Design article structure (H1, H2s, FAQ, meta)           │
│  Tools: Read, MCP (brand voice, templates, section specs)      │
│  Output: JSON outline with sections, word targets, keywords     │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3: WRITE (parallel)                                      │
│  Agent: Section Writer (x N, one per section)                   │
│  Task: Write one section following the outline                  │
│  Tools: Read, Write, MCP (validate_section)                    │
│  Output: Individual markdown files per section                  │
├─────────────────────────────────────────────────────────────────┤
│  Phase 4: QUALITY (with retry)                                  │
│  Agents: SEO Checker + Content Reviewer (parallel)             │
│  Task: Validate SEO, structure, brand voice compliance         │
│  Tools: Read, MCP (validate_article)                           │
│  Retry: If fail → re-run assembly + quality (up to N retries)  │
├─────────────────────────────────────────────────────────────────┤
│  Phase 5: IMAGE (non-fatal)                                     │
│  Agent: Image Generator                                         │
│  Task: Generate hero image based on article content            │
│  Tools: Read, MCP (generate_image via Imagen 4)                │
│  Failure: Pipeline continues without image                      │
├─────────────────────────────────────────────────────────────────┤
│  Phase 6: TRANSLATE (parallel)                                  │
│  Agent: Translator (x N, one per target language)              │
│  Task: Translate article preserving structure and SEO          │
│  Tools: Read, Write, MCP (validate_article)                    │
└─────────────────────────────────────────────────────────────────┘
```

## Strategy Pipeline: Content Planning

Discovers content opportunities. Generates Flow proposals with SEO enrichment data. Not tied to any specific content type.

```
Audit Agent → Research Agent → Strategy Agent
```

| Agent | Task | Tools |
|-------|------|-------|
| Content Auditor | Analyze existing content, find gaps | MCP (content index) |
| Topic Researcher | Research topics, keywords, competition | WebSearch, WebFetch |
| Content Strategist | Prioritize topics, assign categories | MCP (brand voice, content types) |

Output: Flows with `enrichment.seo` (keywords, search intent, competitor insights).

## Enrichment Pipeline

Optional single-agent pipeline. Enriches a Flow with SEO research data. Useful when:
- Strategy pipeline generated a topic without full research
- User created a Flow manually and wants keyword data before producing a blog post

Not needed when the user provides sufficient sources — the Content Writer agent can research on-demand via WebSearch during production.

## How Agents Work (Technical)

### Engine

FlowBoost uses the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents/agent-sdk). Each agent is a Claude subprocess with specific tools.

| Function | MCP Tools | Tracking | Used For |
|----------|-----------|----------|----------|
| `runAgentTracked()` | Yes | Yes (events to disk) | All pipeline phases |
| `runSimpleAgent()` | No | No | Flow chat (brainstorm) |

### MCP Tools

Agents access FlowBoost tools via a stdio MCP server (`tools/mcp-stdio-server.ts`):

| Tool | Purpose | Used By |
|------|---------|---------|
| `flowboost_read_project_data` | Brand voice, style guide, templates | All agents |
| `flowboost_read_content_index` | Existing content for audit | Strategy, Enricher |
| `flowboost_validate_article` | Validate markdown (SEO, structure) | Blog post pipeline |
| `flowboost_validate_section` | Validate a single section | Blog post pipeline |
| `flowboost_assemble_article` | Merge section files | Blog post pipeline |
| `flowboost_generate_image` | Generate via Imagen 4 | Blog post pipeline |
| `flowboost_read_article` | Read from repo | Blog post pipeline |

### Context Layers

Every agent receives context in layers:

```
1. Project Level (always)
   Brand Voice, Style Guide, Project Brief, Pipeline Settings

2. Flow Level (from the user's Flow)
   Title, Direction, Source Summaries, Chat Distillation, Enrichment

3. ContentType Level (defines agent behavior)
   Role, Guidelines, Field Constraints, Output Schema
```

### Prompt Files

| File | What It Does | When It's Used |
|------|-------------|----------------|
| `content-writer.ts` | Builds prompt from ContentType definition | **Every single-phase content type** (LinkedIn, Instagram, X, TikTok, Newsletter, custom) |
| `outline-architect.ts` | Plans article structure | Blog post only |
| `section-writer.ts` | Writes one article section | Blog post only |
| `content-editor.ts` | Assembles sections into article | Blog post only |
| `seo-checker.ts` | Validates SEO compliance | Blog post only |
| `reviewer.ts` | Reviews brand voice + quality | Blog post only |
| `image-generator.ts` | Creates image generation prompt | Blog post only |
| `translator.ts` | Translates preserving structure | Blog post only |
| `enricher.ts` | SEO keyword + competitor research | Enrich pipeline |
| `auditor.ts` | Content gap analysis | Strategy pipeline |
| `researcher.ts` | Topic discovery | Strategy pipeline |
| `strategist.ts` | Topic prioritization | Strategy pipeline |

## Monitoring

Pipeline runs are tracked in real-time. Each agent call persists events via `runAgentTracked()`. The Monitor page shows live agent activity, phase progress, and cost tracking per run.
