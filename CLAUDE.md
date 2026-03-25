# FlowBoost -- Claude Code Kontext

## Issue-Tracking

Issues werden auf **GitHub** getrackt (nicht Linear):
- Upstream: https://github.com/johrld/flowboost/issues
- Fork: https://github.com/MagnusHL/flowboost/issues

## Stack

- **Backend**: Fastify (TypeScript, ESM), File-basierter JSON Store, Sharp
- **Frontend**: Next.js 16, React 19, Shadcn/UI, TipTap Editor
- **AI**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), Google Imagen 4
- **Deployment**: Docker Compose (dev), Dokploy (prod)

## Konventionen

- Commit Messages: Conventional Commits (`<type>(<scope>): <beschreibung>`)
- Sprache: Code und Kommentare auf Englisch, Commit Messages und Doku auf Deutsch
- Branch-Modell: `main` <- Feature-Branches (Fork-Workflow mit upstream)
