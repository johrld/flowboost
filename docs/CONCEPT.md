# FlowBoost - The Apple of AI Content Engines

## Vision

FlowBoost ist keine Content-Plattform mit AI-Features. FlowBoost ist eine **Agent-Engine mit Content-UI**. Der Unterschied: Andere Tools bolzen AI auf existierende Workflows. FlowBoost baut den Workflow um die Agents herum. Die Agents sind die Engine, das UI ist das Lenkrad.

**Design-Philosophie (Linear-Prinzip):**
> "One really good way to do things. Opinionated at the atomic level, flexible at the project level."

Bedeutet: Es gibt EINEN Workflow. Der ist richtig. Das UI zwingt dich nicht zu Entscheidungen, die Agents besser treffen. Du steuerst nur, was Menschen besser entscheiden: Strategie, Brand, Timing, Freigabe.

---

## Die 7 Produkt-Prinzipien

1. **Das Dashboard sagt dir was zu tun ist** - Keine Metriken. Aktionen. "3 neue Chancen. 2 Artikel verlieren Rankings. 1 Review offen."
2. **Intelligence ist ambient** - SEO-Score, Brand-Compliance, interne Verlinkung laufen in Echtzeit. Sichtbar aber nie im Weg. Wie Rechtschreibprüfung.
3. **Agents arbeiten transparent** - Jede Agent-Entscheidung ist nachvollziehbar. "Ich empfehle dieses Keyword weil: Difficulty 23, Volume 2.400, ihr habt bereits 3 verwandte Artikel."
4. **Write once, publish everywhere** - Ein kanonischer Content. Automatische format-aware Repurposing zu Blog, Social, Email, Landing Page.
5. **GEO ist nativ** - Jeder Content wird für Google UND AI-Suchmaschinen (ChatGPT, Perplexity, Claude) optimiert. AI Visibility Tracking built-in.
6. **Content ist ein Graph** - Dein Content formt ein Knowledge Graph. Topics verbinden sich. Der Graph zeigt Lücken und Chancen automatisch.
7. **Progressive Disclosure** - Level 0: Was ist zu tun. Level 1: Brief mit einem Button. Level 2: Editor mit Score. Nie mehr als 2 Ebenen Tiefe.

---

## IST vs. SOLL Analyse

### Was FlowBoost heute hat (Phase 6A Demo)

| Bereich | Status | Bewertung |
|---------|--------|-----------|
| Dashboard | Stats + Upcoming + Active Pipelines | OK aber passiv - zeigt Zahlen statt Aktionen |
| Research | Topics + Content Gaps (2 Tabs) | Grundstruktur da, aber keine Quellenverwaltung, kein Graph |
| Planner | KW-Kalender mit Drag & Drop | Gut, aber nur Kalender - keine Kampagnen |
| Articles | Liste mit Stage/Condition + Editor | Editor braucht Rich Text, kein Content Score |
| Pipeline | Phase-Progress + Agent Activity | Gut, aber kein Agent Reasoning sichtbar |
| Settings | Projekt, Authors, Categories, Brand, Connector | Grundlagen da |
| Landing Pages | - | Fehlt komplett |
| Analytics/Performance | - | Fehlt komplett |
| Content Graph | - | Fehlt komplett |
| Repurposing | - | Fehlt komplett |

### Was die Besten der Welt haben (und FlowBoost braucht)

| Feature | Wer macht es am besten | FlowBoost Status | Priorität |
|---------|----------------------|------------------|-----------|
| Passive Discovery ("was soll ich schreiben?") | Frase 2.0 | Teilweise (Research) | HOCH |
| Content Briefs aus SERP-Daten | MarketMuse | Fehlt | HOCH |
| Real-time SEO Score im Editor | Surfer SEO | Fehlt | HOCH |
| Brand Voice Enforcement | Jasper/Writer.com | Nur in Settings | MITTEL |
| Content Decay Detection | Letterdrop/Frase | Fehlt | HOCH |
| GEO (AI Search Optimization) | Frase 2.0 | Fehlt | MITTEL |
| Topic Clustering / Knowledge Graph | MarketMuse/HubSpot | Fehlt | MITTEL |
| Personalized Difficulty | MarketMuse | Fehlt | MITTEL |
| Multi-Channel Publishing | StoryChief | Nur Git Connector | NIEDRIG |
| Content Repurposing | HubSpot Content Remix | Fehlt | NIEDRIG |
| Landing Page Builder | Loki.Build | Fehlt | MITTEL |
| Agent Reasoning / Observability | Keiner (Gap im Markt!) | Teilweise (Pipeline) | HOCH |
| AI Visibility Tracking | Frase 2.0 | Fehlt | NIEDRIG |

---

## Neue Navigationsstruktur

Aktuell: Dashboard, Research, Planner, Articles, Pipeline, Settings

**Neu:**

```
[Projekt-Selector]

  Discover               ← "Was soll ich schreiben?" (Research + Gaps + Graph)
  Plan                   ← Kalender + Briefs + Kampagnen
  Create                 ← Artikel + Landing Pages (der eigentliche Editor-Bereich)
  Monitor                ← Pipeline + Performance + Content Health

  ── Settings ──
  Project                ← Connector, Languages, Frequency, Sources
```

### Warum diese Struktur?

Die Struktur folgt dem **Content Lifecycle** in 4 Phasen:

```
Discover → Plan → Create → Monitor
  ↑                            │
  └────────────────────────────┘
        (Decay → Refresh)
```

Jeder Menüpunkt ist eine Phase. Kein User muss überlegen "wo finde ich X?" - die Frage ist immer "in welcher Phase meines Workflows bin ich?"

**Reduzierung von 5 auf 4 Hauptpunkte:**
- "Research" → "Discover" (klingt aktiver, enthält Research + Gaps + Graph)
- "Planner" → "Plan" (plus Briefs und Kampagnen)
- "Articles" → "Create" (plus Landing Pages und Editor)
- "Pipeline" + neue Performance → "Monitor" (alles was "beobachten" ist)

---

## Detail-Konzept pro Bereich

### 1. DISCOVER (vorher: Research)

**Vision:** Du öffnest FlowBoost und siehst sofort, was zu tun ist. Keine leere Seite. Der Agent hat über Nacht Chancen gefunden.

**Drei Tabs:**

#### Tab: Opportunities (Hauptansicht)

Die bisherigen "Topics", aber fundamental anders gedacht:

```
┌─────────────────────────────────────────────────────────────────┐
│ Discover                                                         │
│ 3 new opportunities since last visit · Last scan: 2h ago         │
│                                                                   │
│ [Opportunities 8]  [Content Gaps 7]  [Topic Map]                  │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ 🟢 HIGH CONFIDENCE                                          │  │
│ │                                                              │  │
│ │ "Box Breathing Technik"                                      │  │
│ │ Atemtechniken · Vol: 8.100 · Diff: 35 · PD: 18             │  │
│ │                                                              │  │
│ │ Agent Reasoning:                                             │  │
│ │ "Hohes Volumen bei niedriger Difficulty. Eure Domain hat     │  │
│ │ bereits 3 Artikel in Atemtechniken (Topic Authority: 42).    │  │
│ │ Personalized Difficulty ist nur 18. Featured Snippet Chance  │  │
│ │ bei 73%. Kein Konkurrent hat eine Breathe-App-Integration."  │  │
│ │                                                              │  │
│ │ Keywords: box breathing, 4-4-4-4 atmung, navy seal atmung   │  │
│ │ SERP Intent: How-to (informational)                          │  │
│ │ Competitors: atemkurs.de (Pos 3), yogaeasy.de (Pos 5)       │  │
│ │                                                              │  │
│ │ [✕ Reject]  [→ Create Brief]  [✓ Approve & Schedule]        │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ (weitere Opportunities...)                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Unterschiede zum jetzigen Research:**
- **Agent Reasoning prominent** - nicht eine Zeile, sondern ein aufklappbarer Absatz mit der vollen Begründung
- **Personalized Difficulty (PD)** - nicht generische Difficulty, sondern wie schwer es für DEINE Domain ist (MarketMuse-Konzept)
- **SERP Intent** - informational/transactional/navigational Label
- **Competitor Preview** - welche Konkurrenten ranken und auf welcher Position
- **Featured Snippet Chance** - Prozent-Wahrscheinlichkeit
- **3 klare Aktionen**: Reject (mit Feedback), Create Brief (generiert sofort einen Content Brief), Approve & Schedule (direkt in den Kalender)
- **"New since last visit" Counter** - zeigt wie viele neue Vorschläge der Agent gefunden hat

#### Tab: Content Gaps (wie aktuell, erweitert)

Bleibt ähnlich, aber mit Erweiterungen:
- **Heatmap-View** optional (eure Coverage vs. Top-3 Konkurrenz pro Kategorie)
- **"Not relevant" Button** - trainiert den Agent, diese Art von Gaps nicht mehr zu zeigen
- **Auto-Refresh**: Gaps werden wöchentlich aktualisiert basierend auf Competitor-Sitemap-Scans

#### Tab: Topic Map (NEU)

Visuelle Darstellung eurer Content-Coverage:

```
┌─────────────────────────────────────────────────────────────────┐
│ Topic Map                                                        │
│                                                                   │
│           ┌──────────────┐                                        │
│      ┌────┤  Atemtechniken├────┐                                  │
│      │    │  Authority: 42│    │                                   │
│      │    └──────────────┘    │                                   │
│   ┌──┴───┐  ┌──────┐   ┌────┴──┐                                │
│   │Box   │  │4-7-8 │   │Wim   │                                  │
│   │Breath│  │Atem  │   │Hof   │                                  │
│   │✅ Live│  │✅ Live│   │✅ Live│                                  │
│   └──────┘  └──────┘   └──────┘                                  │
│                 │                                                  │
│            ┌────┴────┐                                            │
│            │Pranayama│  ← GAP (gestrichelt)                       │
│            │🔴 Missing│                                            │
│            └─────────┘                                            │
│                                                                   │
│  Legend: ✅ Published  🟡 In Progress  🔴 Gap  ⚪ Planned          │
└─────────────────────────────────────────────────────────────────┘
```

- Hub-and-Spoke Visualisierung pro Kategorie
- Zeigt Topic Authority Score pro Cluster
- Gaps sind sofort sichtbar (gestrichelte Nodes)
- Klick auf Gap → direkt Brief erstellen
- Daten kommen vom Content Graph (Backend)

---

### 2. PLAN (vorher: Planner)

**Vision:** Der Kalender plus alles was "Planung" ist: Briefs, Scheduling, Kampagnen.

**Drei Tabs:**

#### Tab: Calendar (wie aktuell)

Der KW-Kalender bleibt, mit kleinen Verbesserungen:
- **Publishing Frequency Indicator** - zeigt ob ihr On-Track seid (3/Woche Ziel vs. aktuelle Planung)
- **Kampagnen-Farben** - Artikel die zu einer Kampagne gehören haben farbliche Markierung
- **Drag aus Discover** - Topics direkt von Discover in den Kalender ziehen

#### Tab: Briefs (NEU)

Content Briefs als eigene Ansicht:

```
┌─────────────────────────────────────────────────────────────────┐
│ Briefs                                                           │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ Brief: Box Breathing Technik                                │  │
│ │ Generated: 07.02.2026 · Status: Ready for Writing           │  │
│ │                                                              │  │
│ │ Target Keyword: box breathing  (Vol: 8.100, PD: 18)         │  │
│ │ Secondary: 4-4-4-4 atmung, navy seal atemtechnik            │  │
│ │ Word Count Target: 1.400-1.800                               │  │
│ │ Content Type: Blog Post                                      │  │
│ │ SERP Intent: How-to (informational)                          │  │
│ │ Featured Snippet Target: Yes (step-by-step format)           │  │
│ │                                                              │  │
│ │ Suggested Structure:                                         │  │
│ │ ├─ H2: Was ist Box Breathing?                                │  │
│ │ ├─ H2: Schritt-für-Schritt Anleitung                        │  │
│ │ ├─ H2: Wissenschaftliche Wirkung                             │  │
│ │ ├─ H2: Variationen für Fortgeschrittene                     │  │
│ │ └─ H2: Box Breathing im Alltag                               │  │
│ │                                                              │  │
│ │ Questions to Answer (PAA):                                   │  │
│ │ • Wie oft sollte man Box Breathing machen?                   │  │
│ │ • Kann Box Breathing bei Panikattacken helfen?               │  │
│ │ • Ist Box Breathing für Anfänger geeignet?                   │  │
│ │                                                              │  │
│ │ Internal Links to Include:                                   │  │
│ │ • /de/blog/4-7-8-atemtechnik (Atemtechnik-Cluster)          │  │
│ │ • /de/blog/atemtechniken-gegen-angst (Stress-Cluster)       │  │
│ │                                                              │  │
│ │ Competitors to Beat:                                         │  │
│ │ • atemkurs.de (Pos 3, 1.200 Wörter, Score: 67)              │  │
│ │ • yogaeasy.de (Pos 5, 800 Wörter, Score: 54)                │  │
│ │                                                              │  │
│ │ [Edit Brief]  [→ Start Production]                           │  │
│ └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

- Briefs werden automatisch generiert wenn ein Topic approved wird
- Editierbar (User kann Struktur anpassen)
- "Start Production" triggert die Agent-Pipeline
- Brief-Daten fließen in den Writer-Agent als Kontext

#### Tab: Campaigns (NEU, optional für v2)

Gruppierung von Content nach Kampagnen/Zielen:
- z.B. "Atemtechniken Launch" = 5 Artikel + 2 Landing Pages + Social Posts
- Kampagnen-Progress-Tracker
- Zeitlich begrenzte Content-Initiativen

---

### 3. CREATE (vorher: Articles)

**Vision:** Alles was "erstellen" ist. Blog-Artikel, Landing Pages, und der Editor.

**Zwei Tabs:**

#### Tab: Articles (wie aktuell, erweitert)

Die Artikelliste bleibt, mit Erweiterungen:
- **Content Score Spalte** - SEO-Grad (A-F) pro Artikel, wie Clearscope
- **Health Indicator** - grün/gelb/rot basierend auf Ranking-Trend (braucht GSC)
- **"Needs Refresh" Badge** - wenn Content decaying (Position sinkt über 3 Monate)

#### Tab: Landing Pages (NEU)

Eigene Sektion für Landing Pages:

```
┌─────────────────────────────────────────────────────────────────┐
│ Landing Pages                                                    │
│                                                                   │
│ [+ New Landing Page]                                              │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────┐    │
│ │ Breathe App Download                          🟢 Live      │    │
│ │ /de/app · Conversions: 234 · CTR: 4.2%                   │    │
│ ├───────────────────────────────────────────────────────────┤    │
│ │ Meditation für Anfänger Guide                 🟡 Draft     │    │
│ │ /de/guides/meditation-anfaenger · Not published           │    │
│ ├───────────────────────────────────────────────────────────┤    │
│ │ Atemtechniken Übersicht                       🟢 Live      │    │
│ │ /de/atemtechniken · Conversions: 89 · CTR: 3.1%          │    │
│ └───────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

- Landing Pages haben anderen Workflow als Blog-Artikel
- Fokus auf Conversion statt SEO-Score
- Template-basiert (Hero, Features, Testimonials, CTA)
- AI-generierbar aus einem Prompt ("Erstelle Landing Page für Breathe App Download")
- A/B Testing Unterstützung (v2)

#### Editor (bestehend, aber upgraded)

Der Artikel-Editor braucht diese Upgrades:

**Content Score Widget (Surfer-Inspiriert):**
```
┌─────────┐
│   B+    │  ← Letter Grade (ambient, immer sichtbar)
│  Score  │
│  72/100 │
│         │
│ SEO  ██░│ 78
│ Read ███│ 85
│ Brand██░│ 71
│ GEO  █░░│ 54
└─────────┘
```

- Echtzeit-Score der sich beim Schreiben aktualisiert
- 4 Sub-Scores: SEO, Readability, Brand Compliance, GEO
- Farbig: A+ grün, B gelb, C orange, D/F rot
- Toggle-bar: kann eingeklappt werden für cleanes Schreiben

**SEO Suggestions Panel (togglebar):**
- Keywords die noch fehlen mit empfohlener Häufigkeit
- Interne Links die eingefügt werden sollten
- Fragen die noch nicht beantwortet sind (aus Brief)
- Wortanzahl vs. Ziel

**Rich Text Editor:**
- Tiptap-basiert (ProseMirror)
- Markdown Import/Export
- H1-H3, Blockquotes, Listen, Links, Bilder
- Inline-Formatting
- Slash-Commands (/ für schnelle Aktionen)

---

### 4. MONITOR (vorher: Pipeline)

**Vision:** Alles was "beobachten und analysieren" ist. Pipeline-Runs, Content-Performance, Content-Health.

**Drei Tabs:**

#### Tab: Pipeline (wie aktuell)

Bleibt, mit einer Erweiterung:

**Agent Reasoning Trail:**
Klick auf eine Phase → expandiert zu Agent-Reasoning:

```
┌─────────────────────────────────────────────────────────────────┐
│ ▼ Writing Phase (6 Sections)                                     │
│                                                                   │
│ Section "Was ist Box Breathing?" → ✅ Complete                    │
│   Writer Agent: "Habe 3 SERP-Quellen analysiert. atemkurs.de    │
│   hat diesen Abschnitt in 180 Wörtern, yogaeasy.de in 120.      │
│   Ich schreibe 250 Wörter mit Breathe-App-Integration als       │
│   Differentiator. Verwende Navy SEAL Kontext da SERP zeigt      │
│   hohe Klickrate bei diesem Angle."                               │
│                                                                   │
│ Section "Schritt-für-Schritt" → ✅ Complete                       │
│   Writer Agent: "Featured Snippet Format gewählt (nummerierte   │
│   Liste) da Google PAA dies bevorzugt..."                         │
└─────────────────────────────────────────────────────────────────┘
```

Das ist der **Agent Observability Gap** den kein Konkurrent gelöst hat. Transparenz = Vertrauen.

#### Tab: Performance (NEU)

Content-Performance Dashboard:

```
┌─────────────────────────────────────────────────────────────────┐
│ Performance                        Last 30 days ▼                │
│                                                                   │
│ Total Clicks   Impressions   Avg Position   Articles Live         │
│ 12.400 ↑23%    284k ↑15%    14.2 ↑2.1      18                   │
│                                                                   │
│ Top Performers                                                    │
│ ┌────────────────────────────┬──────┬────────┬─────┬──────┐      │
│ │ Article                    │Clicks│Impr.   │ Pos │Trend │      │
│ ├────────────────────────────┼──────┼────────┼─────┼──────┤      │
│ │ Wim Hof Atemtechnik       │ 2.340│  45.2k │  4.1│  ↑   │      │
│ │ Atemtechniken gegen Angst  │ 1.890│  38.7k │  6.3│  →   │      │
│ │ 5 Minuten Meditation       │ 1.230│  28.1k │  8.7│  ↓   │      │
│ └────────────────────────────┴──────┴────────┴─────┴──────┘      │
│                                                                   │
│ ⚠ Content Decay Alerts                                            │
│ • "5 Minuten Meditation" Position dropped 8.7→12.3 (3 months)   │
│   → [Refresh Article]                                             │
│ • "Morgenmeditation" CTR dropped 3.2%→1.8%                       │
│   → [Optimize Title & Meta]                                      │
└─────────────────────────────────────────────────────────────────┘
```

- GSC-Daten Integration (Phase 6B)
- Per-Artikel Performance mit Trend-Pfeilen
- **Content Decay Alerts** - automatisch wenn Position über 3 Monate fällt
- "Refresh Article" Button → triggert Re-Optimization Pipeline
- AI Visibility Tab (v2) - Tracking ob ChatGPT/Perplexity euch zitiert

#### Tab: Health (NEU)

Content-Health Übersicht aller veröffentlichten Artikel:

```
┌─────────────────────────────────────────────────────────────────┐
│ Content Health                                                    │
│                                                                   │
│ 18 Live Articles · 14 Healthy · 3 Needs Attention · 1 Critical  │
│                                                                   │
│ ┌─────────────────────────┬───────┬─────────┬──────────────────┐ │
│ │ Article                 │ Score │ Health  │ Action Needed    │ │
│ ├─────────────────────────┼───────┼─────────┼──────────────────┤ │
│ │ Wim Hof Atemtechnik     │  A    │ 🟢      │ None             │ │
│ │ Box Breathing            │  B+   │ 🟢      │ None             │ │
│ │ 5 Minuten Meditation     │  C+   │ 🟡      │ Refresh content  │ │
│ │ Morgenmeditation         │  C    │ 🔴      │ Title + Meta     │ │
│ └─────────────────────────┴───────┴─────────┴──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

- Kombination aus SEO-Score + Ranking-Trend + Alter
- Automated Refresh Suggestions
- Einfaches Ampelsystem: 🟢 🟡 🔴

---

### 5. SETTINGS (erweitert)

Neue Tabs zusätzlich zu den bestehenden:

#### Tab: Sources (NEU)

Quellenverwaltung für den Research-Agent:

```
┌─────────────────────────────────────────────────────────────────┐
│ Sources                                                          │
│                                                                   │
│ Competitor Domains                                                │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ atemkurs.de          Last scanned: 2h ago    [Remove]     │   │
│ │ yogaeasy.de          Last scanned: 2h ago    [Remove]     │   │
│ │ 7mind.de             Last scanned: 1d ago    [Remove]     │   │
│ │ headspace.com/de     Last scanned: 1d ago    [Remove]     │   │
│ │ [+ Add Domain]                                             │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ Scan Frequency: [Weekly ▼]                                        │
│                                                                   │
│ Connected Services                                                │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ Google Search Console    ✅ Connected (breathe-app.de)     │   │
│ │ Google Analytics 4       ⚪ Not Connected  [Connect]       │   │
│ └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dashboard Redesign

Das Dashboard wird **aktionsorientiert** statt metrisch:

```
┌─────────────────────────────────────────────────────────────────┐
│ Good morning, Johannes                      Breathe · 7 Feb 2026│
│                                                                   │
│ ┌── Your Actions ──────────────────────────────────────────────┐ │
│ │                                                               │ │
│ │ 🔵 3 new topic opportunities                    [Review →]   │ │
│ │ 🟡 2 articles need review                       [Review →]   │ │
│ │ 🔴 1 article losing rankings                    [Fix →]      │ │
│ │ ✅ "Stressabbau Techniken" production complete  [Review →]   │ │
│ │                                                               │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌── This Week ──────────────────────┬── Active Pipelines ──────┐ │
│ │ MO 10.02  Box Breathing    🟡Ready│ Stressabbau Techniken    │ │
│ │ MI 12.02  4-7-8 Atemtechnik🟡Rdy │ ████████░░ Image (4/6)   │ │
│ │ FR 14.02  Stressabbau      🔵Prod│                           │ │
│ │                                    │ No other runs active      │ │
│ │ 3/3 articles planned ✓            │                           │ │
│ └────────────────────────────────────┴──────────────────────────┘ │
│                                                                   │
│ ┌── Content Health ────────────────────────────────────────────┐ │
│ │ 18 live · 14 🟢 · 3 🟡 · 1 🔴                               │ │
│ │ ⚠ "5 Min Meditation" lost 4 positions → Refresh recommended  │ │
│ └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Key Change:** "Your Actions" Box ganz oben. Das ist das Erste was du siehst. Nicht Stats, nicht Charts - Aktionen die DU treffen musst.

---

## Content Types

### Blog Post (bestehend)
- 1.200-2.000 Wörter
- SEO-optimiert, Answer Capsule, FAQ
- Pipeline: Outline → Writing → Assembly → Image → Quality → Translation

### Landing Page (NEU)
- Template-basiert: Hero, Features, Social Proof, CTA
- Conversion-optimiert statt SEO-optimiert
- Kürzere Pipeline: Template → Copy → Image → Review
- A/B Testing Support (v2)

### Guide / Pillar Page (bestehend in Breathe, neu in FlowBoost)
- 3.000-5.000 Wörter
- Hub-Content der Blog Posts verbindet
- Spezielle Pipeline mit mehr Research-Tiefe
- Topic Cluster Anchor

---

## Implementierungs-Roadmap

### Phase 6A+ (Demo-Erweiterung - jetzt)

Was wir JETZT im Demo-UI umsetzen können:

1. **Navigation umbauen** → Discover, Plan, Create, Monitor
2. **Dashboard aktionsorientiert** → "Your Actions" Box
3. **Discover/Topics anreichern** → Agent Reasoning expandable, SERP Intent, Competitor Preview
4. **Discover/Topic Map** → Einfache Cluster-Visualisierung (Mock)
5. **Plan/Briefs** → Content Brief Ansicht (Mock-Daten)
6. **Create/Landing Pages** → Landing Page Liste (Mock)
7. **Monitor/Performance** → Performance-Tab (Mock GSC-Daten)
8. **Monitor/Health** → Content Health Übersicht (Mock)
9. **Settings/Sources** → Competitor-Domain Verwaltung
10. **Editor: Content Score** → Score Widget im Editor

### Phase 6B (API-Anbindung)

11. Backend-Erweiterungen (Briefs API, Content Score API)
12. GSC Integration (Performance + Decay Detection)
13. Rich Text Editor (Tiptap)
14. Real-time Content Score (SEO + Readability + Brand)
15. Pipeline Agent Reasoning Trails
16. Competitor Sitemap Scanner
17. Content Graph / Topic Clustering

### Phase 6C (Advanced)

18. GEO Optimization + AI Visibility Tracking
19. Content Repurposing (Blog → Social, Email)
20. Landing Page Builder (Template + AI)
21. A/B Testing
22. Multi-User + Approval Workflows
23. Predictive Content Decay

---

## Wettbewerbsvorteil

Was FlowBoost einzigartig macht:

1. **Agent-First Architecture** - Nicht AI als Feature, sondern Agents als Foundation. Der gesamte Workflow ist um die Agents herum gebaut.

2. **Agent Observability** - Kein Konkurrent zeigt Agent-Reasoning transparent. FlowBoost zeigt für jede Entscheidung warum sie getroffen wurde.

3. **End-to-End Ownership** - Von Research bis Analytics in einer Plattform. Kein Tool-Hopping zwischen SEMrush, Surfer, WordPress, GA4.

4. **Opinionated Simplicity** - Ein Workflow, nicht hundert Optionen. Die Engine entscheidet, der User steuert.

5. **Content Graph** - Content als Knowledge Graph statt als Dateien. Beziehungen, Lücken, Authority - alles visualisiert.

6. **Dual SEO + GEO** - Optimiert für Google UND AI-Suchmaschinen. Zukunftssicher.
