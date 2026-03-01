# Production Agents

Triggered via `POST /pipeline/produce` when a user clicks "Produce" on an approved topic.

## Flow

```
Outline Architect
       │
       ▼
Section Writers (parallel, 1 per section)
       │
       ▼
Content Editor (assembly)
       │
       ├──▶ Image Generator (non-fatal)
       │
       ▼
Quality Gate (SEO Checker + Brand Reviewer, parallel)
       │
       ├── pass → Translation
       └── fail → Re-run Assembly → Retry Quality (max N retries)
                                          │
                                          └── still fail → save as "draft"
       │
       ▼
Translators (parallel, 1 per language)
       │
       ▼
ContentItem + ContentVersions created
Topic status → "produced"
```

---

### Agent 5: Outline Architect

**Role**: Create a detailed section-level outline from the topic brief.

| Property | Value |
|----------|-------|
| Name | `outline-architect` |
| Model | project default (sonnet) |
| Max Turns | 10 |
| Tools | `Read`, `Write`, `flowboost_read_project_data` |
| Source | `pipeline/prompts/outline-architect.ts` |

**What it does**:
1. Reads content types, brand voice, blog template
2. Reads all section specs (introduction, h2-section, conclusion, faq, meta)
3. Designs article outline with: meta, introduction, H2 sections, conclusion, FAQ
4. For each H2: heading, target word count, min paragraphs, keywords, content direction, optional H3s, internal links
5. Writes `outline.json` to scratchpad

**Input**: Topic brief (title, keywords, search intent, angle, estimated sections)

**Output** (`scratchpad/{runId}/outline.json`):
```json
{
  "topic": {
    "title": "...",
    "primaryKeyword": "...",
    "secondaryKeywords": ["..."],
    "suggestedAngle": "..."
  },
  "sections": [
    { "id": "meta", "type": "meta", "outputFile": "meta.yaml", "frontmatter": { "slug": "...", "category": "..." } },
    { "id": "intro", "type": "introduction", "outputFile": "intro.md", "h1": "...", "hookStrategy": "statistic" },
    { "id": "section-1", "type": "h2_section", "outputFile": "section-1.md", "h2": "...", "targetWords": 300, "keywordsToInclude": ["..."] },
    { "id": "conclusion", "type": "conclusion", "outputFile": "conclusion.md", "keyTakeaways": ["..."] },
    { "id": "faq", "type": "faq", "outputFile": "faq.yaml", "faqSpecs": [{ "question": "...", "direction": "..." }] }
  ],
  "totalTargetWords": 1400,
  "internalLinks": [{ "anchor": "...", "href": "/de/blog/...", "placedInSection": "section-2" }]
}
```

**Passes to**: Section Writers (one section spec each), Content Editor (full outline for assembly)

---

### Agent 6: Section Writer (xN, parallel)

**Role**: Write a single section of the article. One agent per section, all run in parallel.

| Property | Value |
|----------|-------|
| Name | `section-writer:{sectionId}` |
| Model | project default (sonnet) |
| Max Turns | 8 |
| Tools | `Read`, `Write`, `flowboost_read_project_data`, `flowboost_validate_section` |
| Source | `pipeline/prompts/section-writer.ts` |

**What it does**:
1. Reads section type spec and brand voice
2. Writes only its assigned section (not the full article)
3. Follows section spec: word count, heading, keywords, content direction
4. Saves to `scratchpad/{runId}/{section.outputFile}`
5. Validates using `flowboost_validate_section`, fixes if validation fails

**Rules**:
- Write ONLY the section, not full article
- Brand voice: warm, encouraging, Du-Ansprache, no forbidden terms
- Max 20 words per sentence average
- Concrete examples, science, practical tips — no filler
- For meta type: YAML fields only
- For faq type: YAML array only

**Output**: Individual section file (markdown or YAML) in scratchpad

---

### Agent 7: Content Editor

**Role**: Assemble individually written sections into a polished, cohesive article.

| Property | Value |
|----------|-------|
| Name | `content-editor` |
| Model | project default (sonnet) |
| Max Turns | 12 |
| Tools | `Read`, `Write`, `flowboost_read_project_data`, `flowboost_assemble_article`, `flowboost_validate_article` |
| Source | `pipeline/prompts/content-editor.ts` |

**What it does**:
1. Reads brand voice, blog template, style guide
2. Calls `flowboost_assemble_article` to combine all section files into one article
3. Reviews for: transitions, consistency, flow, internal links, answer capsule, FAQ format
4. Makes minimal edits — smooths transitions, fixes inconsistencies
5. Validates using `flowboost_validate_article`, fixes if validation fails

**Rules**:
- Don't rewrite sections — only smooth transitions and fix issues
- Must pass validation: 1200+ words, 15+ paragraphs, 5+ H2s
- FAQs in frontmatter YAML only, never as content sections
- Answer Capsule right after H1 as blockquote

**Output**: Assembled markdown article at final path

---

### Agent 8: Image Generator

**Role**: Create a hero image by analyzing article content. **Non-fatal** — pipeline continues if this fails.

| Property | Value |
|----------|-------|
| Name | `image-generator` |
| Model | project default (sonnet) |
| Max Turns | 5 |
| Tools | `Read`, `flowboost_generate_image` |
| Source | `pipeline/prompts/image-generator.ts` |

**What it does**:
1. Reads the assembled article
2. Crafts an image generation prompt capturing the article's theme
3. Generates image via Google Imagen API (16:9, photorealistic or soft illustration)

**Style guidelines** (Breathe app):
- Natural scenes: sunrise, mountains, water, forests
- Warm, calming colors: soft blues, greens, warm golds
- Evoke tranquility, focus, inner peace
- No text, watermarks, brand logos

**Output**: Hero image (PNG) saved to version assets directory

---

### Agent 9: SEO Checker

**Role**: Check article for SEO compliance. Part of Quality Gate (runs parallel with Brand Reviewer).

| Property | Value |
|----------|-------|
| Name | `seo-checker` |
| Model | **haiku** (fast, lightweight) |
| Max Turns | 5 |
| Tools | `Read`, `flowboost_read_project_data`, `flowboost_validate_article` |
| Source | `pipeline/prompts/seo-checker.ts` |

**Checks**:
- Title contains primary keyword, 50-70 chars
- Meta description 100-160 chars with primary keyword
- H1 contains primary keyword
- 5-6 H2 headings with keyword variants
- Answer Capsule present (blockquote after H1)
- Primary keyword density 0.5-1.5%
- At least 2 internal links with descriptive anchor text
- FAQ items in frontmatter (FAQPage schema)
- Word count 1200-2000

**Output**: Score (0-100), pass/fail, list of checks with details

**Pass criteria**: Score >= 70 AND no critical issues

---

### Agent 10: Content Reviewer

**Role**: Check article for brand compliance and content quality. Part of Quality Gate.

| Property | Value |
|----------|-------|
| Name | `content-reviewer` |
| Model | project default (sonnet) |
| Max Turns | 5 |
| Tools | `Read`, `flowboost_read_project_data` |
| Source | `pipeline/prompts/reviewer.ts` |

**Checks**:
- Brand voice: Du-Ansprache, warm/encouraging tone, no forbidden terms, no esoteric language
- Content quality: varied paragraphs, concrete examples, not formulaic
- Factual accuracy: correct technique descriptions, no exaggerated health claims
- Readability: average sentence length < 20 words, no unexplained jargon

**Output**: Score (0-100), pass/fail, list of checks with details

**Pass criteria**: Score >= 70 AND no critical issues

---

### Quality Gate — Retry Logic

Both SEO Checker and Brand Reviewer run in parallel. If either fails:

1. If `attempt < maxRetries`: re-run **Assembly** (Content Editor) with quality feedback, then re-check
2. After max retries exhausted: save article as "draft" (instead of "review"), continue to translation

---

### Agent 11: Translator (xN, parallel)

**Role**: Localize the article to a target language. One agent per target language, all run in parallel.

| Property | Value |
|----------|-------|
| Name | `translator:{targetLang}` |
| Model | project default (sonnet) |
| Max Turns | 10 |
| Tools | `Read`, `Write`, `flowboost_read_project_data`, `flowboost_validate_article` |
| Source | `pipeline/prompts/translator.ts` |

**What it does**:
1. Reads brand voice
2. Reads source article (default language)
3. Adapts (not literal translation) to target language with natural phrasing
4. Updates frontmatter: title, description, lang, tags, keywords, FAQ, heroAlt
5. Updates internal link paths to `/{targetLang}/blog/...`
6. Validates using `flowboost_validate_article`

**Localization rules**:
- ADAPT, don't translate literally
- Maintain same heading structure (same H2/H3 count)
- Keep Answer Capsule format
- English: use "you" (informal, matching German "Du")
- Spanish: use "tu" (informal)
- Word count within 20% of source

**Output**: Translated article (markdown) + ContentVersion record per language

---

## Scratchpad Structure

Each production run creates a temporary scratchpad:

```
scratchpad/{runId}/
├── outline.json          ← Outline Architect
├── meta.yaml             ← Section Writer (meta)
├── intro.md              ← Section Writer (intro)
├── section-1.md          ← Section Writer (section-1)
├── section-2.md          ← Section Writer (section-2)
├── section-3.md          ← Section Writer (section-3)
├── conclusion.md         ← Section Writer (conclusion)
├── faq.yaml              ← Section Writer (faq)
└── mcp-*.json            ← Temporary MCP configs (auto-cleaned)
```

## Final Output

After production completes:

```
articles/{articleId}/{versionId}/
├── content/
│   ├── de/
│   │   └── article-slug.md       ← Default language article
│   ├── en/
│   │   └── article-slug.md       ← English translation
│   └── es/
│       └── article-slug.md       ← Spanish translation
└── assets/
    └── de/
        └── article-slug-hero.png ← Hero image
```

- **ContentItem** created with status "review" (or "draft" if quality failed)
- **ContentVersion** created with language variants
- **Topic** status updated to "produced" with `articleId` link
