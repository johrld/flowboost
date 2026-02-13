# FlowBoost Dashboard

Next.js 15 Frontend fuer den FlowBoost Content Hub.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **State**: React hooks + Context (ProjectContext)
- **API**: REST calls to FlowBoost Backend (port 6100)

## Pages

| Route | Beschreibung |
|-------|-------------|
| `/dashboard` | Aktionsorientiertes Dashboard |
| `/research` | Topic Discovery + Content Gaps |
| `/plan` | Kalender + Content Scheduling |
| `/create` | Content-Liste + Editor |
| `/create/new` | Neuen Content erstellen |
| `/create/[id]` | Content bearbeiten |
| `/monitor` | Pipeline Runs + Agent Activity |
| `/connectors` | Git Repository, Social, Media Connectors |
| `/settings` | Projekt-Config (7 Tabs) |

## Connectors Page

Eigene Seite fuer Connector-Verwaltung mit zwei Tabs:

- **Connections**: Connector-Karten (Site, Social, Media). Git Repository Detail-View mit Framework-Auswahl (Astro/Hugo/Next.js/Custom), Repo/Branch, Content/Assets/Categories/Authors Pfade.
- **Routing**: Welcher Connector ist aktiv fuer welchen Content-Typ.

## Settings Page

7 Tabs: General, Project Brief, Authors, Brand Voice, Categories, Competitors, Pipeline.

**Categories + Authors** sind read-only und werden ueber zentralen Sync vom verbundenen Repository gelesen (`POST /projects/:id/sync`). Auto-Sync beim Laden, manueller Sync-Button als Fallback.

## Development

```bash
npm install
npm run dev          # Dev Server (localhost:3000)
npm run build        # Production Build
npx tsc --noEmit     # Type Check
```

## Environment

```
NEXT_PUBLIC_API_URL=http://localhost:6100
```

## Docker

```bash
# Aus dem Root-Verzeichnis:
docker compose up -d --build dashboard
```

Port: 6001 (mapped von Container-Port 3000)
