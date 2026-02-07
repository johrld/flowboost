import type {
  Project,
  Topic,
  Article,
  PipelineRun,
  Author,
  Category,
  ContentGap,
} from "./types";

// ── Projects ────────────────────────────────────────────────────

export const projects: Project[] = [
  {
    id: "proj_breathe",
    name: "Breathe",
    languages: ["de", "en", "es"],
    connector: "git",
    publishFrequency: { articlesPerWeek: 3, preferredDays: [1, 3, 5] },
  },
  {
    id: "proj_finhub",
    name: "FinHub",
    languages: ["de", "en"],
    connector: "git",
    publishFrequency: { articlesPerWeek: 2, preferredDays: [2, 4] },
  },
];

// ── Authors ─────────────────────────────────────────────────────

export const authors: Author[] = [
  { id: "johannes", name: "Johannes Herold", role: "Founder & Developer" },
  { id: "sarah", name: "Sarah Chen", role: "Meditation Teacher" },
  { id: "maria", name: "Maria Santos", role: "Mindfulness Coach" },
  { id: "breathe-team", name: "Breathe Team", role: "Editorial Team" },
];

// ── Categories ──────────────────────────────────────────────────

export const categories: Category[] = [
  { id: "meditation", labels: { de: "Meditation", en: "Meditation", es: "Meditacion" } },
  { id: "breathing", labels: { de: "Atemtechniken", en: "Breathing Techniques", es: "Tecnicas de Respiracion" } },
  { id: "mindfulness", labels: { de: "Achtsamkeit", en: "Mindfulness", es: "Mindfulness" } },
  { id: "sleep", labels: { de: "Schlaf & Entspannung", en: "Sleep & Relaxation", es: "Sueno & Relajacion" } },
  { id: "stress", labels: { de: "Stress & Angst", en: "Stress & Anxiety", es: "Estres & Ansiedad" } },
];

// ── Topics ──────────────────────────────────────────────────────

export const topics: Topic[] = [
  {
    id: "topic_1",
    projectId: "proj_breathe",
    title: "Box Breathing Technik",
    slug: "box-breathing-technik",
    category: "breathing",
    keywords: ["box breathing", "4-4-4-4 atmung", "navy seal atmung"],
    priority: "high",
    status: "approved",
    scheduledDate: "2026-02-10",
    searchVolume: 8100,
    difficulty: 35,
    confidence: "high",
    reasoning: "Hohes Suchvolumen, niedrige Difficulty. Kein bestehender Artikel vorhanden.",
  },
  {
    id: "topic_2",
    projectId: "proj_breathe",
    title: "Atemtechniken gegen Angst",
    slug: "atemtechniken-gegen-angst",
    category: "stress",
    keywords: ["atemtechniken angst", "panikattacke atmung", "beruhigende atemubungen"],
    priority: "high",
    status: "done",
    scheduledDate: "2026-02-03",
    searchVolume: 5400,
    difficulty: 42,
    confidence: "high",
    reasoning: "Starke Suchintention, Top-3 Konkurrenz hat duenne Inhalte.",
  },
  {
    id: "topic_3",
    projectId: "proj_breathe",
    title: "Wim Hof Atemtechnik",
    slug: "wim-hof-atemtechnik",
    category: "breathing",
    keywords: ["wim hof methode", "wim hof atmung", "tummo atmung"],
    priority: "medium",
    status: "done",
    scheduledDate: "2026-02-05",
    searchVolume: 12100,
    difficulty: 58,
    confidence: "medium",
    reasoning: "Sehr hohes Volumen, aber starke Konkurrenz. Chance durch Praxis-Fokus.",
  },
  {
    id: "topic_4",
    projectId: "proj_breathe",
    title: "Meditation fur Anfanger",
    slug: "meditation-fuer-anfaenger",
    category: "meditation",
    keywords: ["meditation anfanger", "meditation lernen", "erste meditation"],
    priority: "medium",
    status: "researched",
    searchVolume: 14800,
    difficulty: 62,
    confidence: "medium",
    reasoning: "Pillar-Content Potenzial. Konkurrenz stark, aber eure Brand Voice differenziert.",
  },
  {
    id: "topic_5",
    projectId: "proj_breathe",
    title: "Schlafhygiene verbessern",
    slug: "schlafhygiene-verbessern",
    category: "sleep",
    keywords: ["schlafhygiene", "besser schlafen", "einschlafhilfe"],
    priority: "low",
    status: "researched",
    searchVolume: 3600,
    difficulty: 28,
    confidence: "high",
    reasoning: "Niedrige Difficulty, guter Einstieg in Sleep-Kategorie. Wenig Konkurrenz.",
  },
  {
    id: "topic_6",
    projectId: "proj_breathe",
    title: "Achtsamkeit im Alltag",
    slug: "achtsamkeit-im-alltag",
    category: "mindfulness",
    keywords: ["achtsamkeit alltag", "mindfulness ubungen", "achtsam leben"],
    priority: "medium",
    status: "researched",
    searchVolume: 6600,
    difficulty: 45,
    confidence: "medium",
    reasoning: "Gutes Volumen, starker App-Bezug moeglich. 3 von 5 Top-Ergebnissen veraltet.",
  },
  {
    id: "topic_7",
    projectId: "proj_breathe",
    title: "4-7-8 Atemtechnik",
    slug: "4-7-8-atemtechnik",
    category: "breathing",
    keywords: ["4 7 8 atmung", "einschlaf atemtechnik", "dr weil atmung"],
    priority: "high",
    status: "approved",
    scheduledDate: "2026-02-12",
    searchVolume: 9900,
    difficulty: 38,
    confidence: "high",
    reasoning: "Top-Keyword in Sleep+Breathing Overlap. SERP zeigt Featured Snippet Chance.",
  },
  {
    id: "topic_8",
    projectId: "proj_breathe",
    title: "Stressabbau Techniken",
    slug: "stressabbau-techniken",
    category: "stress",
    keywords: ["stress abbauen", "stressabbau methoden", "entspannungstechniken"],
    priority: "medium",
    status: "producing",
    scheduledDate: "2026-02-14",
    searchVolume: 7200,
    difficulty: 52,
    confidence: "medium",
    reasoning: "Breites Thema, aber gut fuer Topic Cluster Aufbau in Stress-Kategorie.",
  },
];

// ── Content Gaps ─────────────────────────────────────────────────

export const contentGaps: ContentGap[] = [
  {
    id: "gap_1",
    projectId: "proj_breathe",
    topic: "Atemubungen bei Bluthochdruck",
    competitors: ["atemkurs.de", "gesundheit.de"],
    searchVolume: 4400,
    difficulty: 31,
    category: "breathing",
    suggestedType: "blog",
    opportunity: "high",
  },
  {
    id: "gap_2",
    projectId: "proj_breathe",
    topic: "Meditation gegen Schlafstorungen",
    competitors: ["headspace.com", "calm.com", "atemkurs.de"],
    searchVolume: 8800,
    difficulty: 55,
    category: "sleep",
    suggestedType: "guide",
    opportunity: "high",
  },
  {
    id: "gap_3",
    projectId: "proj_breathe",
    topic: "Pranayama Techniken Ubersicht",
    competitors: ["yogaeasy.de", "atemkurs.de"],
    searchVolume: 3200,
    difficulty: 42,
    category: "breathing",
    suggestedType: "guide",
    opportunity: "medium",
  },
  {
    id: "gap_4",
    projectId: "proj_breathe",
    topic: "Bodyscan Meditation Anleitung",
    competitors: ["headspace.com", "7mind.de"],
    searchVolume: 5600,
    difficulty: 38,
    category: "meditation",
    suggestedType: "blog",
    opportunity: "high",
  },
  {
    id: "gap_5",
    projectId: "proj_breathe",
    topic: "Achtsamkeitsubungen fur Kinder",
    competitors: ["familienhandbuch.de", "7mind.de", "calm.com"],
    searchVolume: 2900,
    difficulty: 25,
    category: "mindfulness",
    suggestedType: "blog",
    opportunity: "medium",
  },
  {
    id: "gap_6",
    projectId: "proj_breathe",
    topic: "Vagusnerv stimulieren Ubungen",
    competitors: ["gesundheit.de", "atemkurs.de", "yogaeasy.de"],
    searchVolume: 12400,
    difficulty: 48,
    category: "stress",
    suggestedType: "guide",
    opportunity: "high",
  },
  {
    id: "gap_7",
    projectId: "proj_breathe",
    topic: "Gehmeditation Anleitung",
    competitors: ["7mind.de"],
    searchVolume: 1800,
    difficulty: 18,
    category: "meditation",
    suggestedType: "blog",
    opportunity: "low",
  },
];

// ── Articles ────────────────────────────────────────────────────

export const articles: Article[] = [
  {
    id: "art_1",
    projectId: "proj_breathe",
    topicId: "topic_2",
    title: "Atemtechniken gegen Angst: 7 Methoden im Vergleich",
    slug: "atemtechniken-gegen-angst-vergleich",
    category: "stress",
    author: "breathe-team",
    stage: "live",
    condition: "ok",
    lang: "de",
    createdAt: "2026-01-28T10:00:00Z",
    scheduledDate: "2026-02-03",
    publishedAt: "2026-02-03T08:00:00Z",
    lastEditedAt: "2026-02-02T14:30:00Z",
    versions: [],
  },
  {
    id: "art_2",
    projectId: "proj_breathe",
    topicId: "topic_3",
    title: "Wim Hof Atmung: Technik, Wirkung & Anleitung",
    slug: "wim-hof-atmung",
    category: "breathing",
    author: "sarah",
    stage: "live",
    condition: "editing",
    lang: "de",
    createdAt: "2026-01-30T14:00:00Z",
    scheduledDate: "2026-02-05",
    publishedAt: "2026-02-05T08:00:00Z",
    lastEditedAt: "2026-02-07T11:30:00Z",
    versions: [],
  },
  {
    id: "art_3",
    projectId: "proj_breathe",
    topicId: "topic_1",
    title: "Box Breathing: Die Navy SEAL Atemtechnik",
    slug: "box-breathing-technik",
    category: "breathing",
    author: "breathe-team",
    stage: "ready",
    condition: "needs_review",
    lang: "de",
    createdAt: "2026-02-05T09:00:00Z",
    scheduledDate: "2026-02-10",
    lastEditedAt: "2026-02-07T10:00:00Z",
    versions: [],
  },
  {
    id: "art_4",
    projectId: "proj_breathe",
    topicId: "topic_7",
    title: "4-7-8 Atemtechnik: Einschlafen in 60 Sekunden",
    slug: "4-7-8-atemtechnik",
    category: "breathing",
    author: "maria",
    stage: "ready",
    condition: "needs_review",
    lang: "de",
    createdAt: "2026-02-06T14:00:00Z",
    scheduledDate: "2026-02-12",
    lastEditedAt: "2026-02-07T08:00:00Z",
    versions: [],
  },
  {
    id: "art_5",
    projectId: "proj_breathe",
    topicId: "topic_8",
    title: "Stressabbau: 10 Techniken die sofort wirken",
    slug: "stressabbau-techniken",
    category: "stress",
    author: "breathe-team",
    stage: "producing",
    condition: "ok",
    lang: "de",
    createdAt: "2026-02-07T09:15:00Z",
    scheduledDate: "2026-02-14",
    versions: [],
  },
];

// ── Pipeline Runs ───────────────────────────────────────────────

export const pipelineRuns: PipelineRun[] = [
  {
    id: "run_1",
    projectId: "proj_breathe",
    topicId: "topic_8",
    topicTitle: "Stressabbau Techniken",
    type: "production",
    status: "running",
    startedAt: "2026-02-07T09:15:00Z",
    phases: [
      {
        name: "outline",
        status: "completed",
        startedAt: "2026-02-07T09:15:00Z",
        completedAt: "2026-02-07T09:16:30Z",
        agents: [
          {
            name: "outline-architect",
            status: "completed",
            toolCalls: [
              { tool: "Read", summary: "posts/de/", timestamp: "2026-02-07T09:15:10Z" },
              { tool: "WebSearch", summary: "stressabbau techniken 2026", timestamp: "2026-02-07T09:15:30Z" },
              { tool: "Write", summary: "outline.json", timestamp: "2026-02-07T09:16:20Z" },
            ],
          },
        ],
      },
      {
        name: "writing",
        status: "completed",
        startedAt: "2026-02-07T09:16:30Z",
        completedAt: "2026-02-07T09:22:00Z",
        agents: [
          { name: "section-writer-meta", status: "completed", toolCalls: [] },
          { name: "section-writer-intro", status: "completed", toolCalls: [] },
          { name: "section-writer-h2-1", status: "completed", toolCalls: [] },
          { name: "section-writer-h2-2", status: "completed", toolCalls: [] },
          { name: "section-writer-h2-3", status: "completed", toolCalls: [] },
          { name: "section-writer-conclusion", status: "completed", toolCalls: [] },
        ],
      },
      {
        name: "assembly",
        status: "completed",
        startedAt: "2026-02-07T09:22:00Z",
        completedAt: "2026-02-07T09:23:30Z",
        agents: [
          {
            name: "content-editor",
            status: "completed",
            toolCalls: [
              { tool: "Bash", summary: "assemble-article.js", timestamp: "2026-02-07T09:22:10Z" },
              { tool: "Bash", summary: "content-metrics.js", timestamp: "2026-02-07T09:23:00Z" },
            ],
          },
        ],
      },
      {
        name: "image",
        status: "running",
        startedAt: "2026-02-07T09:23:30Z",
        agents: [
          {
            name: "image-generator",
            status: "running",
            toolCalls: [
              { tool: "Bash", summary: "imagen4 API call", timestamp: "2026-02-07T09:23:40Z" },
            ],
          },
        ],
      },
      { name: "quality", status: "pending", agents: [] },
      { name: "translation", status: "pending", agents: [] },
    ],
  },
  {
    id: "run_2",
    projectId: "proj_breathe",
    topicId: "topic_7",
    topicTitle: "4-7-8 Atemtechnik",
    type: "production",
    status: "completed",
    startedAt: "2026-02-06T14:00:00Z",
    completedAt: "2026-02-06T14:12:00Z",
    phases: [
      { name: "outline", status: "completed", startedAt: "2026-02-06T14:00:00Z", completedAt: "2026-02-06T14:01:30Z", agents: [] },
      { name: "writing", status: "completed", startedAt: "2026-02-06T14:01:30Z", completedAt: "2026-02-06T14:06:00Z", agents: [] },
      { name: "assembly", status: "completed", startedAt: "2026-02-06T14:06:00Z", completedAt: "2026-02-06T14:07:00Z", agents: [] },
      { name: "image", status: "completed", startedAt: "2026-02-06T14:07:00Z", completedAt: "2026-02-06T14:08:30Z", agents: [] },
      { name: "quality", status: "completed", startedAt: "2026-02-06T14:08:30Z", completedAt: "2026-02-06T14:10:00Z", agents: [] },
      { name: "translation", status: "completed", startedAt: "2026-02-06T14:10:00Z", completedAt: "2026-02-06T14:12:00Z", agents: [] },
    ],
  },
];

// ── Mock Article Content ────────────────────────────────────────

export const mockArticleContent = `---
title: "Box Breathing: Die Navy SEAL Atemtechnik fur sofortige Ruhe"
description: "Lerne die Box Breathing Technik (4-4-4-4), die Navy SEALs nutzen. Schritt-fur-Schritt Anleitung, Wirkung und Variationen."
pubDate: 2026-02-10
author: breathe-team
category: breathing
tags:
  - atemtechnik
  - stressabbau
  - anfanger
keywords:
  - box breathing
  - 4-4-4-4 atmung
  - navy seal atmung
lang: de
translationKey: box-breathing-technique
faq:
  - question: "Wie oft sollte ich Box Breathing machen?"
    answer: "Ideal sind 3-4 Runden (je 4 Zyklen) pro Session. Anfanger starten mit 2 Runden."
  - question: "Kann Box Breathing bei Panikattacken helfen?"
    answer: "Ja, die gleichmassige Struktur gibt dem Nervensystem klare Signale zur Beruhigung."
  - question: "Ist Box Breathing fur Anfanger geeignet?"
    answer: "Absolut. Die einfache 4-4-4-4 Struktur macht es zur idealen Einstiegs-Atemtechnik."
draft: false
---

> **Box Breathing** (Quadrat-Atmung) ist eine 4-4-4-4 Atemtechnik, die von Navy SEALs und Leistungssportlern genutzt wird. Du atmest 4 Sekunden ein, haltst 4 Sekunden, atmest 4 Sekunden aus und haltst erneut 4 Sekunden. Schon nach 3 Runden spurst du die Wirkung.

## Was ist Box Breathing?

Box Breathing — auch Quadrat-Atmung oder Square Breathing genannt — ist eine strukturierte Atemtechnik mit vier gleich langen Phasen. Der Name kommt von der quadratischen Struktur: Einatmen, Halten, Ausatmen, Halten, jeweils gleich lang.

Die Technik wurde durch das US-Militar bekannt. Navy SEALs nutzen sie vor und wahrend Einsatzen, um unter extremem Stress fokussiert zu bleiben. Heute ist Box Breathing in Unternehmen, im Sport und in der Therapie verbreitet.

## So funktioniert Box Breathing: Schritt-fur-Schritt

Die Grundtechnik ist einfach:

1. **Einatmen** (4 Sekunden) — Atme langsam und tief durch die Nase ein
2. **Halten** (4 Sekunden) — Halte den Atem sanft an, ohne Anspannung
3. **Ausatmen** (4 Sekunden) — Atme gleichmassig durch den Mund aus
4. **Halten** (4 Sekunden) — Bleibe leer, bevor du neu einatmest

Das ist ein Zyklus. Wiederhole 4 Zyklen fur eine Runde.

## Die wissenschaftliche Wirkung

Studien zeigen, dass Box Breathing das autonome Nervensystem beeinflusst. Die gleichmassige Struktur aktiviert den Parasympathikus — den "Ruhe-und-Verdauungs"-Modus deines Korpers.

### Nachgewiesene Effekte

- **Cortisol-Reduktion**: Stresshormon sinkt nach 5 Minuten messbar
- **HRV-Verbesserung**: Herzratenvariabilitat steigt (Zeichen fur Resilienz)
- **Blutdruck-Senkung**: Systolischer Wert sinkt um 5-10 mmHg
- **Fokus-Steigerung**: Verbesserte Konzentration fur 60-90 Minuten

## Variationen fur Fortgeschrittene

Wenn dir 4-4-4-4 leicht fallt, probiere diese Variationen:

- **5-5-5-5**: Langere Zyklen fur tiefere Entspannung
- **4-7-4-7**: Langeres Halten fur starkere Vagus-Stimulation
- **6-6-6-6**: Fortgeschrittene Version fur erfahrene Atmer

## Box Breathing im Alltag integrieren

Die beste Atemtechnik ist die, die du tatsachlich nutzt. Hier sind drei ideale Zeitpunkte:

### Morgens nach dem Aufwachen
3 Runden Box Breathing direkt nach dem Aufstehen setzen den Ton fur den Tag.

### Vor wichtigen Terminen
2 Runden vor einem Meeting, Vortrag oder schwierigen Gesprach.

### Abends zum Runterkommen
4 Runden als Ubergang zwischen Arbeit und Feierabend.

## Fazit

Box Breathing ist eine der effektivsten und einfachsten Atemtechniken. Die 4-4-4-4 Struktur ist leicht zu merken, uberall anwendbar und wirkt innerhalb von Minuten. Starte heute mit 3 Runden und erlebe den Unterschied.
`;
