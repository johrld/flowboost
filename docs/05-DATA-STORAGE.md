# Data Storage

## Overview

FlowBoost uses a **file-based JSON store** — no database. All data is stored as JSON files and Markdown documents in a hierarchical directory structure. This makes the system portable, easy to inspect, and simple to back up.

## Directory Structure

```
data/customers/{customerId}/
├── customer.json                    Customer profile (name, plan, authors)
├── brand-voice.md                   Brand voice text (customer-level)
│
└── projects/{projectId}/
    ├── project.json                 Project config (languages, categories, connectors, pipeline)
    ├── project-brief.md             Project brief (AI context)
    ├── brand-voice.md               Brand voice override (project-level > customer-level)
    ├── style-guide.md               Style guide
    ├── seo-guidelines.md            SEO guidelines
    │
    ├── content-types/               ContentType definitions
    │   ├── blog-post.json           fields, agent, pipeline, localization
    │   ├── linkedin-post.json
    │   ├── instagram-post.json
    │   ├── x-post.json
    │   ├── tiktok-post.json
    │   └── newsletter.json
    │
    ├── section-specs/               Section spec templates for article outlines
    │
    ├── topics/{flowId}/             Flows (campaigns)
    │   ├── topic.json               Flow data
    │   ├── chat.jsonl               Shared chat (flow + all content pieces)
    │   └── inputs/                  Uploaded source files
    │
    ├── content/{contentId}/         Content items (flat, not nested under flows)
    │   ├── content.json             Content item metadata
    │   ├── media/                   Content-specific media
    │   └── versions/{versionId}/    Content versions
    │       ├── version.json         Version metadata
    │       ├── content/{lang}/      Language-specific content files
    │       └── assets/{lang}/       Language-specific assets
    │
    ├── media/                       Global media library
    │   └── {assetId}/
    │       ├── asset.json           Asset metadata
    │       └── file.png             Asset file
    │
    └── pipeline-runs/{runId}/       Pipeline execution records
        └── run.json                 Run metadata + phases + agent calls
```

## Entity Details

### Customer (`customer.json`)

```json
{
  "id": "default",
  "name": "FlowBoost User",
  "plan": "pro",
  "authors": [
    { "id": "alex", "name": "Alex Demo", "role": { "de": "Content Manager" }, "image": "/avatars/user5.png" }
  ]
}
```

### Project (`project.json`)

```json
{
  "id": "f33130c5-...",
  "name": "breathe",
  "defaultLanguage": "en",
  "languages": [
    { "code": "en", "name": "English", "enabled": true },
    { "code": "de", "name": "German", "enabled": true }
  ],
  "categories": [{ "id": "meditation", "labels": { "en": "Meditation" } }],
  "connectors": [{ "type": "github", ... }],
  "pipeline": { "defaultModel": "sonnet", "maxRetriesPerPhase": 2 }
}
```

### Flow (`topic.json`)

A Flow is a campaign workspace. Internally named "Topic" for historical reasons.

```json
{
  "id": "cb4bc096-...",
  "title": "Sommerurlaub",
  "briefing": "Campaign for stressed professionals who can't switch off on vacation...",
  "direction": "Practical, not esoteric",
  "category": "meditation",
  "status": "proposed",
  "source": "user",
  "inputs": [
    {
      "id": "input-1",
      "type": "url",
      "content": "https://calm.com/travel",
      "processed": { "status": "completed", "summary": "Travel meditation guide..." }
    }
  ],
  "outputIds": ["content-abc", "content-def"],
  "chatDistillation": {
    "keyDecisions": ["Focus on 5-min sessions"],
    "mustInclude": ["Airplane meditation"],
    "toneNotes": "Warm, practical"
  },
  "enrichment": {
    "seo": { "keywords": { "primary": "travel meditation", ... } },
    "reasoning": "High search volume, low competition"
  }
}
```

### Chat (`chat.jsonl`)

One chat per flow, shared across flow page and all content editors. Each line is a JSON object:

```jsonl
{"role":"user","content":"Can you fill the briefing?","ts":"2026-03-29T10:00:00Z"}
{"role":"assistant","content":"Sure! Here's a briefing...","ts":"2026-03-29T10:00:05Z"}
```

### Content Item (`content.json`)

Flat — not nested under flows. Connected via `flowId` reference.

```json
{
  "id": "8e25e840-...",
  "type": "social_post",
  "status": "draft",
  "title": "Sommerurlaub",
  "category": "linkedin",
  "flowId": "cb4bc096-...",
  "originFlowId": "cb4bc096-...",
  "currentVersionId": "1879f736-...",
  "scheduledDate": "2026-04-01T14:00",
  "heroImageId": "asset-uuid"
}
```

**Reference pattern:**
- `flowId` — active link to flow (nullable, cleared when flow archived + content published)
- `originFlowId` — immutable provenance (set once at creation, never cleared)
- `topicId` — deprecated alias for `flowId`

### Content Version (`version.json`)

```json
{
  "id": "1879f736-...",
  "contentId": "8e25e840-...",
  "versionNumber": 1,
  "languages": [
    { "lang": "en", "slug": "sommerurlaub", "title": "...", "contentPath": "content/en/linkedin-post.json", "wordCount": 150 }
  ],
  "social": { "platform": "linkedin", "characterCount": 847, "hashtagCount": 3 },
  "pipelineRunId": "run-uuid",
  "createdBy": "pipeline"
}
```

**Content files by type:**
- Articles: `content/{lang}/{slug}.md` (Markdown with YAML frontmatter)
- Social/Email: `content/{lang}/{contentTypeId}.json` (JSON with field values)

### Content Type (`blog-post.json`)

See [03-CONTENT-TYPES.md](03-CONTENT-TYPES.md) for full documentation.

Key fields: `fields[]`, `agent` (role + guidelines), `pipeline` (mode + phases), `localization` (single/multi).

### Pipeline Run (`run.json`)

```json
{
  "id": "run-uuid",
  "type": "production",
  "status": "completed",
  "flowId": "cb4bc096-...",
  "contentId": "8e25e840-...",
  "phases": [
    { "name": "outline", "status": "completed", "agentCalls": [...] },
    { "name": "write", "status": "completed", "agentCalls": [...] }
  ],
  "totalCostUsd": 0.12,
  "totalTokens": { "input": 15000, "output": 8000 }
}
```

## Reference Chains

### Flow → Content Items

```
Flow.outputIds: ["content-1", "content-2"]
  ↓
ContentItem.flowId: "flow-abc"           (active, nullable)
ContentItem.originFlowId: "flow-abc"     (immutable)
```

Bidirectional but maintained at application layer. Stale `outputIds` cleaned on read.

### Content → Version → Files

```
ContentItem.currentVersionId → ContentVersion.id
  ↓
ContentVersion.languages[0].contentPath → "content/en/slug.md"
  ↓
Actual file: versions/{versionId}/content/en/slug.md
```

### Chat Sharing

```
Flow chat:     topics/{flowId}/chat.jsonl
Content chat:  reads/writes → topics/{flowId}/chat.jsonl (same file!)
```

One conversation per flow. System prompt adapts based on where the user is.

## Status Lifecycle

### Content Item

```
planned → producing → draft → review → approved → delivered → published
                        │       │                                 ↓
                        │       └── draft (reject)          updating → delivered
                        └── archived
Any status → archived
archived → draft (restore)
```

### Flow (Topic)

```
proposed → approved → in_production → produced → archived
rejected → proposed (restore)
archived → proposed (restore)
```

## Localization

```
Project Settings → languages pool (EN, DE, ES)
         ↓
ContentType → localization.mode:
  "multi"  → article has tabs per language, pipeline auto-translates
  "single" → social post is one language, no tabs
         ↓
Content Version → languages[] array with one entry per language
```

## Version Management

- **Save** overwrites current draft version (no bloat)
- **"Save as new version"** explicitly creates a checkpoint
- **Pipeline** always creates a new version
- Published versions cannot be deleted
