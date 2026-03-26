# Contributing to FlowBoost

## Quick Links

- **GitHub:** https://github.com/johrld/flowboost
- **Issues:** https://github.com/johrld/flowboost/issues

## Maintainers

- **Johannes Herold** — Creator, Architecture, Pipeline
  - GitHub: [@johrld](https://github.com/johrld)

- **Magnus** — Contributor
  - GitHub: [@MagnusHL](https://github.com/MagnusHL)

## How to Contribute

1. **Bugs & small fixes** — Open a PR
2. **New features / architecture changes** — Open an Issue first to discuss
3. **Refactor-only PRs** — Not accepted unless a maintainer explicitly asks for it
4. **Questions** — Open a Discussion or Issue

## Before You PR

- Test locally: `docker compose up --build`
- Run TypeScript check: `cd backend && npx tsc --noEmit` and `cd frontend && npx tsc --noEmit`
- Run lint: `cd frontend && npm run lint`
- Keep PRs focused — one thing per PR, don't mix unrelated changes
- Describe **what** changed and **why**
- Include screenshots for UI changes (before/after)

## Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/flowboost.git
cd flowboost

# 2. Run setup (creates .env, configures auth, seeds data)
bash scripts/setup.sh

# 3. Start services
docker compose up --build
```

Dashboard: http://localhost:6101 — API: http://localhost:6100

## Branching

All PRs go against `main`. No `develop` branch. Direct pushes to `main` are blocked — all changes must go through a PR.

```
main (protected: no force push, no direct push, PRs required)
  └── feat/your-feature → PR → main
```

### Branch Naming

- `feat/` — New features
- `fix/` — Bug fixes
- `chore/` — Maintenance, dependencies
- `refactor/` — Code restructuring

### Commit Format

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`

Examples:
- `feat(pipeline): add retry logic for image generation`
- `fix(sidebar): project selector not updating after create`
- `chore(docker): update node base image to 22`

## AI-Assisted PRs Welcome

Built with Claude Code, Cursor, Copilot, or other AI tools? Great — just be transparent:

- Note it in the PR description
- Confirm you understand what the code does
- Test it locally before submitting

## Project Structure

```
flowboost/
├── backend/          # Fastify API + Claude Agent SDK pipeline
│   ├── src/
│   │   ├── api/      # REST routes
│   │   ├── models/   # Data models (JSON file store)
│   │   ├── pipeline/ # AI agent orchestration
│   │   └── tools/    # MCP server for agent tools
│   └── data.seed/    # Seed data + project defaults
├── frontend/         # Next.js dashboard
│   └── src/
│       ├── app/      # Pages (App Router)
│       ├── components/
│       └── lib/      # API client, types, context
└── scripts/          # Setup and utility scripts
```

## What We're Looking For

- Pipeline improvements (new agent prompts, better quality checks)
- Frontend UX (better empty states, editor improvements)
- New connectors (WordPress, Webflow, social platforms)
- Documentation and examples
- Bug fixes and stability

Check [Issues](https://github.com/johrld/flowboost/issues) for things to work on.

## Report a Vulnerability

Do not open public issues for security vulnerabilities. Report them via [GitHub Security Advisories](https://github.com/johrld/flowboost/security/advisories/new).
