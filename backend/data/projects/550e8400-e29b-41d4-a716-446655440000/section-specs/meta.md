# Section Spec: Meta (Frontmatter)

## Ziel

Erstelle das vollständige YAML-Frontmatter für den Blog-Artikel. Die FAQ-Items werden separat erstellt und beim Assembly eingefügt.

## Format

```yaml
title: "Box Breathing: Die 4-4-4-4 Atemtechnik für sofortige Ruhe"
description: "Lerne Box Breathing in 5 Minuten. Schritt-für-Schritt Anleitung der Navy SEAL Atemtechnik gegen Stress und für bessere Konzentration."
pubDate: 2025-02-06
author: breathe-team
category: breathing
tags:
  - atemtechnik
  - stress
  - anfänger
keywords:
  - box breathing
  - 4-4-4-4 atmung
  - box breathing anleitung
pillar: atemubungen-anfaenger
lang: de
translationKey: box-breathing-guide
translations:
  en: "box-breathing-guide"
  es: "guia-respiracion-cuadrada"
draft: false
```

## Anforderungen

| Feld | Regel |
|------|-------|
| `title` | 50-70 Zeichen, Primary Keyword am Anfang, mit Benefit nach Doppelpunkt |
| `description` | 100-160 Zeichen, Primary Keyword + Benefit + CTA-Element |
| `pubDate` | Aktuelles Datum via `node scripts/current-date.js` |
| `author` | ID aus `src/data/authors.json` (Standard: `breathe-team`) |
| `category` | ID aus `src/data/categories.json` |
| `tags` | 2-4 Tags, lowercase, thematisch passend |
| `keywords` | 3-6 Keywords aus Outline `frontmatter.keywords` |
| `pillar` | Optional, Slug des zugehörigen Guides |
| `lang` | Immer `de` (Primärsprache) |
| `translationKey` | Englischer Slug (verbindet Übersetzungen) |
| `translations` | Map: `en: "slug"`, `es: "slug"` |
| `draft` | `false` (es sei denn explizit anders) |

## Title-Format

```
[Primary Keyword]: [Benefit/Versprechen]
```

Beispiele:
- "5-Minuten-Meditation: Sofortige Ruhe im Alltag"
- "Box Breathing: Die 4-4-4-4 Atemtechnik für sofortige Ruhe"
- "Meditation bei Angst: So findest du innere Ruhe"

## Description-Format

```
[Zusammenfassung]. [Benefit]. [CTA-Element].
```

Beispiele:
- "Lerne Box Breathing in 5 Minuten. Schritt-für-Schritt Anleitung gegen Stress. Wissenschaftlich fundiert."
- "Einfache Meditation für Anfänger. Reduziere Stress in nur 5 Minuten täglich. Jetzt starten."

## Translation Slugs

Generiere sinnvolle Slugs für EN und ES:
- **EN:** Englische Version des Hauptthemas (z.B. `box-breathing-guide`)
- **ES:** Spanische Version (z.B. `guia-respiracion-cuadrada`)
- Keine Umlaute, lowercase, Bindestriche

## Datum

**Vor dem Schreiben ausführen:**
```bash
node scripts/current-date.js
```

Output direkt als `pubDate` verwenden.

## Output-Datei

Speichere als `meta.yaml` im Scratchpad. NUR die YAML-Felder, OHNE `---` Wrapper und OHNE `faq:` Feld (wird beim Assembly aus `faq.yaml` eingefügt).
