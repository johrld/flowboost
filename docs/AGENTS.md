# FlowBoost AI Agents

## How Agents Work

FlowBoost uses the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents/agent-sdk) to run AI agents. Each agent is a Claude subprocess with specific tools and a focused prompt.

```
Pipeline
  └── Phase (e.g. "writing")
       └── Agent Call
            ├── Prompt (built from project context + phase-specific instructions)
            ├── Model (from project pipeline settings)
            ├── Tools (Read, Write, WebSearch, MCP tools)
            └── Result (text + cost + tokens + events)
```

### Engine Functions (`pipeline/engine.ts`)

| Function | MCP Tools | Tracking | Used For |
|---|---|---|---|
| `runAgent()` | Yes | No | Pipeline phases (internal) |
| `runAgentTracked()` | Yes | Yes (persists events to disk) | All pipeline phases (wraps runAgent) |
| `runSimpleAgent()` | No | No | Topic chat (brainstorm) |

## MCP Tools

Agents access FlowBoost-specific tools via a stdio MCP server (`tools/mcp-stdio-server.ts`):

| Tool | Purpose |
|---|---|
| `flowboost_validate_section` | Validate a content section against type-specific rules |
| `flowboost_validate_article` | Validate a complete markdown article (SEO, structure) |
| `flowboost_assemble_article` | Merge section files into a complete article |
| `flowboost_generate_image` | Generate image via Google Imagen 4 |
| `flowboost_read_project_data` | Read project config, brand voice, style guide, SEO guidelines, templates, section specs |
| `flowboost_read_content_index` | Read existing content for audit/gap analysis |
| `flowboost_read_article` | Read article content from GitHub repo |

### Resources available via `read_project_data`

`project`, `brand-voice`, `style-guide`, `seo-guidelines`, `seo-ai-strategy`, `content-types`, `content-plan`, `template:<name>`, `section-spec:<name>`

Brand voice and style guide use fallback: project-level → customer-level.

## Pipelines

### Strategy Pipeline

Discovers content opportunities. Three agents run sequentially.

```
Audit → Research → Strategy
```

| Phase | Agent | Model | Tools | Output |
|---|---|---|---|---|
| **Audit** | Content Auditor | project default | Read, MCP: read_project_data, read_content_index | Content gaps, coverage by category/language |
| **Research** | Topic Researcher | project default | WebSearch, WebFetch, Read, MCP: read_project_data | Topic proposals with keywords, intent, competitors |
| **Strategy** | Content Strategist | project default | Read, Write, MCP: read_project_data | Prioritized topics saved to TopicStore |

### Production Pipeline (Articles/Guides)

Produces a complete article from an approved topic/briefing.

```
Outline → Writing (parallel) → Assembly → Image → Quality (retry) → Translation (parallel)
```

| Phase | Agent(s) | Model | Tools | Output |
|---|---|---|---|---|
| **Outline** | Outline Architect | project default | Read, Write, MCP: read_project_data | Article structure with sections |
| **Writing** | Section Writer (×N, parallel) | project default | Read, Write, MCP: read_project_data, validate_section | Individual section files |
| **Assembly** | Content Editor | project default | Read, Write, MCP: read_project_data, assemble_article, validate_article | Complete markdown article |
| **Image** | Image Generator | project default | Read, MCP: generate_image | Hero image via Imagen 4 (non-fatal) |
| **Quality** | SEO Checker + Content Reviewer (2 agents, parallel) | haiku (SEO) + project default (reviewer) | Read, MCP: read_project_data, validate_article | Quality scores, pass/fail |
| **Translation** | Translator (×N, parallel) | project default | Read, Write, MCP: read_project_data, validate_article | Translated article per language |

Quality failures trigger a retry (re-runs Assembly + Quality, up to `maxRetriesPerPhase`). Image failures are non-fatal — the pipeline continues without a hero image.

### Social Production Pipeline

Produces a social media post (LinkedIn, X, Instagram, TikTok).

```
Generate → Image (planned, not yet implemented)
```

| Phase | Agent | Model | Tools | Output |
|---|---|---|---|---|
| **Generate** | Social Writer | project default | Read, MCP: read_project_data | Post text, hashtags, format, image prompt |
| **Image** | (Imagen 4) | — | — | Social media image (planned, currently skipped) |

The Social Writer prompt is **platform-aware** — it knows each platform's character limits, hashtag rules, media requirements, and best practices. Platform specs are defined in `pipeline/prompts/social-writer.ts`.

Supported platforms: `linkedin` (3000 chars), `x` (280 chars), `instagram` (2200 chars, image required), `tiktok` (4000 chars, video required).

### Email Production Pipeline

Produces a newsletter.

```
Generate
```

| Phase | Agent | Model | Tools | Output |
|---|---|---|---|---|
| **Generate** | Newsletter Writer | project default | Read, MCP: read_project_data | Subject, preview text, sections, CTA |

### Video Production Pipeline

Produces video content. Pipeline exists in code but is not exposed via the Briefing UI.

```
Script → Storyboard → Generate → Subtitle → Thumbnail
```

### Audio Production Pipeline

Produces audio content (podcasts, narration). Pipeline exists in code but is not exposed via the Briefing UI.

```
Script → Voice → Transcript
```

### Enrich Pipeline

Enriches a single topic with AI-powered keyword and competitor research.

```
Enrich
```

| Phase | Agent | Model | Tools | Output |
|---|---|---|---|---|
| **Enrich** | Topic Enricher | project default | WebSearch, WebFetch, Read, MCP: read_project_data, read_content_index | Keywords, competitor insights, suggested angle |

## Agent Context

Every agent receives layered context:

```
1. Project Level (always)
   ├── Brand Voice (project override → customer fallback)
   ├── Style Guide (project override → customer fallback)
   ├── Project Brief
   ├── SEO Guidelines
   ├── SEO AI Strategy
   ├── Section Specs + Templates
   └── Pipeline Settings (model, retries, imagen model)

2. Briefing Level (when producing from briefing)
   ├── Inputs (transcripts, notes, URLs)
   ├── Research fields (keywords, competitors, angle)
   └── Brainstorm chat history

3. Phase Level (specific to the pipeline phase)
   ├── Previous phase output (e.g. outline for section writers)
   ├── Platform specs (for social writers)
   └── Quality feedback (for retry loops)
```

## Prompt Files

All agent prompts are in `pipeline/prompts/`:

| File | Agent | Used By |
|---|---|---|
| `auditor.ts` | Content Auditor | Strategy Pipeline |
| `researcher.ts` | Topic Researcher | Strategy Pipeline |
| `strategist.ts` | Content Strategist | Strategy Pipeline |
| `outline-architect.ts` | Outline Architect | Production Pipeline |
| `section-writer.ts` | Section Writer | Production Pipeline |
| `content-editor.ts` | Content Editor (Assembly) | Production Pipeline |
| `image-generator.ts` | Image Generator | Production Pipeline |
| `seo-checker.ts` | SEO Checker | Production Pipeline (Quality) |
| `reviewer.ts` | Content/Brand Reviewer | Production Pipeline (Quality) |
| `translator.ts` | Translator | Production Pipeline |
| `enricher.ts` | Topic Enricher | Enrich Pipeline |
| `social-writer.ts` | Social Writer | Social Pipeline |
| `newsletter-writer.ts` | Newsletter Writer | Email Pipeline |

## Monitoring

Pipeline runs are tracked in real-time. Each agent call persists events to disk via `runAgentTracked()`:

```json
{
  "type": "tool_call",
  "timestamp": "2026-03-25T10:30:00Z",
  "tool": "WebSearch",
  "input": "atemtechnik anfänger keyword difficulty"
}
```

The frontend Monitor page polls `GET /pipeline/runs/:id` to show live agent activity, phase progress, and cost tracking.
