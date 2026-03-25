# Blog Post Template

Vorlage für Standard-Blogartikel (1.200-2.000 Wörter).

## Pipeline V2: Section-Based Writing

In der neuen Pipeline wird jeder Artikel **section-by-section** geschrieben:

1. **Outline Architect** erstellt detaillierte Section-Specs (JSON)
2. **Section Writer** schreiben einzelne Sections parallel (je 100-400 Wörter)
3. **Content Editor** assembliert alle Sections zu einem Artikel
4. Section-Typ-Regeln: siehe `.claude/skills/section-specs/`

Dieses Template dient dem Content Editor als Referenz für die Gesamtstruktur.

## Frontmatter

```yaml
---
title: "[Keyword]: [Benefit/Zusatz]"
description: "[Zusammenfassung]. [Benefit]. [CTA - optional]"
pubDate: YYYY-MM-DD
author: alex
category: [meditation|breathing|mindfulness|sleep|stress]
tags:
  - relevanter-tag
  - weiterer-tag
keywords:
  - primary-keyword
  - secondary-keyword
  - long-tail-keyword
pillar: slug-der-pillar-page # Optional: Verknüpfung zu Guide
lang: de
translationKey: unique-identifier
translations:
  en: "english-slug"
  es: "spanish-slug"
heroImage: "@assets/posts/de/slug-hero.jpg" # Optional
heroAlt: "Bildbeschreibung"
faq: # WICHTIG: FAQs NUR hier, NICHT im Content wiederholen!
  - question: "Frage 1?"
    answer: "Antwort in 40-60 Wörtern."
  - question: "Frage 2?"
    answer: "Antwort in 40-60 Wörtern."
  - question: "Frage 3?"
    answer: "Antwort in 40-60 Wörtern."
draft: false
---
```

**WICHTIG - FAQ-Regel:**

- FAQs werden NUR im Frontmatter definiert
- KEINE "## Häufige Fragen" Sektion im Content schreiben
- Das Astro-Template rendert die FAQs automatisch als ausklappbares Accordion
- Die FAQs aus dem Frontmatter erzeugen auch das FAQPage Schema für Rich Snippets

## Struktur (mit Mindest-Absatzzahlen)

**WICHTIG:** Jede H2-Sektion braucht **mindestens 3 Absätze** – aber mit **natürlicher Variation**!

### Natürlicher Schreibrhythmus

❌ **NICHT:** Roboterhaft gleichförmig

```
[4 Sätze] [4 Sätze] [4 Sätze] [4 Sätze]
```

✅ **BESSER:** Wie ein Mensch schreibt

```
[6 Sätze - ausführliche Erklärung]
[2 Sätze - kurze, prägnante Aussage]
[5 Sätze - Beispiel mit Details]
[3 Sätze - Überleitung]
```

**Regeln:**

- Kurze Absätze (2-3 Sätze) für Betonung, Übergänge, wichtige Punkte
- Lange Absätze (5-7 Sätze) für Erklärungen, Beispiele, Analysen
- Wechsle bewusst zwischen kurz und lang
- Die Mindestangaben unten sind MINIMA, keine Zielwerte

```markdown
# [H1 mit Primary Keyword am Anfang]

> **Kurze Antwort**: [Direkte Antwort auf die Suchintention. 2-3 Sätze, die die Kernfrage beantworten. Enthält das Haupt-Keyword.]

## [H2 - Was ist / Definition]

<!-- MINIMUM: 3 Absätze, variiere die Länge! -->

[Absatz 1: Einführung ins Thema. Problem aufgreifen. Warum relevant? 5-6 Sätze - ausführlich]

[Absatz 2: Kernaussage auf den Punkt. 2-3 Sätze - kurz & prägnant]

[Absatz 3: Hintergrund oder wissenschaftlicher Kontext. 4-5 Sätze - mittel]

## [H2 - Anleitung / So funktioniert es]

<!-- MINIMUM: 4 Absätze, variiere die Länge! -->

[Absatz 1: Kernkonzept erklären. 5-7 Sätze - ausführlich]

[Absatz 2: Überleitung oder wichtiger Hinweis. 2-3 Sätze - kurz]

[Absatz 3: Praktische Anleitung mit Beispiel. 4-6 Sätze - mittel bis lang]

[Absatz 4: Zusammenfassung oder Variation. 3-4 Sätze - mittel]

### [Optional: H3 für Schritte oder Details]

1. **Schritt 1**: [Beschreibung mit 2-3 Sätzen]
2. **Schritt 2**: [Beschreibung mit 2-3 Sätzen]
3. **Schritt 3**: [Beschreibung mit 2-3 Sätzen]

## [H2 - Wann / Wo anwenden]

<!-- MINIMUM: 3 Absätze, variiere! -->

[Absatz 1: Beste Zeitpunkte und Situationen. 4-5 Sätze - mittel]

[Absatz 2: Ein konkretes Beispiel aus dem Alltag. 5-7 Sätze - ausführlich]

[Absatz 3: Kurzer Praxis-Tipp. 2-3 Sätze - prägnant]

## [H2 - Vorteile / Wirkung]

<!-- MINIMUM: 3 Absätze, variiere! -->

[Absatz 1: Hauptvorteil mit Studie oder Fakt. 5-6 Sätze - ausführlich]

[Absatz 2: Das bedeutet konkret für dich. 2-3 Sätze - kurz & direkt]

[Absatz 3: Weitere Vorteile im Überblick. 4-5 Sätze - mittel]

## [H2 - Tipps / Häufige Fehler]

<!-- MINIMUM: 3 Absätze, variiere! -->

[Absatz 1: Der häufigste Fehler und Lösung. 4-5 Sätze - mittel]

[Absatz 2: Wichtigster Tipp. 2-3 Sätze - kurz & einprägsam]

[Absatz 3: Fortgeschrittenen-Tipps mit Beispiel. 5-6 Sätze - ausführlich]

## Fazit

<!-- 2-3 Absätze, variiere! -->

[Absatz 1: Zusammenfassung der Kernpunkte. 3-4 Sätze - kompakt]

[Absatz 2: Ermutigung und nächster Schritt. 2-3 Sätze - motivierend]

[CTA zur App - 1-2 Sätze]

**[CTA]**: Probier [Thema] aus – [dein Produkt/Service].

<!--
WICHTIG: KEINE FAQ-Sektion im Content!
Die FAQs aus dem Frontmatter werden automatisch als Accordion gerendert.
Schreibe die FAQs NUR ins Frontmatter, nicht in den Content.
-->
```

**Rechnung:** 5 H2 × 3 Absätze × ~70 Wörter + Fazit = **~1.200 Wörter Minimum**

## Spezifikationen

| Eigenschaft        | Wert                             |
| ------------------ | -------------------------------- |
| **Absätze gesamt** | **Mind. 15-18** (~1.200+ Wörter) |
| **Absätze pro H2** | **Mind. 3** (Länge variieren!)   |
| H2 Überschriften   | 5-6                              |
| FAQs               | 3-5                              |
| Interne Links      | Mind. 2                          |
| Titel-Länge        | 50-70 Zeichen                    |
| Description-Länge  | 100-160 Zeichen                  |

**Variation ist Pflicht:** Mische kurze (2-3 Sätze) und lange (5-7 Sätze) Absätze für natürlichen Lesefluss.

**Warum Absätze statt Wörter?** LLMs können keine Wörter zählen, aber Absätze strukturieren. 15 Absätze × ~80 Wörter = ~1.200 Wörter.

## Interne Verlinkung

Platziere mind. 2 interne Links:

1. **Im Hauptteil**: Zu verwandten Artikeln

   ```markdown
   Mehr dazu in unserem [Guide für Atemübungen](/de/guides/atemubungen-anfaenger).
   ```

2. **Im Fazit oder bei Tipps**: Zu ergänzenden Themen
   ```markdown
   Kombiniere diese Technik mit der [4-7-8 Atmung](/de/blog/4-7-8-atemtechnik) für noch bessere Ergebnisse.
   ```

## ⚠️ Listen-Formatierung

**IMMER echte Markdown-Listen verwenden!** Die Website zeigt Listen mit farbigen Bullets an.

✅ **RICHTIG** (echte Liste mit `-`):

```markdown
Diese Fehler solltest du vermeiden:

- **Zu viel erwarten**: Nicht jede Nacht klappt es sofort.
- **Auf die Uhr schauen**: Das stört den Schlaf zusätzlich.
- **Bildschirmzeit davor**: Blaues Licht hält wach.
```

❌ **FALSCH** (Absätze mit Fettdruck):

```markdown
Diese Fehler solltest du vermeiden:

**Zu viel erwarten**: Nicht jede Nacht klappt es sofort.

**Auf die Uhr schauen**: Das stört den Schlaf zusätzlich.

**Bildschirmzeit davor**: Blaues Licht hält wach.
```

**Merke:** Aufzählungen mit **Titel: Beschreibung** Format IMMER als Liste mit `-` schreiben!

## Beispiel

Siehe: `src/content/posts/de/5-minuten-meditation.md`
