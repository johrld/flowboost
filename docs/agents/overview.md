# FlowBoost Agent Pipeline — Overview

FlowBoost uses AI agents orchestrated via Claude CLI to automate content research, production, and translation. Each agent runs as a subprocess with a specific system prompt, tool access, and output format.

## Pipelines

| Pipeline | Trigger | Agents | Output |
|----------|---------|--------|--------|
| **Strategy** | User clicks "Plan" | Auditor → Researcher → Strategist | 3-5 proposed topics |
| **Enrich** | User clicks "Analyze" on a topic | Topic Enricher | Enriched topic (keywords, competitors, angle) |
| **Production** | User clicks "Produce" on approved topic | Outline → Writers → Editor → Image → Quality → Translators | Article + translations + hero image |

## Architecture

```
                    ┌─────────────────────────────────────────────────┐
                    │                  STRATEGY                       │
                    │                                                 │
                    │  ┌──────────┐   ┌────────────┐   ┌───────────┐ │
                    │  │ Auditor  │──▶│ Researcher │──▶│Strategist │ │
                    │  └──────────┘   └────────────┘   └───────────┘ │
                    │  Content Index    WebSearch        Prioritize   │
                    │  → gap analysis   → keywords       → topics    │
                    │                   → competitors                 │
                    └─────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────────┐
                    │                   ENRICH                        │
                    │                                                 │
                    │             ┌───────────────┐                   │
                    │             │Topic Enricher │                   │
                    │             └───────────────┘                   │
                    │             WebSearch + WebFetch                │
                    │             → keywords, angle, competitors      │
                    └─────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────────┐
                    │                 PRODUCTION                      │
                    │                                                 │
                    │  ┌─────────┐  ┌────────────────┐  ┌─────────┐  │
                    │  │Outline  │─▶│Section Writers │─▶│ Editor  │  │
                    │  │Architect│  │  (parallel)    │  │(assembly│  │
                    │  └─────────┘  └────────────────┘  └────┬────┘  │
                    │                                        │       │
                    │  ┌─────────┐  ┌────────────────┐       │       │
                    │  │ Image   │  │  Quality Gate  │◀──────┘       │
                    │  │Generator│  │ SEO + Brand    │               │
                    │  └─────────┘  └───────┬────────┘               │
                    │                       │                        │
                    │               ┌───────▼────────┐               │
                    │               │  Translators   │               │
                    │               │  (parallel)    │               │
                    │               └────────────────┘               │
                    └─────────────────────────────────────────────────┘
```

## Agent Summary

| # | Agent | Pipeline | Model | Max Turns | Key Tools |
|---|-------|----------|-------|-----------|-----------|
| 1 | Content Auditor | Strategy | sonnet | 10 | MCP: read_project_data, read_content_index |
| 2 | Topic Researcher | Strategy | sonnet | 30 | WebSearch, WebFetch, MCP: read_project_data |
| 3 | Content Strategist | Strategy | sonnet | 10 | Read, Write, MCP: read_project_data |
| 4 | Topic Enricher | Enrich | sonnet | 15 | WebSearch, WebFetch, MCP: read_project_data, read_content_index |
| 5 | Outline Architect | Production | sonnet | 10 | Read, Write, MCP: read_project_data |
| 6 | Section Writer (xN) | Production | sonnet | 8 | Read, Write, MCP: read_project_data, validate_section |
| 7 | Content Editor | Production | sonnet | 12 | Read, Write, MCP: assemble_article, validate_article |
| 8 | Image Generator | Production | sonnet | 5 | Read, MCP: generate_image |
| 9 | SEO Checker | Production | haiku | 5 | Read, MCP: validate_article |
| 10 | Content Reviewer | Production | sonnet | 5 | Read, MCP: read_project_data |
| 11 | Translator (xN) | Production | sonnet | 10 | Read, Write, MCP: validate_article |

Model defaults are configured per project (`project.pipeline.defaultModel`), typically `sonnet`.

## Engine

All agents run through the unified engine (`pipeline/engine.ts`):

- **`runAgentTracked()`** — Main execution with cost tracking, event streaming, real-time progress
- **`runSimpleAgent()`** — Lightweight variant for chat/one-offs (no MCP tools, default: haiku)
- Agents spawn Claude CLI as subprocess with `--print` flag
- MCP tools provided via temporary config file per agent run
- Events streamed to disk for client polling

## Data Flow

Agents pass data via:
1. **Prompt injection** — Audit results embedded in Researcher prompt, etc.
2. **Scratchpad files** — Section writers save to `scratchpad/{runId}/`, editor reads them
3. **MCP tools** — Structured read/write to project data, content index, article assembly
4. **JSON extraction** — Agent text output parsed for structured JSON blocks

## Docs

- [Research & Strategy Agents](./research.md) — Auditor, Researcher, Strategist, Enricher
- [Production Agents](./production.md) — Outline, Writers, Editor, Image, Quality, Translation
