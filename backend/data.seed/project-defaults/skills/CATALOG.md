# Agent Skills Catalog

Skills are Markdown files that provide format-specific instructions to AI agents. Each agent reads its relevant skill at runtime via the `flowboost_read_project_data` MCP tool.

Skills control **tone, structure, and style** — not hard limits (character counts, hashtag limits). Hard limits are enforced by the pipeline code.

## Available Skills

| Category | Skill | Agent | Purpose |
|---|---|---|---|
| `social/linkedin` | LinkedIn Post | Social Writer | Professional tone, hook patterns, structure |
| `social/instagram` | Instagram Post | Social Writer | Visual-first, carousel rules, hashtag strategy |
| `social/x` | X Post | Social Writer | Brevity, thread format, engagement |
| `social/tiktok` | TikTok | Social Writer | Conversational, hook in 3 sec, trends |
| `newsletter/default` | Newsletter | Newsletter Writer | Subject lines, section structure, CTAs |
| `article/default` | Article | Outline Architect | SEO structure, answer capsule, FAQ |
| `research/default` | Research | Enricher | How to research keywords and competitors |
| `image/style-guide` | Image | Image Generator | Visual style, composition, mood |

## How to Edit

Edit any skill file to customize AI behavior for your project. Changes take effect immediately — no restart needed.

To reset all skills to defaults: use the "Reset to Defaults" button in Settings or call `POST /skills/reset`.
