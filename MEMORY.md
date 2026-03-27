# FlowBoost – Knowledge Architecture

## Project Context

FlowBoost generates AI-powered content from a single Flow (topic + sources + brainstorm) into multiple formats: blog articles, social posts (LinkedIn, X, Instagram, TikTok), newsletters, and Shopware CMS pages. It uses an agent-based architecture with the Claude Agent SDK, and publishes via connectors (Git/GitHub, Shopware 6, Listmonk, WordPress — more planned).

## The Knowledge Problem

Two types of knowledge accumulate over time:

1. **Generated knowledge** – Flow conversations, produced content (articles, posts, newsletters), and their metadata (keywords, categories, topics).
2. **Ingested knowledge** – data read back from connected platforms via connectors: published content performance, product data, subscriber metrics, engagement signals.

This knowledge should continuously improve content quality — but raw data can't be dumped into the agent's context. It needs to be pre-processed, structured, and served selectively.

## What Each Connector Should Provide

### Shopware 6 (E-Commerce)

| Data | API Endpoint | Value for Content |
|------|-------------|-------------------|
| Product catalog (names, descriptions, properties, prices) | `POST /api/search/product` | Accurate product references, consistent naming |
| Category structure | `POST /api/search/category` | Topic clustering, internal linking |
| CMS page content (published landing pages) | `POST /api/search/cms-page` | Avoid duplicate content, reference existing pages |
| Sales statistics (top sellers, trending) | `POST /api/search/order-line-item` (aggregated) | Content priority based on what sells |
| Customer reviews | `POST /api/search/product-review` | Social proof, voice-of-customer input |

**Open question:** Do we need real-time sales data, or is a periodic snapshot (daily/weekly) sufficient? Sales trends change slowly — weekly aggregation is probably fine.

### Listmonk (Newsletter)

| Data | API Endpoint | Value for Content |
|------|-------------|-------------------|
| Campaign performance (open rate, click rate) | `GET /api/campaigns/{id}` | Learn what subjects/formats work |
| Subscriber count per list | `GET /api/lists` | Audience size context |
| Bounce rate | `GET /api/campaigns/{id}` | List health, deliverability awareness |
| Past campaign content (subject, body) | `GET /api/campaigns` | Avoid repetition, learn from patterns |

**Open question:** Listmonk analytics are basic (opens, clicks). Worth pulling, or wait for richer analytics from Mailchimp/etc?

### Social Channels (Future: LinkedIn, Instagram, X, TikTok)

| Data | Platform API | Value for Content |
|------|-------------|-------------------|
| Post performance (likes, shares, comments, reach) | Platform-specific | What resonates, optimal length/format |
| Comment sentiment | Platform-specific | Audience feedback loop |
| Posting history | Platform-specific | Avoid topic repetition, timing insights |
| Follower demographics | Platform-specific | Audience profiling for tone/topic |

**Open question:** Social APIs have strict rate limits and data access restrictions. Start with read-back of our own posts only?

### Git/GitHub (Site Delivery)

| Data | Git API | Value for Content |
|------|---------|-------------------|
| Published article inventory | `git ls-files` | Avoid duplication, internal linking |
| Article metadata (frontmatter) | File read | Topic coverage gaps |
| Git history (publish dates, update frequency) | `git log` | Content freshness tracking |

**Open question:** Is Git content already covered by the Content Index? If so, no separate knowledge ingestion needed.

## Knowledge Architecture: RAG with Supabase

### Why Supabase

- PostgreSQL under the hood with native **pgvector** extension for vector storage and similarity search
- Built-in **Auth** with Row Level Security — single layer for persistence, auth, and vector search (no separate vector DB, no separate auth service)
- FlowBoost currently has no database (file-based JSON store) and no user authentication — Supabase would add both
- Self-hostable on Hetzner/Dokploy for full control; hosted tiers work for prototyping
- Alternative: dedicated pgvector on existing Central Postgres (but without auth layer)

### Storage Layer

Supabase PostgreSQL with pgvector. Single persistence layer for vectors, relational metadata, and user auth.

```
knowledge_chunks
├── id (uuid)
├── project_id (ref)
├── source_type (connector | flow | enrichment)
├── source_connector (shopware | listmonk | linkedin | git)
├── source_ref (product ID, campaign ID, post URL)
├── content (text chunk, 200-500 tokens)
├── embedding (vector(1536))
├── metadata (jsonb: topic, date, engagement, channel, format)
├── chunk_type (raw | summary | insight | pattern)
├── created_at
└── updated_at
```

### Ingestion Pipeline

1. **Connector Pull** — Background agents (n8n or dedicated workers) periodically pull data from connected platforms
2. **Chunking** — Content split into 200-500 token chunks with overlap
3. **Embedding** — `text-embedding-3-small` (or comparable model)
4. **Storage** — Vectors + rich metadata stored in knowledge_chunks table

### Enrichment Agents (Background)

Periodic background processes that create higher-level knowledge:

| Agent | Input | Output | Frequency |
|-------|-------|--------|-----------|
| **Topic Clusterer** | All content chunks | Topic map with connections | Weekly |
| **Performance Analyzer** | Engagement metrics per content | "What works where" patterns | Weekly |
| **Voice Profiler** | Published content per channel | Channel-specific tone guidelines | Monthly |
| **Gap Detector** | Product catalog vs. published content | Content gaps + opportunities | Weekly |
| **Trend Spotter** | Sales data + search trends | Trending topics for proactive content | Daily |

These produce "meta-chunks" (chunk_type: `insight` or `pattern`) stored back into the same vector DB with elevated retrieval priority.

### Retrieval at Content Generation

When a Flow produces content, the pipeline queries knowledge in two layers:

1. **Meta-level first** — Aggregated insights, patterns, voice profiles
2. **Concrete examples second** — Original posts, product data, specific engagement data

This keeps the agent context focused on distilled knowledge.

## Integration with FlowBoost Architecture

### Where Knowledge Feeds In

```
Flow (Topic + Sources + Chat)
  ↓
Pipeline (Outline → Writing → Assembly → Quality → Translation)
  ↓ queries knowledge at each phase:
  ├── Outline: topic clusters, content gaps, competitor insights
  ├── Writing: voice profile, product data, performance patterns
  ├── Quality: past engagement data for quality scoring
  └── Translation: channel-specific tone per language
```

### Where Knowledge Gets Created

```
Published content (via connectors)
  ↓ read back periodically
Knowledge Ingestion Pipeline
  ↓
knowledge_chunks table
  ↓ enriched by background agents
Meta-chunks (insights, patterns)
```

## What Connectors Need to Support

For the knowledge architecture, each connector needs a **read-back** capability beyond just delivery:

| Connector | Delivery (exists) | Read-back (needed) |
|-----------|-------------------|-------------------|
| **Shopware** | writeStructured() | Product catalog, sales stats, reviews |
| **Listmonk** | createDraft() | Campaign performance, subscriber metrics |
| **Git/GitHub** | write() | Published content inventory |
| **LinkedIn** | (planned) | Post performance, comments |
| **Instagram** | (planned) | Post performance, comments |

The `useAsSource` flag on ConnectorConfig already prepares for this — connectors marked as sources will have their read-back data ingested into the knowledge base.

## Open Questions

1. **Database choice** — Supabase (preferred: adds auth + vectors in one layer) vs. pgvector on existing Central Postgres (no auth). FlowBoost currently has no DB and no user auth.
2. **Embedding model** — OpenAI text-embedding-3-small, or use Claude embeddings?
3. **Ingestion frequency** — Real-time webhooks vs. periodic polling? (Leaning toward periodic for simplicity)
4. **Privacy** — Customer reviews and subscriber data need GDPR-compliant handling. Store only aggregated insights, not raw personal data?
5. **Agent orchestration** — How do enrichment agents communicate with the main pipeline? Direct DB access or via API?
6. **MVP scope** — Start with Shopware product data + Listmonk campaign stats as first knowledge sources? Or start with generated content only (no connector read-back)?
