# SEO & AI Search Optimierung

## Blog-Artikel Struktur

### Pflicht-Elemente (jeder Artikel)

```
┌─────────────────────────────────────────────────────────┐
│ [Kategorie-Badge]                                       │
│                                                         │
│ # Headline (H1) - max. 60 Zeichen                      │
│                                                         │
│ > **Kurz & Knapp:** Answer Capsule - 2-3 Sätze die    │
│ > die Kernfrage direkt beantworten.                    │
│                                                         │
│ Autor · X min · Datum · Aktualisiert: Datum            │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ ## Inhaltsverzeichnis (bei >1500 Wörtern)              │
│                                                         │
│ ## H2 Hauptabschnitt 1                                  │
│    Content mit internen Links zu anderen Posts...       │
│                                                         │
│ ## H2 Hauptabschnitt 2                                  │
│ ### H3 Unterabschnitt (falls nötig)                    │
│                                                         │
│ ## Häufige Fragen                                       │
│ - Frage 1 + Antwort (für FAQPage Schema)               │
│ - Frage 2 + Antwort                                     │
│                                                         │
│ ## Fazit / Key Takeaways                               │
│ - Kernaussage 1                                         │
│ - Kernaussage 2                                         │
│ - Kernaussage 3                                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Author Box mit Bio                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Verwandte Artikel                                       │
└─────────────────────────────────────────────────────────┘
```

### Optionale Elemente (je nach Artikel-Typ)

| Element           | Wann verwenden          |
| ----------------- | ----------------------- |
| Hero Image        | Bei visuellen Themen    |
| Video Embed       | Bei Anleitungen         |
| Infografik        | Bei komplexen Konzepten |
| Vergleichstabelle | Bei "X vs Y" Artikeln   |
| Checkliste        | Bei How-To Guides       |
| Download-Box      | Bei Lead Generation     |

---

## Content-Typen

### 1. Standard Blog Post

- **Länge:** 1.000-1.500 Wörter
- **Struktur:** Answer Capsule → Hauptteil → FAQ → Fazit
- **Schema:** BlogPosting + FAQPage

### 2. How-To Guide

- **Länge:** 1.500-2.500 Wörter
- **Struktur:** Einleitung → Nummerierte Schritte → Troubleshooting → FAQ
- **Schema:** BlogPosting + HowTo + FAQPage
- **Beispiel:** "Wie du in 7 Schritten meditieren lernst"

### 3. Listicle

- **Länge:** 1.000-1.800 Wörter
- **Struktur:** Einleitung → Nummerierte H2s → Fazit
- **Schema:** BlogPosting
- **Beispiel:** "10 Atemübungen für Anfänger"

### 4. Vergleich (X vs Y)

- **Länge:** 1.000-1.800 Wörter
- **Struktur:** Quick Verdict → Feature-Vergleich → Empfehlung
- **Schema:** BlogPosting
- **Beispiel:** "Geführte vs. Stille Meditation"

### 5. Pillar Page (Guide)

- **Länge:** 2.500-4.000+ Wörter
- **Struktur:** Umfassender Guide mit vielen H2/H3
- **Schema:** BlogPosting

---

## AI Search Optimierung (GEO)

### Answer Capsule Technik

Jeder Artikel beginnt mit einem Blockquote, der die Kernfrage in 2-3 Sätzen beantwortet:

```markdown
> **Kurz & Knapp:** Box Breathing ist eine 4-Schritt-Atemtechnik:
> 4 Sekunden einatmen, 4 Sekunden halten, 4 Sekunden ausatmen,
> 4 Sekunden halten. Die Methode reduziert Stress nachweislich
> innerhalb von 2-3 Minuten.
```

**Warum wichtig:** AI-Assistenten (ChatGPT, Perplexity, Claude) extrahieren bevorzugt kurze, direkte Antworten am Anfang eines Artikels.

### FAQ für AI-Zitierung

- Seiten mit FAQPage Schema haben **3.2x höhere Chance** in AI-Antworten zitiert zu werden
- Jeder Artikel sollte 3-5 FAQ-Einträge haben
- Fragen so formulieren wie Nutzer sie stellen würden

### llms.txt Datei

Erstellen unter `public/llms.txt` mit Übersicht der Website, wichtigsten Inhalten, Kategorien und Kontakt.

### robots.txt für AI-Crawler

AI-Crawler explizit erlauben:

```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /
```

### Schema.org Structured Data

| Schema             | Wo                         |
| ------------------ | -------------------------- |
| **BlogPosting**    | Blog Posts                 |
| **FAQPage**        | FAQ Komponente             |
| **BreadcrumbList** | Breadcrumbs Komponente     |
| **Organization**   | Im BlogPosting (publisher) |
| **Person**         | Im BlogPosting (author)    |
| **HowTo**          | Für Schritt-für-Schritt    |

---

## Heading-Struktur

### Regeln

1. **Ein H1 pro Seite** - Der Artikel-Titel
2. **H2 für Hauptabschnitte** - Alle 200-300 Wörter
3. **H3 nur innerhalb von H2** - Für Unterabschnitte
4. **Keine Ebenen überspringen** - H1 → H2 → H3 (nicht H1 → H3)
5. **Beschreibende Überschriften** - Keine generischen "Einleitung" oder "Mehr dazu"
6. **Keywords natürlich einbauen** - Aber nicht erzwingen

### Beispiel

```
H1: 5-Minuten-Meditation: Sofortige Ruhe im Alltag
  H2: Warum 5 Minuten reichen
  H2: Die Anleitung
    H3: Minute 1: Ankommen
    H3: Minute 2-3: Atem beobachten
    H3: Minute 4: Body Scan
    H3: Minute 5: Abschluss
  H2: Wann du diese Meditation nutzen kannst
    H3: Vor wichtigen Terminen
    H3: In der Mittagspause
  H2: Häufige Fragen
  H2: Fazit
```

---

## Interne Verlinkung

### Strategie

1. **Pillar → Cluster**: Jede Pillar Page verlinkt zu allen zugehörigen Blog Posts
2. **Cluster → Pillar**: Jeder Blog Post verlinkt zurück zur Pillar Page
3. **Cluster ↔ Cluster**: Verwandte Posts verlinken zueinander
4. **2-3 interne Links pro Artikel** minimum
5. **Beschreibende Anchor-Texte** - Nicht "hier klicken"

### Topic Cluster Struktur

```
         [Pillar: Meditation für Anfänger]
                    /    |    \
                   /     |     \
[5-Minuten-     [Morgen-    [Geh-
 Meditation]    meditation]  meditation]
       \           |          /
        \          |         /
         (untereinander verlinkt)
```

---

## Checkliste vor Veröffentlichung

### Content

- [ ] Answer Capsule am Anfang (Blockquote)
- [ ] H2-Struktur logisch und beschreibend
- [ ] 2-3 interne Links zu anderen Artikeln
- [ ] FAQ-Sektion mit 3-5 Fragen
- [ ] Fazit mit Key Takeaways

### SEO

- [ ] Titel unter 60 Zeichen
- [ ] Description 100-160 Zeichen
- [ ] Kategorie zugewiesen
- [ ] Keywords ausgefüllt (5-10)
- [ ] Pillar verlinkt (falls passend)

### Technisch

- [ ] Autor zugewiesen
- [ ] Sprache korrekt
- [ ] Übersetzungen verknüpft (falls vorhanden)
- [ ] Bilder mit Alt-Text (falls vorhanden)
