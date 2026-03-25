# SEO Guidelines

## Technische SEO-Anforderungen

Diese Checkliste wird vom SEO Checker Agent automatisch geprüft.

### Pflicht-Checks (Score-relevant)

| Check                | Kriterium              | Punkte |
| -------------------- | ---------------------- | ------ |
| Title Length         | 50-70 Zeichen          | 10     |
| Meta Description     | 100-160 Zeichen        | 10     |
| H1 vorhanden         | Genau 1x H1            | 10     |
| H1 enthält Keyword   | Haupt-Keyword im Titel | 10     |
| Answer Capsule       | Blockquote nach H1     | 10     |
| H2 Anzahl            | 3-5 Überschriften      | 10     |
| FAQ vorhanden        | Mind. 3 FAQs           | 10     |
| Interne Links        | Mind. 2 Links          | 10     |
| Wortanzahl           | 1.200-2.000 Wörter     | 10     |
| Frontmatter komplett | Alle Pflichtfelder     | 10     |

**Minimum Score für Veröffentlichung: 80/100**

### Frontmatter Pflichtfelder

```yaml
title: string # 50-70 Zeichen
description: string # 100-160 Zeichen
pubDate: date
author: string # Muss in authors.json existieren
category: string # Muss in categories.json existieren
keywords: array # Mind. 1 Keyword
lang: string # de, en, oder es
translationKey: string
```

### Warnungen (nicht Score-relevant)

- Title > 60 Zeichen (Google schneidet ab)
- Description < 120 Zeichen (nicht optimal)
- Keine externen Links
- Bild ohne Alt-Text
- H3 ohne vorherige H2

---

## Keyword-Strategie

### Keyword-Typen

| Typ       | Suchvolumen | Konkurrenz | Beispiel                              |
| --------- | ----------- | ---------- | ------------------------------------- |
| Primary   | Hoch        | Hoch       | "meditation lernen"                   |
| Secondary | Mittel      | Mittel     | "wie meditieren anfänger"             |
| Long-tail | Niedrig     | Niedrig    | "5 minuten meditation morgens stress" |

### Keyword-Platzierung

| Position         | Wichtigkeit | Hinweis                 |
| ---------------- | ----------- | ----------------------- |
| Title (H1)       | Kritisch    | Haupt-Keyword am Anfang |
| Meta Description | Hoch        | Haupt-Keyword + CTA     |
| Erste 100 Wörter | Hoch        | Natürlich integrieren   |
| H2 Überschriften | Mittel      | Sekundär-Keywords       |
| URL/Slug         | Mittel      | Kurz, keyword-reich     |
| Alt-Text         | Niedrig     | Wenn passend            |

### Keyword-Dichte

- **Haupt-Keyword**: 1-2% (8-15x bei 1.000 Wörtern)
- **Sekundär-Keywords**: 0,5-1% (5-10x)
- **Vermeiden**: Keyword Stuffing (>3%)

---

## Content-Optimierung

### Answer Capsule für Featured Snippets

Die Answer Capsule ist optimiert für Google's Featured Snippets:

```markdown
> **Kurze Antwort**: [Direkte Antwort, 40-60 Wörter]
> [Kernfakten oder nächster Schritt]
```

**Warum funktioniert das?**

- Google extrahiert prägnante Antworten
- Blockquote-Format signalisiert Zusammenfassung
- Position direkt nach H1 = höchste Relevanz

### FAQ für Rich Snippets

FAQs generieren FAQ-Rich-Results in Google:

```yaml
faq:
  - question: "Wie lange sollte ich meditieren?"
    answer: "Schon 5 Minuten täglich zeigen messbare Effekte. Studien empfehlen 10-20 Minuten für optimale Ergebnisse."
```

**Regeln:**

- Mind. 3 FAQs pro Artikel
- Fragen wie echte User sie stellen
- Antworten: 40-60 Wörter
- Keyword in mind. 1 Frage

### Interne Verlinkung

**Topic Cluster Modell:**

```
Pillar Page (Authority)
    │
    ├── Blog Post 1 (Detail)
    ├── Blog Post 2 (Detail)
    └── Blog Post 3 (Detail)
```

**Regeln:**

- Jeder Blog Post verlinkt zur Pillar Page
- Pillar Page verlinkt zu allen Cluster-Posts
- Blog Posts verlinken untereinander (wenn thematisch passend)
- Beschreibende Anchor-Texte verwenden

---

## URL-Struktur

### Format

```
/[lang]/blog/[slug]
/de/blog/5-minuten-meditation
/en/blog/5-minute-meditation
```

### Slug-Regeln

| Regel             | Beispiel                                               |
| ----------------- | ------------------------------------------------------ |
| Kleinbuchstaben   | `meditation-anfaenger`                                 |
| Bindestriche      | `box-breathing-anleitung`                              |
| Keine Umlaute     | `atem-ubungen` (nicht ü)                               |
| Keine Stop-Wörter | `meditation-lernen` (nicht "wie-man-meditation-lernt") |
| Max. 60 Zeichen   | Kürzen wenn nötig                                      |
| Keyword enthalten | Haupt-Keyword im Slug                                  |

---

## Meta-Tags

### Title Tag

```
[Haupt-Keyword]: [Benefit/Zusatz] | Brand
```

**Beispiele:**

- ✅ "5-Minuten-Meditation: Sofortige Ruhe für Einsteiger | Brand"
- ✅ "Box Breathing Anleitung: 4-4-4-4 Technik erklärt | Brand"
- ❌ "Brand - Der ultimative Guide zu allem über Meditation"

**Regeln:**

- 50-70 Zeichen (inkl. Brand)
- Keyword am Anfang
- Brand am Ende (optional bei langen Titeln)
- Keine Keyword-Wiederholung

### Meta Description

```
[Zusammenfassung]. [Benefit]. [CTA]
```

**Beispiele:**

- ✅ "Lerne in 5 Minuten zu meditieren. Einfache Anleitung für Einsteiger mit sofortiger Wirkung. Jetzt kostenlos starten."
- ❌ "In diesem Artikel erklären wir dir alles über Meditation. Klicke hier für mehr."

**Regeln:**

- 100-160 Zeichen
- Aktive Sprache
- Haupt-Keyword enthalten
- Call-to-Action am Ende
- Keine Anführungszeichen

---

## Schema Markup

### BlogPosting (automatisch)

```json
{
  "@type": "BlogPosting",
  "headline": "Titel",
  "description": "Meta Description",
  "author": { "@type": "Person", "name": "Autor" },
  "datePublished": "2024-01-20",
  "image": "URL zum Hero Image"
}
```

### FAQPage (bei FAQs)

```json
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Frage?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Antwort."
      }
    }
  ]
}
```

---

## Mehrsprachigkeit (hreflang)

### Automatische Generierung

Basierend auf `translationKey` und `translations` Frontmatter:

```html
<link rel="alternate" hreflang="de" href="/de/blog/5-minuten-meditation" />
<link rel="alternate" hreflang="en" href="/en/blog/5-minute-meditation" />
<link rel="alternate" hreflang="es" href="/es/blog/meditacion-5-minutos" />
<link
  rel="alternate"
  hreflang="x-default"
  href="/de/blog/5-minuten-meditation"
/>
```

### Pflicht bei Übersetzungen

- Alle Sprachversionen müssen `translationKey` teilen
- `translations` Feld muss Slugs aller Versionen enthalten
- Fehlende Übersetzung = kein hreflang für diese Sprache

---

## Performance

### Core Web Vitals Ziele

| Metrik | Ziel    | Einfluss             |
| ------ | ------- | -------------------- |
| LCP    | < 2,5s  | Bilder optimieren    |
| FID    | < 100ms | JS minimieren        |
| CLS    | < 0,1   | Layout stabil halten |

### Bilder

- Format: WebP (mit JPG Fallback)
- Lazy Loading für Below-the-fold
- Explicit width/height Attribute
- Responsive srcset

---

## Checkliste für SEO Checker

Der SEO Checker Agent prüft diese Punkte automatisch:

### Kritisch (Fehler)

- [ ] Title vorhanden und 50-70 Zeichen
- [ ] Description vorhanden und 100-160 Zeichen
- [ ] Genau 1x H1
- [ ] H1 enthält mind. 1 Keyword aus `keywords` Array
- [ ] Answer Capsule (Blockquote) nach H1
- [ ] Mind. 3 H2 Überschriften
- [ ] Mind. 3 FAQs im Frontmatter
- [ ] Mind. 2 interne Links im Content
- [ ] 1.200-2.000 Wörter
- [ ] Alle Frontmatter-Pflichtfelder vorhanden

### Warnungen

- [ ] Title > 60 Zeichen
- [ ] Description < 120 Zeichen
- [ ] Keyword nicht in erster H2
- [ ] Keine Bilder im Content
- [ ] Bilder ohne Alt-Text
- [ ] Mehr als 5 H2 (evtl. aufteilen)

### Output-Format

```json
{
  "score": 85,
  "passed": ["title_length", "description", "h1_present"],
  "failed": ["faq_count", "internal_links"],
  "warnings": ["title_long", "no_images"],
  "suggestions": [
    "Füge 1 weitere FAQ hinzu (aktuell: 2, benötigt: 3)",
    "Füge 1 weiteren internen Link hinzu (aktuell: 1, benötigt: 2)"
  ]
}
```
