# FlowBoost

**One briefing. Every format. AI-powered.**

FlowBoost turns a single idea into articles, social posts, and newsletters — all from one briefing, all consistent with your brand voice.

Drop in your notes, a voice memo, or a URL. Brainstorm with AI. Run keyword research. Then produce content for every channel — each piece tailored to its platform, all connected to the same source.

Built on the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents/agent-sdk). Self-hosted. Open source.

## How It Works

```
 Input                    Brainstorm               Create
 ─────                    ──────────               ──────
 Voice memo               "What angle?"            Article (1,400 words)
 Notes                    "Try office focus"       LinkedIn Post
 URLs              →      AI Research        →     Instagram Carousel
 Images                   Keywords                 Newsletter
 PDFs                     Competitors              X Thread
                          Suggested angle
```

One briefing holds your inputs, research, and brainstorm conversation. From there, produce any format — the AI knows the full context for each piece.

## Features

- **Briefings** — Collect inputs (text, voice, files, URLs), brainstorm with AI, produce multiple outputs from one topic
- **Strategy Pipeline** — Audits existing content, researches keywords, generates briefings
- **Article Pipeline** — Outline, parallel writing, assembly, quality review with retries, translation
- **Social Pipeline** — Platform-aware posts for LinkedIn (3K chars), X (280 chars), Instagram, TikTok
- **Newsletter Pipeline** — Subject, preview text, sections, CTA
- **Content Types** — Built-in formats + connector schema import + custom template builder
- **Connector Delivery** — GitHub (PRs), Shopware (CMS slots), WordPress (REST API), filesystem
- **Image Generation** — Hero images via Google Imagen 4
- **Multi-language** — Parallel translation into all configured languages
- **Real-time Monitoring** — Watch AI agent activity live in the dashboard

## Architecture

```
┌──────────────────────┐    REST API    ┌──────────────────────┐
│   Next.js Dashboard  │ ◄────────────► │   Fastify Backend    │
│   (React 19, Shadcn) │                │   (TypeScript, ESM)  │
└──────────────────────┘                └──────────┬───────────┘
                                                   │
                                        ┌──────────▼───────────┐
                                        │  Claude Agent SDK    │
                                        │                      │
                                        │  13 specialized      │
                                        │  AI agents           │
                                        └──────────┬───────────┘
                                                   │ MCP
                                        ┌──────────▼───────────┐
                                        │  9 MCP Tools         │
                                        │  validate, assemble  │
                                        │  generate, read      │
                                        └──────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for entities, data flow, connectors, and filesystem layout.
See [docs/AGENTS.md](docs/AGENTS.md) for all pipelines, agent roles, MCP tools, and prompt files.

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- An [Anthropic API key](https://console.anthropic.com) **or** [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and logged in
- Optional: [Google Gemini API key](https://aistudio.google.com/apikey) for image generation

### Quick Start

```bash
git clone https://github.com/johrld/flowboost.git
cd flowboost
bash scripts/setup.sh        # Creates .env, configures auth, seeds data
docker compose up --build
```

Open [http://localhost:6101](http://localhost:6101) — the onboarding wizard guides you through creating your first project.

### Authentication

The setup wizard handles auth configuration. Three options:

| Option | Best for | How |
|---|---|---|
| **API Key** | Pay-per-use | Paste `ANTHROPIC_API_KEY` in `.env` |
| **OAuth Token** | Max/Pro subscription | Paste token in `.env` |
| **CLI Credentials** | Max/Pro (recommended) | Mount `~/.claude/` into container |

Details in the setup wizard or see the [full auth docs](#authentication-details) below.

## Project Structure

```
flowboost/
├── backend/
│   ├── src/
│   │   ├── api/              # Fastify routes
│   │   ├── models/           # Data models (JSON file store)
│   │   ├── pipeline/         # AI agent orchestration
│   │   │   ├── strategy/     # Audit → Research → Plan
│   │   │   ├── production/   # Outline → Write → Review → Translate
│   │   │   ├── social/       # Platform-aware social posts
│   │   │   ├── email/        # Newsletter production
│   │   │   └── prompts/      # 13 agent prompt builders
│   │   ├── connectors/       # GitHub, Shopware, WordPress, filesystem
│   │   └── tools/            # 9 MCP tools for agents
│   └── data.seed/            # Seed data + built-in content types
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── briefings/    # Input → Brainstorm → Outputs
│       │   ├── dashboard/    # Calendar/scheduling
│       │   ├── monitor/      # Live pipeline monitoring
│       │   ├── settings/     # Project config + Content Types
│       │   └── connectors/   # Connector setup + schema import
│       ├── components/       # Shadcn/UI components
│       └── lib/              # API client, types, context
└── docs/                     # Architecture + agent documentation
```

## Pipelines

| Pipeline | Phases | Output |
|---|---|---|
| **Strategy** | Audit → Research → Strategy | Briefings with keywords + research |
| **Article** | Outline → Writing → Assembly → Image → Quality → Translation | Markdown article + hero image + translations |
| **Social** | Generate → Image | Platform-specific post (LinkedIn, X, Instagram, TikTok) |
| **Newsletter** | Generate | Subject + preview + sections + CTA |
| **Video** | Script → Storyboard → Generate → Subtitle → Thumbnail | Video content (experimental) |
| **Audio** | Script → Voice → Transcript | Audio/podcast content (experimental) |

## Connectors

| Connector | Delivers to | Schema Discovery |
|---|---|---|
| **GitHub** | Markdown → Branch → PR | No (uses built-in article type) |
| **Shopware** | CMS slot content via Admin API | Yes — imports Erlebniswelt layouts |
| **WordPress** | Posts via REST API (+ ACF fields) | Yes — imports ACF field groups |
| **Filesystem** | Local files | No |

Connectors with schema discovery automatically import the target platform's content structure, so FlowBoost generates content matching those exact slots.

## Content Types

Define what formats your project supports:

- **Built-in** — Blog Post, LinkedIn, X, Instagram, Newsletter
- **Imported** — Discovered from connectors (Shopware CMS layouts, WordPress ACF)
- **Custom** — User-defined via the Template Builder in Settings

## Configuration

### Project Settings

- **AI Context** — Project brief + brand voice (controls how AI writes)
- **Competitors** — Domains for research agent analysis
- **Pipeline** — AI model selection, retry settings, image model
- **Content Types** — Manage available output formats

### Data Storage

File-based JSON store (no database). All data in `backend/data/`:

```
data/customers/{id}/projects/{id}/
├── topics/          # Briefings (inputs, chat, research, output refs)
├── content/         # Content items + versions + media
├── content-types/   # Format definitions
└── pipeline-runs/   # Agent execution logs
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production setup, authentication options (API Key, OAuth, CLI Credentials), hosting platform guides (Dokploy/Coolify), and data persistence.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, branching conventions, and PR guidelines.

All PRs go against `main`. AI-assisted contributions are welcome.

## Contributors

- [Magnus Hinzke](https://github.com/MagnusHL)

## License

[Apache 2.0](LICENSE)
