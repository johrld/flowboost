# FlowBoost

AI-powered content pipeline that researches, writes, reviews, and publishes SEO-optimized articles in multiple languages.

FlowBoost uses the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents/agent-sdk) to orchestrate specialized AI agents — each handling a step of the content lifecycle from strategy to publication.

## Architecture

```
┌──────────────────────┐    REST API    ┌──────────────────────┐
│   Next.js Dashboard  │ ◄────────────► │   Fastify Backend    │
│   (React 19, Shadcn) │                │   (TypeScript, ESM)  │
│   Port 6101          │                │   Port 6100          │
└──────────────────────┘                └──────────┬───────────┘
                                                   │
                                        ┌──────────▼───────────┐
                                        │  Claude Agent SDK    │
                                        │  (query() → CLI)     │
                                        │                      │
                                        │  Agents:             │
                                        │  Auditor, Researcher │
                                        │  Strategist, Writer  │
                                        │  Reviewer, Translator│
                                        └──────────┬───────────┘
                                                   │ MCP
                                        ┌──────────▼───────────┐
                                        │  MCP Tools (stdio)   │
                                        │  validate, assemble  │
                                        │  generate image      │
                                        │  read project data   │
                                        └──────────────────────┘
```

## Features

- **Strategy Pipeline** — Audits existing content, researches keywords, generates topic proposals
- **Production Pipeline** — Outline, parallel writing, assembly, quality review with retries
- **Multi-language** — Parallel translation into all configured languages
- **Image Generation** — Hero images via Google Imagen 4
- **GitHub Delivery** — Publish articles as commits/PRs to your website repo
- **Real-time Monitoring** — Watch agent activity live in the dashboard
- **Topic Chat** — Refine topics with an AI assistant before production
- **Content Versioning** — Full version history with diff support

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- An [Anthropic API key](https://console.anthropic.com) **or** [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and logged in (`claude login`)
- Optional: [Google Gemini API key](https://aistudio.google.com/apikey) for image generation

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/johrld/flowboost.git
cd flowboost

# 2. Run setup (creates .env, configures auth, seeds data)
bash scripts/setup.sh

# 3. Start services
docker compose up --build
```

Open [http://localhost:6101](http://localhost:6101) for the dashboard.
The API runs at [http://localhost:6100](http://localhost:6100).

## Authentication

The Claude Agent SDK spawns Claude Code CLI as a subprocess. The CLI picks up credentials from environment variables or its own credential store — no auth code needed in the application.

```
.env (ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN)
  → docker-compose.yml (env_file: .env)
    → Container process.env
      → Agent SDK query() spawns CLI subprocess (inherits env)
        → CLI authenticates with Anthropic API
```

### Option 1: API Key (pay-per-use)

Set `ANTHROPIC_API_KEY` in your `.env` file. Requires a [Console account](https://console.anthropic.com) with credits.

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

### Option 2: OAuth Token (Max subscription)

If you have a Claude Max subscription, paste your OAuth access token directly. No volume mounts needed.

On **Linux**, extract the token from:
```bash
cat ~/.claude/.credentials.json | grep accessToken
```

On **macOS**, the CLI stores credentials in the Keychain, not as files. You can extract the token via Keychain Access or use Option 3 instead.

```bash
# .env
ANTHROPIC_AUTH_TOKEN=sk-ant-oat01-...
```

> **Note:** The access token expires after a few months. When it does, you need to paste a fresh one. For automatic refresh, use Option 3.

### Option 3: CLI Credentials (Max subscription, recommended)

Mount your local Claude Code CLI credentials into the container. Requires the CLI installed and logged in on the host.

```bash
# 1. Make sure you're logged in
claude auth status
# Expected: "loggedIn": true
```

On **macOS**, the CLI stores credentials in the Keychain, not as files. Export them first:

```bash
security find-generic-password -s "Claude Code-credentials" -w > ~/.claude/.credentials.json
```

On **Linux** and **Windows**, `~/.claude/.credentials.json` already exists after `claude login` — no export needed. On Windows, `~` is `%USERPROFILE%` (e.g. `C:\Users\<Name>`).

```bash
# 2. Copy the override template
cp docker-compose.override.example.yml docker-compose.override.yml
```

Uncomment the volume mounts in `docker-compose.override.yml`:

```yaml
services:
  api:
    volumes:
      - ~/.claude.json:/root/.claude.json:ro
      - ~/.claude/.credentials.json:/root/.claude/.credentials.json:ro
```

```bash
# 3. Start services
docker compose up --build -d

# 4. Verify authentication inside the container
docker compose exec api claude auth status
# Expected: "loggedIn": true, "authMethod": "oauth_token"
```

Leave `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` empty in `.env`.

> **Note:** OAuth tokens expire. If the container reports `loggedIn: false`, re-export your credentials (macOS) or re-run `claude login` (Linux/Windows) and recreate the container with `docker compose up -d --force-recreate api`.

## Project Structure

```
flowboost/
├── backend/
│   ├── src/
│   │   ├── api/              # Fastify routes & server
│   │   │   ├── server.ts     # App context, route registration
│   │   │   └── routes/       # REST endpoints
│   │   ├── models/           # Data models (JSON file store)
│   │   │   ├── store.ts      # Generic Store<T> base class
│   │   │   ├── content.ts    # Content items & versions
│   │   │   ├── topic.ts      # Topic proposals
│   │   │   └── ...
│   │   ├── pipeline/         # AI agent orchestration
│   │   │   ├── engine.ts     # Claude Agent SDK wrapper
│   │   │   ├── context.ts    # Pipeline execution context
│   │   │   ├── strategy/     # Strategy pipeline (audit → research → plan)
│   │   │   ├── production/   # Production pipeline (outline → write → review)
│   │   │   └── prompts/      # Agent prompt builders
│   │   ├── connectors/       # Content delivery (GitHub, filesystem)
│   │   ├── services/         # External services (GitHub API, Imagen)
│   │   └── tools/            # MCP server for agent tools
│   ├── data.seed/            # Demo data (copied to data/ on setup)
│   └── data/                 # Runtime data (gitignored)
├── frontend/
│   └── src/
│       ├── app/              # Next.js App Router pages
│       ├── components/       # React components (Shadcn/UI)
│       └── lib/              # API client, types, context
├── docs/                     # Architecture & concept docs
├── docker-compose.yml        # Default dev setup
├── Dockerfile.backend
├── Dockerfile.frontend.dev
└── .env.example
```

## How It Works

### Strategy Pipeline

Generates topic proposals based on your existing content and market research.

```
Audit → Research → Strategy
```

1. **Audit** — Reads your content index, analyzes coverage gaps by category
2. **Research** — Web search for keyword opportunities, competitor analysis
3. **Strategy** — Prioritizes topics, assigns keywords, saves proposals

### Production Pipeline

Produces a complete article from an approved topic.

```
Outline → Writing → Assembly → Image → Quality → Translation
```

1. **Outline** — Creates article structure with sections and metadata
2. **Writing** — Writes sections in parallel (intro, body, conclusion, FAQ)
3. **Assembly** — Merges sections into a complete markdown article
4. **Image** — Generates hero image via Imagen 4 (non-fatal if it fails)
5. **Quality** — SEO and content review, retries assembly if checks fail
6. **Translation** — Translates into all enabled languages in parallel

### Data Storage

FlowBoost uses a file-based JSON store (no database). All data lives in `backend/data/`:

```
data/customers/{id}/
├── customer.json
├── brand-voice.md
└── projects/{id}/
    ├── project.json
    ├── topics/          # Topic proposals
    ├── content/         # Content items + versions + media
    ├── pipeline-runs/   # Execution logs with agent events
    └── ...
```

## Configuration

### Seed Data

The `backend/data.seed/` directory contains a demo project with:
- A sample customer ("Acme Corp")
- A demo project with filesystem connector
- SEO guidelines, section specs, and article templates

To reset to seed data: `rm -rf backend/data && bash scripts/setup.sh`

### Creating Your Own Project

Edit the files in `backend/data/customers/default/projects/demo/`:
- `project.json` — Languages, categories, pipeline settings
- `project-brief.md` — What your project is about
- `brand-voice.md` (customer level) — Tone, style, terminology
- `seo-guidelines.md` — SEO rules for the quality checker

### GitHub Connector

To publish articles directly to a GitHub repo:

1. [Create a GitHub App](https://github.com/settings/apps/new) with Contents + Pull Requests permissions
2. Install it on your target repository
3. Set the GitHub env vars in `.env`
4. Update `project.json` connector config:

```json
{
  "connector": {
    "type": "github",
    "github": {
      "installationId": 123456,
      "owner": "your-org",
      "repo": "your-website",
      "branch": "main",
      "contentPath": "src/content/posts",
      "assetsPath": "src/assets/posts"
    }
  }
}
```

## Deployment

### Production with Docker Compose

```bash
# Build and start in production mode
docker compose -f docker-compose.production.yml up --build -d
```

This is a standalone compose file (not an overlay on the dev compose). It uses a production-optimized frontend build and a named volume for persistent data.

### Environment Variables (Production)

Set these in your `.env` or hosting platform:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (or use CLI login) | Anthropic API key for Claude Agent SDK |
| `GEMINI_API_KEY` | No | Google Gemini key for image generation |
| `PORT` | No | Backend port (default: 6100) |
| `FRONTEND_PORT` | No | Dashboard port (default: 6101) |
| `FRONTEND_URL` | No | Public dashboard URL (for CORS, default: http://localhost:6101) |
| `NEXT_PUBLIC_API_URL` | No | Override API URL for browser (default: proxied via `/backend`) |
| `BACKEND_URL` | No | Internal API URL for the proxy (default: `http://localhost:6100`, in Docker: `http://api:6100`) |

### Hosting Platforms

**Dokploy / Coolify:**

1. Create a new project, select **Compose** type, connect your GitHub repo
2. Set compose path to `docker-compose.production.yml`
3. Set environment variables in the platform UI:

   | Variable | Required | Value |
   |----------|----------|-------|
   | `ANTHROPIC_API_KEY` | Yes (or use CLI login) | Your Anthropic Console key |
   | `GEMINI_API_KEY` | No | Google Gemini key for image generation |
   | `NEXT_PUBLIC_API_URL` | Yes | `/backend` (see step 5 below) |

4. Configure **two domain entries** on the same host:
   - `yourdomain.com` → **dashboard** service, port `6001`
   - `yourdomain.com/backend` → **api** service, port `6100`, **strip path enabled**

   This routes the dashboard and API through a single domain. The browser calls `/backend/health` and the platform strips `/backend` before forwarding to the API.

5. Set `NEXT_PUBLIC_API_URL=/backend` as environment variable — this tells the frontend to call the API via the `/backend` path on the same domain.

6. Deploy

7. **Authentication** — choose one:
   - **API Key**: Set `ANTHROPIC_API_KEY` as env var — done, no further steps
   - **CLI Login** (Max/Pro subscription): Open the terminal in the Dokploy dashboard for the API service, run `claude login`, follow the URL to authorize. Credentials persist in the `claude-credentials` volume across rebuilds.

8. Open your dashboard URL — the onboarding wizard will guide you through creating your first project

> **Note:** `setup.sh` is NOT needed for production — a default customer is created automatically on first start. The onboarding wizard handles project setup.
>
> **Warning:** `docker compose down -v` deletes all volumes including credentials and data.

**Plain Docker (no platform):**

```bash
docker compose -f docker-compose.production.yml up --build -d
```

Dashboard at `http://localhost:6101`, API at `http://localhost:6100`. No extra proxy needed for local/testing use. For production with a custom domain, put a reverse proxy in front (Caddy, Nginx, or Traefik) with path-based routing as described above.

### Data Persistence

All runtime data (projects, content, media) is stored in `backend/data/`. In production, this is a named Docker volume (`flowboost-data`). To back up:

```bash
docker compose cp api:/app/data ./backup
```

> **Warning:** `docker compose down -v` deletes all volumes, including your data.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, branching conventions, and PR guidelines.

All PRs go against `main`. AI-assisted contributions are welcome.

## Contributors

- [Magnus Hinzke](https://github.com/MagnusHL)

## License

See [LICENSE](LICENSE) for details.
