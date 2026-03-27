# Deployment

## Authentication

The Claude Agent SDK spawns Claude Code CLI as a subprocess. The CLI picks up credentials from environment variables or its own credential store.

```
.env (ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN)
  → docker-compose.yml (env_file: .env)
    → Container process.env
      → Agent SDK query() spawns CLI subprocess (inherits env)
        → CLI authenticates with Anthropic API
```

### Local Development

The setup wizard handles everything interactively:

```bash
bash scripts/setup.sh
```

It creates `.env`, asks for your auth method (API Key, OAuth Token, or CLI Credentials), handles the macOS Keychain export automatically, creates `docker-compose.override.yml` with volume mounts if needed, and seeds initial data.

The three auth options the wizard offers:

| Option | Best for | What `setup.sh` does |
|--------|----------|---------------------|
| **API Key** | Pay-per-use | Saves `ANTHROPIC_API_KEY` to `.env` |
| **OAuth Token** | Max/Pro subscription | Saves `ANTHROPIC_AUTH_TOKEN` to `.env` |
| **CLI Credentials** | Max/Pro (recommended) | Exports Keychain (macOS), creates `docker-compose.override.yml` with volume mounts |

> **macOS detail:** The CLI stores credentials in the Keychain, not as files. The setup wizard runs `security find-generic-password -s "Claude Code-credentials" -w > ~/.claude/.credentials.json` for you. On Linux, `~/.claude/.credentials.json` already exists after `claude login`.

### Dokploy / Coolify (Remote)

On hosted platforms, `setup.sh` is not available. Two options:

- **API Key**: Set `ANTHROPIC_API_KEY` as environment variable in the platform UI — done.
- **CLI Login**: Open the terminal in the Dokploy dashboard for the API service, run `claude login`, follow the URL to authorize. Credentials persist in the `claude-credentials` volume across rebuilds.

## Production with Docker Compose

```bash
docker compose -f docker-compose.production.yml up --build -d
```

Standalone compose file (does not extend the dev compose). Uses a production-optimized frontend build (Next.js standalone output) and named volumes for persistent data.

A default customer is created automatically on first start — `setup.sh` is not needed for production.

### Environment Variables

Set these in your `.env` or hosting platform:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (or CLI login) | Anthropic API key for Claude Agent SDK |
| `GEMINI_API_KEY` | No | Google Gemini key for image generation |
| `PORT` | No | Backend port (default: 6100) |
| `FRONTEND_PORT` | No | Dashboard port (default: 6101) |
| `FRONTEND_URL` | No | Public dashboard URL for CORS (default: http://localhost:6101) |
| `NEXT_PUBLIC_API_URL` | No | API URL for browser (default: http://localhost:6100) |

### Plain Docker (no platform)

```bash
docker compose -f docker-compose.production.yml up --build -d
```

Dashboard at `http://localhost:6101`, API at `http://localhost:6100`. No extra proxy needed for local/testing use. For production with a custom domain, put a reverse proxy in front (Caddy, Nginx, or Traefik) with path-based routing as described below.

## Hosting Platforms

### Dokploy / Coolify

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

## Data Persistence

All runtime data (projects, content, media) is stored in `backend/data/`. In production, this is a named Docker volume (`flowboost-data`).

### Backup

```bash
docker compose cp api:/app/data ./backup
```

### Restore

```bash
docker compose cp ./backup/. api:/app/data
```

> **Warning:** `docker compose down -v` deletes all volumes, including your data and CLI credentials.
