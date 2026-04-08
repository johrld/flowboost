# FlowBoost Vision

FlowBoost turns a single briefing into content for every channel —
articles, social posts, newsletters — all consistent, all AI-powered, all self-hosted.

## Design Principles

1. **One briefing, many outputs.** Everything starts from a shared context.
2. **Pipeline over prompt.** Multi-agent pipelines with structured phases, not single prompts.
3. **Self-hosted first.** No SaaS dependency. Your data, your infrastructure, your API keys.
4. **Simple over clever.** File-based JSON, Docker Compose, no database. Complexity only when needed.
5. **Platform-aware.** A LinkedIn post (3,000 chars) is not a tweet (280 chars). Each format has its own constraints.

## Priorities

**Now:** Stability, editor UX, pipeline quality

**Next:** New connectors (Webflow, social APIs), content scheduling, multi-user support

**Later:** Plugin system, video/audio pipelines, external API

## Out of Scope (For Now)

These can change with strong reasoning, but right now:

- **Database migrations** — file-based JSON by design, no Postgres/SQLite
- **Multi-tenant / SaaS** — self-hosted for individual teams, not a platform
- **Alternative AI providers** — built on Claude Agent SDK, not adding OpenAI/Gemini for the content pipeline
- **Standalone refactors** — code style or restructuring belongs inside a fix or feature, not standalone
