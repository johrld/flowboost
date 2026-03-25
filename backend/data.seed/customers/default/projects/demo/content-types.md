# Content-Typen

## Übersicht

| Typ          | Länge              | Zweck                            | Speicherort                   |
| ------------ | ------------------ | -------------------------------- | ----------------------------- |
| Blog Post    | 1.200-2.000 Wörter | Ein spezifisches Thema behandeln | `src/content/posts/[lang]/`   |
| Pillar Page  | 2.500-4.000 Wörter | Umfassender Guide zu Hauptthema  | `src/content/pillars/[lang]/` |
| Landing Page | 500-1.000 Wörter   | Conversion (App-Download)        | `src/content/landings/`       |

---

## 1. Blog Post

### Zweck

- Spezifisches Thema oder Frage beantworten
- Long-Tail-Keywords abdecken
- Traffic über Suche generieren
- Auf Pillar Page verlinken (Topic Cluster)

### Spezifikationen

| Eigenschaft      | Wert               |
| ---------------- | ------------------ |
| Länge            | 1.200-2.000 Wörter |
| Titel            | 50-70 Zeichen      |
| Meta Description | 100-160 Zeichen    |
| H2 Überschriften | 3-5 Stück          |
| FAQs             | 3-5 Fragen         |
| Interne Links    | Mind. 2            |
| Lesezeit         | 4-7 Minuten        |

### Struktur

```markdown
# Titel (H1)

> **Answer Capsule**: Zusammenfassung in 2-3 Sätzen.
> Direkte Antwort auf die Suchintention.

## Einleitung

- Problem/Frage aufgreifen
- Relevanz zeigen
- Überblick geben

## Hauptteil (mehrere H2)

- Kerninhalt
- Praktische Anleitungen
- Beispiele

## Anwendung/Umsetzung

- Konkrete Tipps
- Schritt-für-Schritt
- Häufige Fehler

## Fazit

- Zusammenfassung
- Nächster Schritt
- CTA zur App

<!-- ENDE - Keine FAQ-Sektion im Content! -->
```

**⚠️ FAQ-Regel:**

- FAQs werden NUR im Frontmatter definiert
- KEINE "## Häufige Fragen" im Content schreiben
- Das Astro-Template rendert FAQs automatisch als Accordion

### Schema Markup

- BlogPosting (automatisch aus Frontmatter)
- FAQPage (automatisch aus `faq` Frontmatter-Feld)
- Person (Autor aus `authors.json`)

---

## 2. Pillar Page (Guide)

### Zweck

- Hauptthema umfassend behandeln
- Hub für Cluster-Artikel
- Authority aufbauen
- Featured Snippets gewinnen

### Spezifikationen

| Eigenschaft        | Wert               |
| ------------------ | ------------------ |
| Länge              | 2.500-4.000 Wörter |
| Titel              | 50-70 Zeichen      |
| Meta Description   | 100-160 Zeichen    |
| H2 Überschriften   | 6-10 Stück         |
| H3 Unterabschnitte | Nach Bedarf        |
| Cluster-Links      | 5-10 Blog Posts    |
| Interne Links      | Mind. 10           |
| Lesezeit           | 12-20 Minuten      |

### Struktur

```markdown
# Umfassender Guide: [Thema] (H1)

> **Answer Capsule**: Was der Leser lernen wird.
> Kompakte Zusammenfassung des gesamten Guides.

## Inhaltsverzeichnis

- Automatisch generiert aus H2s

## Was ist [Thema]?

- Definition
- Hintergrund
- Warum wichtig

## Wissenschaftlicher Hintergrund

- Studien
- Forschung
- Evidenz

## [Hauptkapitel 1]

### Unterkapitel 1.1

### Unterkapitel 1.2

## [Hauptkapitel 2]

...

## Praktische Anleitung

- Schritt-für-Schritt
- Variationen
- Tipps für Anfänger

## Häufige Fehler

- Was vermeiden
- Wie korrigieren

## Weiterführende Ressourcen

- Links zu Cluster-Posts
- App-Features
- Buchempfehlungen

## Fazit

- Zusammenfassung
- Ermutigung
- CTA
```

### Topic Cluster

Pillar Page ist das Zentrum eines Topic Clusters:

```
                    ┌─────────────────┐
                    │   Pillar Page   │
                    │ "Meditation     │
                    │  für Anfänger"  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Blog Post 1  │  │  Blog Post 2  │  │  Blog Post 3  │
│ "5-Minuten-   │  │ "Morgen-      │  │ "Meditation   │
│  Meditation"  │  │  meditation"  │  │  gegen Stress"│
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## 3. Landing Page

### Zweck

- Conversion optimiert
- App-Download fördern
- Spezifische Zielgruppe ansprechen
- Paid Traffic auffangen

### Spezifikationen

| Eigenschaft      | Wert                      |
| ---------------- | ------------------------- |
| Länge            | 500-1.000 Wörter          |
| Titel            | 50-70 Zeichen             |
| Meta Description | 100-160 Zeichen           |
| CTAs             | 3-5 Stück                 |
| Social Proof     | Testimonials, Bewertungen |
| Bilder           | App-Screenshots, Mockups  |

### Struktur

```markdown
# Headline (Benefit-orientiert)

## Hero Section

- Hauptversprechen
- CTA Button
- App-Mockup

## Problem/Lösung

- Schmerzpunkte der Zielgruppe
- Wie dein Produkt hilft

## Features

- 3-5 Kernfunktionen
- Mit Icons/Screenshots

## Social Proof

- Bewertungen
- Testimonials
- Download-Zahlen

## Preise/Verfügbarkeit

- Kostenlos-Features
- Premium-Vorteile
- App Store Links

## FAQ

- Kurze, conversion-relevante Fragen

## Final CTA

- Starkes Schlussargument
- Download-Buttons
```

---

## Frontmatter-Referenz

### Blog Post

```yaml
---
title: "Titel des Posts"
description: "Meta-Beschreibung für Suchmaschinen"
pubDate: 2024-01-20
author: alex
category: meditation
tags:
  - anfänger
  - kurzmeditation
keywords:
  - hauptkeyword
  - nebenkeyword
pillar: meditation-anfaenger # Optional: Link zu Pillar
lang: de
translationKey: unique-key
translations:
  en: "english-slug"
  es: "spanish-slug"
heroImage: "@assets/posts/de/image.jpg"
heroAlt: "Bildbeschreibung"
faq:
  - question: "Frage 1?"
    answer: "Antwort 1."
draft: false
---
```

### Pillar Page

```yaml
---
title: "Guide-Titel"
description: "Umfassende Meta-Beschreibung"
pubDate: 2024-01-20
updatedDate: 2024-02-15 # Pillar Pages werden aktualisiert
author: alex
category: meditation
lang: de
translationKey: pillar-key
clusterPosts: # Verlinkte Blog Posts
  - 5-minuten-meditation
  - morgenmeditation
  - meditation-gegen-stress
heroImage: "@assets/pillars/de/image.jpg"
heroAlt: "Bildbeschreibung"
draft: false
---
```

### Landing Page

```yaml
---
title: "Landing Page Titel"
description: "Conversion-optimierte Beschreibung"
target: schlafprobleme # Zielgruppe
cta:
  primary: "Jetzt kostenlos starten"
  url: "https://example.com/app"
heroImage: "@assets/landings/hero.jpg"
testimonials:
  - name: "Max M."
    text: "Endlich kann ich wieder schlafen."
    rating: 5
lang: de
draft: false
---
```
