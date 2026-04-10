# FlowBoost v2 — UI Roadmap

## Vision

The UI transforms from a pipeline-execution tool into a **CMO-driven content workspace**. The user works with an intelligent CMO that knows the content portfolio, competitors, and trends. Content production is tracked through Jobs with real-time progress, not just "Producing..." spinners.

## Priority 1: Core Integration (v2 Backend ↔ Frontend)

### 1.1 API Client (`frontend/src/lib/api.ts`)

New functions:

```typescript
// CMO Chat
sendCmoChat(customerId, projectId, message)       // POST /cmo/chat
getCmoChatHistory(customerId, projectId)           // GET /cmo/chat

// Job System
createArticleJob(customerId, projectId, data)      // POST /jobs/article
createSocialJob(customerId, projectId, data)       // POST /jobs/social
getJobs(customerId, projectId, filters?)           // GET /jobs
getJob(customerId, projectId, jobId)               // GET /jobs/:id

// Memory & Agents
getProjectMemory(customerId, projectId)            // GET /cmo/memory
getAgents(customerId, projectId)                   // GET /cmo/agents

// Heartbeat
getMonitorStatus(customerId, projectId)            // GET /heartbeat/status
triggerMonitor(customerId, projectId, type)         // POST /heartbeat/:type
triggerAllMonitors(customerId, projectId)           // POST /heartbeat/trigger
```

### 1.2 Replace Pipeline Calls with Job System

**Flow Detail Page** (`flows/[id]/page.tsx`):
- "Generate with AI" sparkle button → `createArticleJob()` or `createSocialJob()`
- "Generate All with AI" → create multiple jobs
- Poll job status for progress instead of just reloading content

**Content Library** (`content/page.tsx`):
- Generate button → `createArticleJob()` or `createSocialJob()`

### 1.3 Job Progress Display

Replace the "Producing" spinner with real-time job phase tracking:

```
┌─────────────────────────────────────────┐
│ Box Breathing Article          ◈ 3/5    │
│ [██████████░░░░░] Assembly              │
│ Research ✓ Outline ✓ Writing ✓ ...      │
└─────────────────────────────────────────┘
```

New component: `<JobProgress jobId={id} />` that polls `GET /jobs/:id` and shows current phase.

## Priority 2: CMO Chat Integration

### 2.1 Global CMO Chat

A floating chat button in the sidebar (bottom), opening a `<Sheet>` overlay. Available from every page. Uses project-level CMO chat (`/cmo/chat`).

```
┌──────────────┐
│ Sidebar      │
│              │
│ Calendar     │
│ Content      │
│ FLOWS        │
│ ...          │
│              │
│ ┌──────────┐ │
│ │ 💬 CMO   │ │  ← Opens sheet with CmoChat
│ └──────────┘ │
│ Settings     │
└──────────────┘
```

The CMO chat replaces the generic "Chat" in the flow sidebar. The flow-level chat remains for topic-specific discussions, but it now uses the CMO agent (already done backend-side).

### 2.2 Flow Detail Chat

Keep the right sidebar chat for flow-scoped conversations. It already uses the CMO agent backend. No frontend change needed except visual polish.

## Priority 3: Intelligence Dashboard

New page: `/intelligence`

Shows the CMO's accumulated project knowledge:

```
┌─────────────────────────────────────────────────────┐
│ Intelligence                                         │
│                                                      │
│ ┌─ Competitors ──────────────────────────────────┐  │
│ │ Headspace: 142 articles, 3 new this week       │  │
│ │ Calm: 89 articles, 1 new this week             │  │
│ │ Last scan: 2 days ago  [Scan Now]              │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─ Trending Topics ──────────────────────────────┐  │
│ │ ● Vagus Nerve Stimulation (score: 85)          │  │
│ │ ● 4-7-8 Breathing (score: 72)                  │  │
│ │ ● NSDR (score: 68)                             │  │
│ │ Last scan: 4 days ago  [Scan Now]              │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─ Content Gaps ─────────────────────────────────┐  │
│ │ ⚠ 5 stale articles (>6 months old)             │  │
│ │ ⚠ Missing: Progressive Muscle Relaxation       │  │
│ │ ⚠ Missing: Body Scan Meditation                │  │
│ │ Last scan: 1 day ago  [Scan Now]               │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─ Topic Clusters ───────────────────────────────┐  │
│ │ Meditation Techniques  ████████░░ 80%          │  │
│ │ Breathing Exercises    ██████░░░░ 60%          │  │
│ │ Stress Management      ████░░░░░░ 40%          │  │
│ │ Sleep & Recovery       ██░░░░░░░░ 20%          │  │
│ └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

Data source: `GET /cmo/memory`

### Sidebar Navigation Addition

```
Calendar
Content
Intelligence  ← NEW (Brain icon)
FLOWS
...
```

## Priority 4: Settings Integration

### Monitors Tab in Project Settings

Enable/disable background monitors, trigger manual scans:

```
┌─ Background Monitors ──────────────────────────┐
│                                                  │
│ ☑ Competitor Scan     Weekly (Mon 9am)  [Run]  │
│   Last: 2026-04-08    Found: 3 new articles     │
│                                                  │
│ ☑ Trend Scanner       Weekly (Wed 9am)  [Run]  │
│   Last: 2026-04-05    Found: 5 trends           │
│                                                  │
│ ☑ Content Watcher     Daily (6am)       [Run]  │
│   Last: 2026-04-10    Flagged: 5 stale          │
│                                                  │
│ ☐ Health Content Checks (E-E-A-T, Citations)    │
└──────────────────────────────────────────────────┘
```

## Priority 5: Monitor Page Upgrade

Update `/monitor` to show Jobs alongside pipeline runs:

- **Active Jobs** section (from `GET /jobs?status=in_progress`)
- **Background Monitors** section (from `GET /heartbeat/status`)
- **Completed Jobs** timeline (from `GET /jobs?status=done`)
- Phase-by-phase progress with agent names
- Job comments (agent-to-agent communication visible to user)

## Implementation Order

1. **API client** — add all new functions (no UI changes yet)
2. **Replace produceFlowOutput** — flow detail + content library use jobs
3. **JobProgress component** — inline progress for producing items
4. **Global CMO chat** — sidebar button + Sheet overlay
5. **Intelligence page** — memory dashboard with scan triggers
6. **Settings** — monitors tab + healthContentChecks toggle
7. **Monitor page** — upgrade to show jobs + monitors

## New Components Needed

| Component | Purpose |
|-----------|---------|
| `<CmoChat>` | Project-level CMO chat (Sheet overlay) |
| `<JobProgress>` | Inline job phase progress indicator |
| `<MemoryInsights>` | Compact memory summary for dashboard |
| `<IntelligencePage>` | Full memory/intelligence dashboard |
| `<MonitorSettings>` | Monitor configuration in settings |
