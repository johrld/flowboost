# Contributing to FlowBoost

Thanks for your interest! Here's how to contribute effectively.

## Maintainers

| Who | Focus | GitHub |
|---|---|---|
| Johannes Herold | Project Lead | [@johrld](https://github.com/johrld) |
| Magnus Hinzke | Media Library, Connectors | [@MagnusHL](https://github.com/MagnusHL) |

## How to Contribute

**Bugs & small fixes** — open a PR directly. Link the issue if one exists.

**Features & architecture changes** — open an Issue first. Describe what, why, and rough scope. Discuss before coding so nobody wastes time on something that doesn't fit.

**Questions & ideas** — open an Issue. Everything is welcome.

## Before You PR

- [ ] Linked Issue exists (features must be discussed first)
- [ ] Tested locally: `docker compose up --build`
- [ ] TypeScript passes: `cd backend && npx tsc --noEmit` + `cd frontend && npx tsc --noEmit`
- [ ] Lint passes: `cd frontend && npm run lint`
- [ ] One PR = one thing. No unrelated changes mixed in.
- [ ] Under ~500 changed lines (split larger work into multiple PRs)
- [ ] Screenshots for UI changes (before/after)

## Branching & Commits

PRs target `main`. Direct pushes are blocked.

- Branches: `feat/`, `fix/`, `chore/`, `refactor/`
- Commits: `type(scope): description` — e.g. `feat(pipeline): add retry logic`

## Review

PRs are reviewed by a maintainer. Questions are part of the process, not rejection. This is a side project — reviews may take a few days.

## AI-Assisted PRs

Built with AI tools? Welcome. Just note it in the PR, make sure you understand the code, and test it.

## What We're Looking For

- Pipeline improvements (agent prompts, quality checks)
- Frontend UX (editors, empty states, dashboard)
- New connectors (WordPress, Webflow, social platforms)
- Bug fixes and stability

See [VISION.md](VISION.md) for priorities and scope.
See [Issues](https://github.com/johrld/flowboost/issues) for open tasks.

## Security

Report vulnerabilities via [GitHub Security Advisories](https://github.com/johrld/flowboost/security/advisories/new), not public issues.
