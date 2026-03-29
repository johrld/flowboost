# Content Types

## Overview

A ContentType is a JSON definition that tells FlowBoost **what** to produce and **how** the AI agent should work. It's the central configuration unit — no code changes needed to add a new content type.

## Built-in Types

| ID | Label | Category | Pipeline | Phases |
|----|-------|----------|----------|--------|
| `blog-post` | Blog Post | site | multi-phase | outline, write, assembly, image, quality, translate |
| `linkedin-post` | LinkedIn Post | social | single-phase | write, image |
| `instagram-post` | Instagram Post | social | single-phase | write, image |
| `x-post` | X Post | social | single-phase | write |
| `tiktok-post` | TikTok Post | social | single-phase | write, image |
| `newsletter` | Newsletter | email | single-phase | write |

## Examples

### Example 1: LinkedIn Post (social, single-phase)

Minimal content type — 3 fields, focused guidelines, one-shot generation.

```json
{
  "id": "linkedin-post",
  "label": "LinkedIn Post",
  "description": "Professional network post",
  "category": "social",
  "source": "builtin",
  "icon": "linkedin",
  "pipeline": {
    "mode": "single-phase",
    "phases": ["write", "image"],
    "requiresEnrichment": false
  },
  "agent": {
    "role": "You are a senior LinkedIn content strategist specializing in B2B thought leadership.",
    "guidelines": "## Structure\n\n1. **Hook** (1-2 sentences)\n2. **Context** (2-3 sentences)\n3. **Value** (3-5 bullet points)\n4. **CTA** (1 sentence)\n5. **Hashtags** (separate line)\n\n## Do\n\n- Share actionable insights\n- Ask genuine questions\n\n## Don't\n\n- Start with \"Excited to announce...\"\n- Use more than 5 hashtags"
  },
  "fields": [
    { "id": "text", "label": "Post Text", "type": "long-text", "required": true, "sortOrder": 0, "constraints": { "charLimit": 3000 } },
    { "id": "image", "label": "Image", "type": "image", "required": false, "sortOrder": 1 },
    { "id": "hashtags", "label": "Hashtags", "type": "list", "required": false, "sortOrder": 2, "constraints": { "maxItems": 5 } }
  ]
}
```

### Example 2: Blog Post (site, multi-phase)

Complex content type — 9 fields, detailed SEO guidelines, 6-phase production pipeline.

```json
{
  "id": "blog-post",
  "label": "Blog Post",
  "description": "SEO-optimized blog article",
  "category": "site",
  "source": "builtin",
  "icon": "file-text",
  "pipeline": {
    "mode": "multi-phase",
    "phases": ["outline", "write", "assembly", "image", "quality", "translate"],
    "requiresEnrichment": true
  },
  "agent": {
    "role": "You are a senior SEO content strategist who writes high-ranking, reader-friendly blog articles.",
    "guidelines": "## Structure\n\n1. H1 Title (50-70 chars, primary keyword)\n2. Answer Capsule (blockquote, 2-3 sentences)\n3. Introduction (100-200 words)\n4. H2 Sections (3-5, 200-400 words each)\n5. Conclusion (100-200 words)\n6. FAQ (3-5 questions)\n\n## SEO Rules\n\n- Primary keyword in H1, first 100 words, 2+ H2s\n- Keyword density: 1-2%\n- Internal links: 2+ per article\n\n## Don't\n\n- Use \"In this article, we will...\"\n- Write sections longer than 500 words"
  },
  "fields": [
    { "id": "title", "label": "Title", "type": "short-text", "required": true, "sortOrder": 0, "constraints": { "charLimit": 70 } },
    { "id": "description", "label": "Meta Description", "type": "long-text", "required": true, "sortOrder": 1, "constraints": { "charLimit": 160 } },
    { "id": "body", "label": "Content", "type": "markdown", "required": true, "sortOrder": 2, "constraints": { "wordCount": { "min": 1200, "max": 2000 } } },
    { "id": "hero-image", "label": "Hero Image", "type": "image", "required": false, "sortOrder": 3 },
    { "id": "faq", "label": "FAQ", "type": "faq", "required": false, "sortOrder": 4, "constraints": { "maxItems": 5 } },
    { "id": "category", "label": "Category", "type": "short-text", "required": true, "sortOrder": 5 },
    { "id": "tags", "label": "Tags", "type": "list", "required": false, "sortOrder": 6 },
    { "id": "keywords", "label": "Keywords", "type": "list", "required": true, "sortOrder": 7 },
    { "id": "author", "label": "Author", "type": "short-text", "required": true, "sortOrder": 8 }
  ]
}
```

### How it works

When a user clicks "Create with AI" and selects a content type, the system:

1. Reads the JSON definition
2. Builds a prompt from `agent.role` + `agent.guidelines` + `fields` constraints
3. Generates a JSON output schema from `fields` (exact field IDs as keys)
4. Runs the agent with the Flow context (sources, chat, enrichment)
5. Creates a ContentVersion with the result

**No code changes needed** — just create or edit the JSON file.

## Field Types

| Type | Description | JSON Output |
|------|-------------|-------------|
| `short-text` | Single line, usually with charLimit | `string` |
| `long-text` | Multi-line text | `string` |
| `rich-text` | HTML content | `string` |
| `markdown` | Markdown content | `string` |
| `image` | Image generation prompt | `string \| null` |
| `faq` | FAQ pairs | `Array<{question, answer}>` |
| `cta` | Call to action | `{text, buttonLabel, url}` |
| `list` | String array (tags, hashtags) | `string[]` |
| `select` | Single choice | `string` |
| `json` | Structured data | `object` |
| `number` | Numeric value | `number` |
| `boolean` | Toggle | `boolean` |
| `date` | Date picker | `string (ISO)` |

## Field Constraints

```json
{
  "constraints": {
    "charLimit": 280,
    "wordCount": { "min": 1200, "max": 2000 },
    "maxItems": 5,
    "imageAspectRatio": "16:9"
  }
}
```

Constraints are injected into the agent prompt as `<constraints>` and enforced in the output schema.

## Pipeline Configuration

```json
{
  "pipeline": {
    "mode": "single-phase",
    "phases": ["write", "image"],
    "requiresEnrichment": false,
    "defaultModel": "claude-sonnet-4-6"
  }
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `mode` | `"single-phase"` / `"multi-phase"` | Single = one agent generates all fields. Multi = specialized agents per phase (blog-post only). |
| `phases` | `string[]` | Phase names for the pipeline run. Single-phase typically: `["write"]` or `["write", "image"]`. |
| `requiresEnrichment` | `boolean` | Hint: does this type benefit from SEO research before production? |
| `defaultModel` | `string` (optional) | Override the project's default model for this content type. |

## Localization

```json
{
  "localization": {
    "mode": "single",
    "translateOnGenerate": false
  }
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `mode` | `"single"` / `"multi"` | `single` = social/email content (no language tabs in editor). `multi` = articles (language tabs + auto-translate in pipeline). |
| `translateOnGenerate` | `boolean` | When `true`, the pipeline runs the Translation phase automatically after production. Only relevant for `multi` mode. |

## Agent Configuration

```json
{
  "agent": {
    "role": "You are a senior LinkedIn content strategist specializing in B2B thought leadership.",
    "guidelines": "## Hook Patterns\n\n- Contrarian: \"Most people think X.\"\n- Data: \"We analyzed 500 posts...\"\n\n## Do\n\n- Share actionable insights\n- Ask genuine questions\n\n## Don't\n\n- Start with \"Excited to announce...\"\n- Use more than 5 hashtags"
  }
}
```

The `role` is injected as the first line of the system prompt (highest attention position). The `guidelines` are injected as a `<guidelines>` XML section. Both use Markdown formatting.

## Connector-Imported Types

Connectors with schema discovery (Shopware, WordPress+ACF) can import platform content structures as ContentTypes:

```
POST /content-types/import
  → Connector discovers schemas (CMS layouts, ACF field groups)
  → Each schema becomes a ContentType with source: "connector"
  → Fields auto-mapped from platform slot types
```

Imported types have `connectorType` and `connectorRef` fields linking back to the platform.
