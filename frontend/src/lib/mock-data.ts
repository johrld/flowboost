import type {
  Project,
  Topic,
  Article,
  PipelineRun,
  Author,
  Category,
  Brief,
  DashboardAction,
} from "./types";

// ── Projects ────────────────────────────────────────────────────

export const projects: Project[] = [
  {
    id: "proj_breathe",
    customerId: "default",
    name: "Breathe",
    slug: "breathe",
    description: "Breathe Meditation App Website",
    defaultLanguage: "de",
    languages: [
      { code: "de", name: "Deutsch", enabled: true },
      { code: "en", name: "English", enabled: true },
      { code: "es", name: "Español", enabled: true },
    ],
    categories: [
      { id: "meditation", labels: { de: "Meditation", en: "Meditation", es: "Meditacion" } },
      { id: "breathing", labels: { de: "Atemtechniken", en: "Breathing Techniques", es: "Tecnicas de Respiracion" } },
      { id: "mindfulness", labels: { de: "Achtsamkeit", en: "Mindfulness", es: "Mindfulness" } },
      { id: "sleep", labels: { de: "Schlaf & Entspannung", en: "Sleep & Relaxation", es: "Sueno & Relajacion" } },
      { id: "stress", labels: { de: "Stress & Angst", en: "Stress & Anxiety", es: "Estres & Ansiedad" } },
    ],
    keywords: {},
    connector: { type: "git" },
    pipeline: { defaultModel: "sonnet" },
    publishFrequency: { articlesPerWeek: 3, preferredDays: [1, 3, 5] },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-02-07T00:00:00Z",
  },
  {
    id: "proj_finhub",
    customerId: "default",
    name: "FinHub",
    slug: "finhub",
    description: "FinHub Finance Blog",
    defaultLanguage: "de",
    languages: [
      { code: "de", name: "Deutsch", enabled: true },
      { code: "en", name: "English", enabled: true },
    ],
    categories: [],
    keywords: {},
    connector: { type: "git" },
    pipeline: { defaultModel: "sonnet" },
    publishFrequency: { articlesPerWeek: 2, preferredDays: [2, 4] },
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-02-07T00:00:00Z",
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
    title: "Box Breathing Technik",
    category: "breathing",
    keywords: { primary: "box breathing", secondary: ["4-4-4-4 atmung", "navy seal atmung"], longTail: ["box breathing anleitung deutsch"] },
    priority: 1,
    status: "approved",
    searchIntent: "how-to",
    competitorInsights: "Top-5 sind aeltere Artikel (2021-2023). Kein deutschsprachiges Ergebnis mit Praxis-Fokus.",
    suggestedAngle: "Praxisorientierte Anleitung mit Navy SEAL Kontext",
    estimatedSections: 5,
    reasoning: "Viele Autocomplete-Vorschlaege, starkes Suchinteresse. Kein bestehender Artikel vorhanden.",
    scheduledDate: "2026-02-10",
    articleId: "art_3",
  },
  {
    id: "topic_2",
    title: "Atemtechniken gegen Angst",
    category: "stress",
    keywords: { primary: "atemtechniken angst", secondary: ["panikattacke atmung", "beruhigende atemubungen"], longTail: ["welche atemtechnik hilft gegen angst"] },
    priority: 1,
    status: "produced",
    searchIntent: "informational",
    competitorInsights: "\"People also ask\" zeigt 6+ Fragen. Bestehende Ergebnisse sind medizinisch, nicht praxisorientiert.",
    suggestedAngle: "Vergleich verschiedener Techniken mit Praxisbezug",
    estimatedSections: 6,
    reasoning: "Starke Suchintention, Top-3 Konkurrenz hat duenne Inhalte.",
    scheduledDate: "2026-02-03",
    articleId: "art_1",
  },
  {
    id: "topic_3",
    title: "Wim Hof Atemtechnik",
    category: "breathing",
    keywords: { primary: "wim hof methode", secondary: ["wim hof atmung", "tummo atmung"], longTail: ["wim hof atemtechnik anleitung"] },
    priority: 2,
    status: "produced",
    searchIntent: "how-to",
    competitorInsights: "wimhofmethod.com dominiert Top-3. Deutsche Ergebnisse ab Position 4, meist Blogs ohne Tiefe.",
    suggestedAngle: "Deutschsprachiger Praxis-Fokus mit wissenschaftlichem Hintergrund",
    estimatedSections: 6,
    reasoning: "Sehr starkes Suchinteresse, aber Konkurrenz durch offizielle Wim Hof Seite. Chance durch deutschsprachigen Praxis-Fokus.",
    scheduledDate: "2026-02-05",
    articleId: "art_2",
  },
  {
    id: "topic_4",
    title: "Meditation fur Anfanger",
    category: "meditation",
    keywords: { primary: "meditation anfanger", secondary: ["meditation lernen", "erste meditation"], longTail: ["wie fange ich mit meditation an"] },
    priority: 2,
    status: "proposed",
    searchIntent: "informational",
    competitorInsights: "Headspace und 7mind in Top-5. Viele Autocomplete-Varianten. Featured Snippet zeigt Schritt-Anleitung.",
    suggestedAngle: "Pillar-Content mit App-Integration",
    estimatedSections: 7,
    reasoning: "Pillar-Content Potenzial. Konkurrenz stark, aber eure Brand Voice differenziert.",
  },
  {
    id: "topic_5",
    title: "Schlafhygiene verbessern",
    category: "sleep",
    keywords: { primary: "schlafhygiene", secondary: ["besser schlafen", "einschlafhilfe"], longTail: ["schlafhygiene tipps abend"] },
    priority: 3,
    status: "proposed",
    searchIntent: "informational",
    competitorInsights: "Nur 2 relevante Ergebnisse auf Seite 1. Rest sind Foren und generische Gesundheitsseiten.",
    suggestedAngle: "Ganzheitlicher Ansatz mit Atem- und Meditationstechniken",
    estimatedSections: 5,
    reasoning: "Wenig starke Konkurrenz, guter Einstieg in Sleep-Kategorie.",
  },
  {
    id: "topic_6",
    title: "Achtsamkeit im Alltag",
    category: "mindfulness",
    keywords: { primary: "achtsamkeit alltag", secondary: ["mindfulness ubungen", "achtsam leben"], longTail: ["achtsamkeit im alltag ueben"] },
    priority: 2,
    status: "proposed",
    searchIntent: "informational",
    competitorInsights: "3 von 5 Top-Ergebnissen von 2022 oder aelter. 7mind und Headspace praesent, aber generisch.",
    suggestedAngle: "Praktische Alltagsuebungen mit App-Begleitung",
    estimatedSections: 5,
    reasoning: "Gutes Suchinteresse, starker App-Bezug moeglich. 3 von 5 Top-Ergebnissen veraltet.",
  },
  {
    id: "topic_7",
    title: "4-7-8 Atemtechnik",
    category: "breathing",
    keywords: { primary: "4 7 8 atmung", secondary: ["einschlaf atemtechnik", "dr weil atmung"], longTail: ["4 7 8 atemtechnik zum einschlafen"] },
    priority: 1,
    status: "approved",
    searchIntent: "how-to",
    competitorInsights: "Featured Snippet zeigt Schritt-Anleitung. Deutsche Ergebnisse duenn, atemkurs.de auf Pos. 3 mit kurzem Artikel.",
    suggestedAngle: "Einschlaf-Fokus mit wissenschaftlicher Untermauerung",
    estimatedSections: 5,
    reasoning: "Top-Keyword im Sleep+Breathing Overlap. Wenig starke Konkurrenz im deutschsprachigen Raum.",
    scheduledDate: "2026-02-12",
    articleId: "art_4",
  },
  {
    id: "topic_8",
    title: "Stressabbau Techniken",
    category: "stress",
    keywords: { primary: "stress abbauen", secondary: ["stressabbau methoden", "entspannungstechniken"], longTail: ["schnell stress abbauen techniken"] },
    priority: 2,
    status: "in_production",
    searchIntent: "informational",
    competitorInsights: "gesundheit.de und aok.de dominieren. Aber generische Listen-Artikel, keine spezifischen Atemtechnik-Inhalte.",
    suggestedAngle: "Breites Thema mit Atemtechnik-Fokus fuer Topic Cluster",
    estimatedSections: 7,
    reasoning: "Breites Thema, aber gut fuer Topic Cluster Aufbau in Stress-Kategorie.",
    scheduledDate: "2026-02-14",
    articleId: "art_5",
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
    customerId: "default",
    projectId: "proj_breathe",
    topicId: "topic_8",
    type: "production",
    status: "running",
    totalCostUsd: 0.12,
    totalTokens: { input: 45000, output: 8000 },
    createdAt: "2026-02-07T09:15:00Z",
    startedAt: "2026-02-07T09:15:00Z",
    phases: [
      {
        name: "outline",
        status: "completed",
        startedAt: "2026-02-07T09:15:00Z",
        completedAt: "2026-02-07T09:16:30Z",
        agentCalls: [
          {
            agent: "outline-architect",
            model: "sonnet",
            status: "completed",
            costUsd: 0.02,
            tokens: { input: 8000, output: 1500 },
            durationMs: 90000,
            events: [
              { type: "tool_call", timestamp: "2026-02-07T09:15:10Z", tool: "Read", input: "posts/de/" },
              { type: "tool_call", timestamp: "2026-02-07T09:15:30Z", tool: "WebSearch", input: "stressabbau techniken 2026" },
              { type: "tool_call", timestamp: "2026-02-07T09:16:20Z", tool: "Write", input: "outline.json" },
            ],
          },
        ],
      },
      {
        name: "writing",
        status: "completed",
        startedAt: "2026-02-07T09:16:30Z",
        completedAt: "2026-02-07T09:22:00Z",
        agentCalls: [
          { agent: "section-writer", model: "sonnet", status: "completed", costUsd: 0.02, tokens: { input: 6000, output: 1000 }, durationMs: 60000 },
          { agent: "section-writer", model: "sonnet", status: "completed", costUsd: 0.02, tokens: { input: 6000, output: 1200 }, durationMs: 65000 },
          { agent: "section-writer", model: "sonnet", status: "completed", costUsd: 0.02, tokens: { input: 6000, output: 1500 }, durationMs: 70000 },
        ],
      },
      {
        name: "assembly",
        status: "completed",
        startedAt: "2026-02-07T09:22:00Z",
        completedAt: "2026-02-07T09:23:30Z",
        agentCalls: [
          {
            agent: "content-editor",
            model: "sonnet",
            status: "completed",
            costUsd: 0.02,
            tokens: { input: 12000, output: 2000 },
            durationMs: 90000,
          },
        ],
      },
      {
        name: "image",
        status: "running",
        startedAt: "2026-02-07T09:23:30Z",
        agentCalls: [
          {
            agent: "image-generator",
            model: "sonnet",
            status: "running",
            costUsd: 0.01,
            tokens: { input: 2000, output: 500 },
            durationMs: 0,
            events: [
              { type: "tool_call", timestamp: "2026-02-07T09:23:40Z", tool: "Bash", input: "imagen4 API call" },
            ],
          },
        ],
      },
      { name: "quality", status: "pending", agentCalls: [] },
      { name: "translation", status: "pending", agentCalls: [] },
    ],
  },
  {
    id: "run_2",
    customerId: "default",
    projectId: "proj_breathe",
    topicId: "topic_7",
    type: "production",
    status: "completed",
    totalCostUsd: 0.18,
    totalTokens: { input: 60000, output: 12000 },
    createdAt: "2026-02-06T14:00:00Z",
    startedAt: "2026-02-06T14:00:00Z",
    completedAt: "2026-02-06T14:12:00Z",
    phases: [
      { name: "outline", status: "completed", startedAt: "2026-02-06T14:00:00Z", completedAt: "2026-02-06T14:01:30Z", agentCalls: [] },
      { name: "writing", status: "completed", startedAt: "2026-02-06T14:01:30Z", completedAt: "2026-02-06T14:06:00Z", agentCalls: [] },
      { name: "assembly", status: "completed", startedAt: "2026-02-06T14:06:00Z", completedAt: "2026-02-06T14:07:00Z", agentCalls: [] },
      { name: "image", status: "completed", startedAt: "2026-02-06T14:07:00Z", completedAt: "2026-02-06T14:08:30Z", agentCalls: [] },
      { name: "quality", status: "completed", startedAt: "2026-02-06T14:08:30Z", completedAt: "2026-02-06T14:10:00Z", agentCalls: [] },
      { name: "translation", status: "completed", startedAt: "2026-02-06T14:10:00Z", completedAt: "2026-02-06T14:12:00Z", agentCalls: [] },
    ],
  },
];

// ── Briefs ─────────────────────────────────────────────────────

export const briefs: Brief[] = [
  {
    id: "brief_1",
    projectId: "proj_breathe",
    topicId: "topic_1",
    topicTitle: "Box Breathing Technik",
    status: "ready",
    createdAt: "2026-02-07T10:00:00Z",
    targetKeyword: "box breathing",
    secondaryKeywords: ["4-4-4-4 atmung", "navy seal atemtechnik", "quadrat atmung"],
    wordCountTarget: { min: 1400, max: 1800 },
    contentType: "blog",
    serpIntent: "informational",
    featuredSnippetTarget: true,
    suggestedStructure: [
      { heading: "Was ist Box Breathing?", level: "h2" },
      { heading: "Schritt-fur-Schritt Anleitung", level: "h2" },
      { heading: "Wissenschaftliche Wirkung", level: "h2" },
      { heading: "Variationen fur Fortgeschrittene", level: "h2" },
      { heading: "Box Breathing im Alltag", level: "h2" },
    ],
    questionsToAnswer: [
      "Wie oft sollte ich Box Breathing machen?",
      "Kann Box Breathing bei Panikattacken helfen?",
      "Ist Box Breathing fur Anfanger geeignet?",
    ],
    internalLinks: [
      { url: "/de/blog/4-7-8-atemtechnik", anchor: "4-7-8 Atemtechnik" },
      { url: "/de/blog/atemtechniken-gegen-angst", anchor: "Atemtechniken gegen Angst" },
    ],
    competitors: [
      { domain: "atemkurs.de", position: 3, wordCount: 1200, score: 67 },
      { domain: "yogaeasy.de", position: 5, wordCount: 800, score: 54 },
    ],
  },
  {
    id: "brief_2",
    projectId: "proj_breathe",
    topicId: "topic_7",
    topicTitle: "4-7-8 Atemtechnik",
    status: "completed",
    createdAt: "2026-02-05T08:00:00Z",
    targetKeyword: "4-7-8 atemtechnik",
    secondaryKeywords: ["einschlaf atemtechnik", "dr weil atmung"],
    wordCountTarget: { min: 1200, max: 1600 },
    contentType: "blog",
    serpIntent: "informational",
    featuredSnippetTarget: true,
    suggestedStructure: [
      { heading: "Was ist die 4-7-8 Atemtechnik?", level: "h2" },
      { heading: "So funktioniert die 4-7-8 Methode", level: "h2" },
      { heading: "Wirkung auf Schlaf und Stress", level: "h2" },
      { heading: "Haufige Fehler vermeiden", level: "h2" },
    ],
    questionsToAnswer: [
      "Wie schnell wirkt die 4-7-8 Atmung?",
      "Kann man 4-7-8 im Liegen machen?",
    ],
    internalLinks: [
      { url: "/de/blog/box-breathing-technik", anchor: "Box Breathing" },
    ],
    competitors: [
      { domain: "atemkurs.de", position: 3, wordCount: 950, score: 61 },
      { domain: "gesundheit.de", position: 7, wordCount: 600, score: 45 },
    ],
  },
  {
    id: "brief_3",
    projectId: "proj_breathe",
    topicId: "topic_8",
    topicTitle: "Stressabbau Techniken",
    status: "in_production",
    createdAt: "2026-02-06T12:00:00Z",
    targetKeyword: "stressabbau techniken",
    secondaryKeywords: ["stress abbauen", "entspannungstechniken", "stressabbau methoden"],
    wordCountTarget: { min: 1600, max: 2000 },
    contentType: "blog",
    serpIntent: "informational",
    featuredSnippetTarget: false,
    suggestedStructure: [
      { heading: "Warum Stressabbau wichtig ist", level: "h2" },
      { heading: "10 Techniken im Uberblick", level: "h2" },
      { heading: "Atemtechniken gegen Stress", level: "h2" },
      { heading: "Bewegung und Korper", level: "h2" },
      { heading: "Mentale Strategien", level: "h2" },
      { heading: "Stressabbau in 5 Minuten", level: "h2" },
    ],
    questionsToAnswer: [
      "Was hilft schnell gegen Stress?",
      "Welche Stressabbau-Methode ist die beste?",
    ],
    internalLinks: [
      { url: "/de/blog/box-breathing-technik", anchor: "Box Breathing" },
      { url: "/de/blog/atemtechniken-gegen-angst", anchor: "Atemtechniken gegen Angst" },
    ],
    competitors: [
      { domain: "gesundheit.de", position: 1, wordCount: 2200, score: 78 },
      { domain: "aok.de", position: 3, wordCount: 1800, score: 72 },
    ],
  },
  {
    id: "brief_4",
    projectId: "proj_breathe",
    topicId: "topic_4",
    topicTitle: "Meditation fur Anfanger",
    status: "draft",
    createdAt: "2026-02-07T14:00:00Z",
    targetKeyword: "meditation anfanger",
    secondaryKeywords: ["meditation lernen", "erste meditation", "meditation fur einsteiger"],
    wordCountTarget: { min: 2000, max: 2500 },
    contentType: "guide",
    serpIntent: "informational",
    featuredSnippetTarget: true,
    suggestedStructure: [
      { heading: "Was ist Meditation?", level: "h2" },
      { heading: "Deine erste Meditation: 5-Minuten Anleitung", level: "h2" },
      { heading: "Meditationsarten im Uberblick", level: "h2" },
      { heading: "Typische Anfanger-Fehler", level: "h2" },
      { heading: "Meditation zur Gewohnheit machen", level: "h2" },
      { heading: "Tools und Apps", level: "h2" },
    ],
    questionsToAnswer: [
      "Wie fange ich mit Meditation an?",
      "Wie lange sollte man als Anfanger meditieren?",
      "Was bringt tagliche Meditation?",
    ],
    internalLinks: [],
    competitors: [
      { domain: "headspace.com", position: 2, wordCount: 3000, score: 82 },
      { domain: "7mind.de", position: 4, wordCount: 1800, score: 68 },
    ],
  },
];


// ── Dashboard Actions ──────────────────────────────────────────

export const dashboardActions: DashboardAction[] = [
  { type: "opportunity", message: "3 new topic opportunities", count: 3, link: "/research" },
  { type: "review", message: "2 articles need review", count: 2, link: "/create" },
  { type: "completed", message: "\"Stressabbau Techniken\" production complete", link: "/create/art_5" },
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
