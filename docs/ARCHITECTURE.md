# FlowBoost Architecture

## Overview

FlowBoost is an AI-powered content pipeline that researches, writes, reviews, and publishes content across multiple formats and platforms.

```
┌──────────────────────┐    REST API    ┌──────────────────────┐
│   Next.js Dashboard  │ ◄────────────► │   Fastify Backend    │
│   (React 19, Shadcn) │                │   (TypeScript, ESM)  │
└──────────────────────┘                └──────────┬───────────┘
                                                   │
                                        ┌──────────▼───────────┐
                                        │  Claude Agent SDK    │
                                        │  query() → CLI       │
                                        └──────────┬───────────┘
                                                   │ MCP
                                        ┌──────────▼───────────┐
                                        │  MCP Tools (stdio)   │
                                        │  validate, assemble  │
                                        │  read project data   │
                                        └──────────────────────┘
```

## Core Entities

### Flow (= Topic)

The central workspace. A Flow bundles everything around one content theme. Flows extend the existing `Topic` entity with additional fields.

```
Topic (= Flow)
├── title, status, category, priority
├── keywords                — { primary, secondary[], longTail[] }
├── searchIntent            — "informational" | "how-to" | "transactional" | "navigational"
├── competitorInsights      — string (flat field, not nested)
├── suggestedAngle          — string (flat field, not nested)
├── userNotes?              — free-form notes
├── inputs?                 — FlowInput[] (text, files, URLs, transcripts)
├── outputIds?              — string[] (ContentItem IDs)
├── chat                    — ChatMessage[] (stored as chat.jsonl)
├── format?                 — "article" | "guide" | "landing_page" | "social_post"
├── source?                 — "pipeline" | "user"
└── scheduledDate?
```

Topics from the Strategy Pipeline become Flows when the user creates them. The `inputs` and `outputIds` fields are optional — existing topics without them continue to work.

### ContentItem

A produced piece of content. Universal model for all content types.

```
ContentItem
├── type              — "article" | "guide" | "landing_page" | "video" | "audio" | "social_post" | "newsletter"
├── status            — planned | producing | draft | review | approved | delivered | published | updating | archived
├── title, description?, category?, tags?, keywords?, author?
├── topicId?          — Link to originating Topic
├── flowId (briefingId in data)?       — Link to Flow
├── parentId?         — Link to parent ContentItem
├── currentVersionId?, lastPublishedVersionId?
├── deliveryRef?      — Platform-specific reference (PR number, post ID, category ID)
├── deliveryUrl?      — URL to published content
├── heroImageId?
└── timestamps        — createdAt, updatedAt, approvedAt?, deliveredAt?, publishedAt?, archivedAt?
```

### ContentVersion

A version of a ContentItem. Stores typed metadata per content type.

```
ContentVersion
├── languages[]       — LanguageVariant { lang, slug, title, description, contentPath, wordCount? }
├── assets[]          — MediaAssetRef { assetId, role, lang? }
├── text?             — TextVersionMeta { wordCount, headingCount, hasFaq, hasAnswerCapsule, readabilityScore? }
├── video?            — VideoVersionMeta { durationSeconds, resolution, format, hasSubtitles }
├── audio?            — AudioVersionMeta { durationSeconds, format, sampleRate, hasTranscript }
├── social?           — SocialVersionMeta { platform, characterCount, hashtagCount, hasMedia, format?, slideCount? }
├── newsletter?       — NewsletterVersionMeta { subject, previewText, wordCount, sectionCount }
├── customFields?     — Record<string, unknown> (connector-specific slot data)
├── connectorSchemaId? — Reference to imported connector schema
├── pipelineRunId?    — Which pipeline run produced this
├── seoScore?, qualityScore?
└── createdBy         — "pipeline" | "user" | "sync"
```

### ContentTypeDefinition (CustomContentType)

Defines fields and constraints for a content format. Stored as JSON files in `content-types/` directory per project.

Built-in types (shipped with FlowBoost): `blog-post`, `linkedin-post`, `x-post`, `instagram-post`, `newsletter`.
Connector-imported types: Created via `discoverSchemas()` (e.g. Shopware CMS layouts, WordPress ACF field groups).
Custom types: User-defined via Template Builder (planned).

## Data Flow

```
1. BRIEFING
   User creates a Flow, adds inputs (text, files, URLs).
   Optionally brainstorms with AI via chat, runs Research (enrich).

2. PRODUCE
   User clicks "Create" → selects content type
   → POST /customers/:cid/projects/:pid/topics/:tid/produce { type, platform? }
   → Creates ContentItem with flowId (briefingId in data)
   → Starts appropriate pipeline (production, social_production, email_production)

3. PIPELINE
   AI agents generate content. Each content type has its own pipeline.
   Output: ContentVersion with typed metadata.

4. DELIVERY
   Connector writes content to target platform.
   GitHub: Markdown → Clone → Commit → PR
   Shopware: Slot content → PATCH /api/category (slotConfig merge)
   WordPress: HTML → POST /wp/v2/posts (+ ACF fields)
   Filesystem: File copy
```

## Connectors

### Site Connectors (`connectors/site/`)

| Connector | Write | Schema Discovery | Status |
|---|---|---|---|
| **GitHub** | Clone → Branch → Commit → PR | No (uses built-in blog-post type) | Implemented |
| **Filesystem** | File copy | No | Implemented |
| **Shopware** | PATCH slotConfig on category | Yes — CMS layouts via Admin API | Implemented |
| **WordPress** | POST /wp/v2/posts (+ ACF) | Yes — ACF field groups via REST | Implemented |

Note: `createReader()` for sync is only implemented for GitHub. Shopware and WordPress throw "not yet implemented" for read operations.

### Social Connectors (`connectors/social/`)

Interface defined (`SocialConnector`) with `publish()`, `schedule()`, `delete()`, `getMetrics()`. Implementations planned for LinkedIn, Instagram, TikTok, X, Facebook.

### Media Connectors (`connectors/media/`)

Interface defined (`MediaConnector`) with `upload()`, `updateMetadata()`, `replace()`, `setVisibility()`, `delete()`. Implementations planned for YouTube, Vimeo, Spotify, Apple Podcasts, SoundCloud.

### Schema Discovery

Connectors with API access can discover the target platform's content structure:

```typescript
interface SiteConnector {
  discoverSchemas?(): Promise<ConnectorSchema[]>;
  writeStructured?(project, contentItem, version, schema): Promise<WriteResult>;
}
```

Discovered schemas are imported as `CustomContentType` entries via `POST /content-types/import`.

## Filesystem Layout

```
data/customers/{customerId}/
├── customer.json
├── brand-voice.md
├── style-guide.md          (optional, customer-level)
└── projects/{projectId}/
    ├── project.json
    ├── project-brief.md
    ├── brand-voice.md      (optional, project-level override)
    ├── style-guide.md      (optional, project-level override)
    ├── seo-guidelines.md
    ├── seo-ai-strategy.md
    ├── content-types.md    (content type documentation)
    ├── content-types/      (ContentTypeDefinition JSON files, created on demand)
    ├── section-specs/      (agent writing specs per section type)
    ├── templates/          (article templates)
    ├── topics/{topicId}/   (Flows)
    │   ├── topic.json      (Flow data incl. inputs[], outputIds[])
    │   ├── chat.jsonl      (Brainstorm chat history)
    │   └── inputs/         (Uploaded files)
    ├── content/{contentId}/
    │   ├── content.json    (ContentItem)
    │   ├── versions/{versionId}/
    │   │   ├── version.json
    │   │   ├── content/{lang}/{slug}.md
    │   │   └── assets/{lang}/
    │   └── media/          (ContentMediaAssets)
    └── pipeline-runs/{runId}/
        └── run.json        (PipelineRun with phases + agent calls + events)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, Shadcn/Radix |
| Backend | Fastify 5, TypeScript (ESM), Pino logging |
| AI Engine | Claude Agent SDK, MCP Protocol |
| Image Gen | Google Imagen 4 (via Gemini API) |
| Data | File-based JSON store (no database) |
| Delivery | GitHub App, Shopware Admin API, WordPress REST API |
| Infra | Docker Compose |
