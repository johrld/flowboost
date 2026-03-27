# FlowBoost Architecture

## Overview

FlowBoost is an AI-powered content pipeline. Users create **Flows** (creative workspaces), add sources, brainstorm with AI, then produce any type of content — blog posts, social media, newsletters, and platform-specific formats (Shopware, WordPress ACF).

```
┌──────────────────────┐    REST API    ┌──────────────────────┐
│   Next.js Frontend   │ <────────────> │   Fastify Backend    │
│   (React 19, Shadcn) │                │   (TypeScript, ESM)  │
└──────────────────────┘                └──────────┬───────────┘
                                                   │
                                        ┌──────────▼───────────┐
                                        │  Claude Agent SDK    │
                                        │  Agents + MCP Tools  │
                                        └──────────┬───────────┘
                                                   │
                                        ┌──────────▼───────────┐
                                        │  Connectors          │
                                        │  GitHub, WordPress,  │
                                        │  Shopware, Filesystem│
                                        └──────────────────────┘
```

## User Flow

```
1. CREATE FLOW         User creates a Flow with a title ("Atemtechnik für Einsteiger")
       │
2. ADD SOURCES         Upload PDFs, paste URLs, record voice memos, add images
       │               Each source is auto-processed (summarized, transcribed, described)
       │
3. BRAINSTORM          Chat with AI about direction, tone, key points
       │               Chat distillation extracts decisions automatically
       │
4. SELECT CONTENT      Choose what to produce: Blog Post, LinkedIn, Newsletter, etc.
       │               Each is a ContentType — defines fields, agent, pipeline
       │
5. CREATE WITH AI      Click "Create with AI" on any content type
       │               ├── LinkedIn/Instagram/Newsletter → 1 agent, instant
       │               └── Blog Post → 6 agents, multi-phase (research → publish)
       │
6. EDIT + REFINE       Review AI output in editor, chat for refinement
       │
7. APPROVE + DELIVER   Connector writes to platform (GitHub PR, WordPress, etc.)
```

## Core Principles

1. **ContentType-driven** — The ContentType (JSON definition) drives everything: what the agent writes, how it writes, which pipeline phases run. No hardcoded content logic.
2. **Flow = neutral workspace** — A Flow has a title, sources, and chat. No article-specific fields. SEO data lives in optional `enrichment`.
3. **Flat content model** — ContentItems are not nested under Flows. Connected via `flowId` reference (like Contentful).
4. **Safe references** — `flowId` (active, nullable) + `originFlowId` (immutable provenance). Broken references don't crash.

## Entity Hierarchy

```
Customer
  ├── brand-voice.md
  └── Project (1:N)
       ├── languages[], categories[], keywords{}
       ├── connector (delivery platform config)
       ├── pipeline (AI model settings)
       ├── content-types/ (JSON definitions)
       │
       ├── Flow (1:N)  ← "Topic" in code
       │    ├── title, category, direction
       │    ├── inputs[] (sources: text, URLs, PDFs, audio, images)
       │    ├── chat + chatDistillation
       │    ├── enrichment? (optional SEO research cache)
       │    └── outputIds[] → refs to ContentItems
       │
       ├── ContentItem (1:N)  ← flat, not nested under Flow
       │    ├── type: article | social_post | newsletter | guide | ...
       │    ├── flowId → active ref to Flow (nullable)
       │    ├── originFlowId → immutable provenance
       │    └── ContentVersion (1:N)
       │         ├── languages[] (lang, slug, title, contentPath)
       │         ├── text? | social? | newsletter? (type-specific meta)
       │         └── customFields? (connector slot data)
       │
       ├── MediaAsset (1:N)  ← project-wide library
       ├── PipelineRun (1:N)  ← flowId + contentId refs
       └── ContentIndex (sync state with platforms)
```

## ContentType System

ContentTypes define **what** gets produced and **how** the AI agent works. Stored as JSON files per project.

```
content-types/
  blog-post.json          ← multi-phase, SEO-optimized articles
  linkedin-post.json      ← single-phase, thought leadership
  instagram-post.json     ← single-phase, visual-first
  x-post.json             ← single-phase, 280 chars
  tiktok-post.json        ← single-phase, hook-driven
  newsletter.json         ← single-phase, email
  shopware-landing.json   ← imported from connector schema
```

Each ContentType defines:

| Field | Purpose |
|-------|---------|
| `fields[]` | Content fields with types and constraints (charLimit, wordCount, maxItems) |
| `agent.role` | Agent identity — first line of system prompt |
| `agent.guidelines` | Markdown: tone, structure, dos/don'ts |
| `pipeline.mode` | `"single-phase"` or `"multi-phase"` |
| `pipeline.phases` | Ordered phase list: `["write", "image"]` or `["research", "outline", "write", "quality", "image", "translate"]` |
| `category` | `"site"` / `"social"` / `"email"` / `"media"` |

**Adding a new content type requires zero code changes** — just create a JSON file.

## Data Flow

```
1. CREATE FLOW
   User creates Flow with title + direction.
   Optionally uploads sources (URLs, PDFs, audio, images, text).
   Each source is auto-processed (summarized, transcribed, described).

2. BRAINSTORM (optional)
   User chats with AI about direction, tone, structure.
   Chat distillation extracts key decisions, must-includes, rejected ideas.

3. PRODUCE
   User selects ContentType (e.g. "LinkedIn Post") → clicks "Create with AI".
   POST /topics/:id/produce { contentTypeId: "linkedin-post" }
   → ContentItem created (status: planned)
   → Pipeline dispatched based on ContentType.pipeline.mode

4. PIPELINE
   Single-phase: Write (+ optional Image) → ContentVersion created
   Multi-phase: Research → Outline → Write → Quality → Image → Translate

5. REVIEW + EDIT
   User sees result in editor, edits fields, chats for refinement.

6. DELIVERY
   Approve → Connector writes to platform (GitHub PR, WordPress post, Shopware slot, filesystem).
```

## Pipeline Architecture

```
ContentType.pipeline.mode
  │
  ├── "single-phase" → runContentPipeline(ctx, contentTypeId)
  │   Generic pipeline for ANY ContentType.
  │   Loads ContentType → builds prompt → runs agent → creates version.
  │   Agent has: WebSearch, WebFetch, Read, MCP tools.
  │   Works for: social, email, any future single-phase type.
  │
  └── "multi-phase" → runProductionPipeline(ctx)
      Blog-post specific (6 specialized agents).
      Research → Outline → Write → Assembly → Quality → Image → Translate.
      Each phase has a dedicated agent with focused tools.
```

## Connectors

| Connector | Write | Publish | Schema Discovery |
|-----------|-------|---------|-----------------|
| **GitHub** | Clone → Branch → Commit → PR | Merge PR | No |
| **WordPress** | POST /wp/v2/posts (+ ACF) | Update status | Yes (ACF field groups) |
| **Shopware** | PATCH slotConfig on category | Direct | Yes (CMS layouts) |
| **Filesystem** | File copy | Immediate | No |

Connector interface: `write(project, contentItem, languages, versionDir)` → `WriteResult`.

## Filesystem Layout

```
data/customers/{customerId}/
├── customer.json
├── brand-voice.md
└── projects/{projectId}/
    ├── project.json
    ├── project-brief.md
    ├── content-types/*.json       ← ContentType definitions
    ├── topics/{topicId}/          ← Flows
    │   ├── topic.json
    │   ├── chat.jsonl
    │   └── inputs/
    ├── content/{contentId}/       ← Content Items
    │   ├── content.json
    │   ├── media/
    │   └── versions/{versionId}/
    │       ├── version.json
    │       ├── content/{lang}/{slug}.md
    │       └── assets/{lang}/
    ├── media/                     ← Project media library
    └── pipeline-runs/{runId}/
        └── run.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, Shadcn/Radix |
| Backend | Fastify 5, TypeScript (ESM), Pino logging |
| AI Engine | Claude Agent SDK, MCP Protocol |
| Image Gen | Google Imagen 4 (via Gemini API) |
| Data | File-based JSON store (no database) |
| Delivery | GitHub App, Shopware Admin API, WordPress REST API |
| Infra | Docker Compose |
