# Section Spec: H2 Body Section

## Ziel

Schreibe einen eigenständigen Abschnitt zu einem Unterthema des Artikels. Jede H2-Section soll für sich lesbar sein und gleichzeitig in den Gesamtartikel passen.

## Struktur

```markdown
## [H2 Überschrift mit Keyword-Variante]

[Absatz 1: Kernaussage - 4-6 Sätze, ausführlich]

[Absatz 2: Vertiefung/Beispiel - 3-4 Sätze, mittel]

[Absatz 3: Praktischer Bezug - 2-3 Sätze, kurz]

### [Optional: H3 Subsection]

[Absatz: 3-4 Sätze]
```

## Anforderungen

| Eigenschaft | Wert |
|-------------|------|
| Gesamtlänge | 250-400 Wörter (aus Outline `target_words`) |
| Absätze | Minimum 3 (aus Outline `min_paragraphs`) |
| H3 Subsections | Wenn in Outline spezifiziert (`h3s` Array) |
| Keywords | Aus Outline `keywords_to_include` natürlich einbauen |
| Interner Link | Wenn in Outline `internal_link` spezifiziert |

## Natürliche Absatzvariation

**Kritisch:** Variiere Absatzlängen natürlich.

```
FALSCH: [4 Sätze] [4 Sätze] [4 Sätze]
RICHTIG: [5-6 Sätze] [2-3 Sätze] [4-5 Sätze]
```

- **Lange Absätze** (5-7 Sätze): Für Erklärungen, Beispiele, wissenschaftliche Hintergründe
- **Mittlere Absätze** (3-4 Sätze): Für Hauptpunkte, Übergänge
- **Kurze Absätze** (2-3 Sätze): Für Betonung, wichtige Aussagen, Tipps

## Inhaltliche Tiefe

Jede Section braucht **substanziellen Inhalt**, nicht Fülltext:

- Konkrete Beispiele aus dem Alltag
- Wissenschaftliche Fakten oder Studienergebnisse
- Praktische Tipps und Anleitungen
- Häufige Fehler und wie man sie vermeidet
- Vergleiche und Analogien

## Keyword-Einbau

- Keywords aus `keywords_to_include` natürlich im Text verteilen
- Mindestens 1 Keyword pro Section
- Nicht in jeden Satz ein Keyword packen
- Keyword-Varianten und Synonyme nutzen

## Interner Link

Wenn `internal_link` in der Section-Spec steht:
- Link als natürlicher Teil eines Satzes einbauen
- Deskriptiven Anchor-Text verwenden (aus Spec)
- Format: `[Anchor Text](/de/blog/slug)`

## H3 Subsections

Wenn `h3s` in der Outline spezifiziert:
- Jede H3 hat mindestens 2 Absätze
- H3-Überschrift beschreibt den Unterpunkt klar
- H3s gliedern die H2-Section logisch

## Output-Datei

Speichere als `section-{N}.md` im Scratchpad (N = Nummer aus Outline). Beginne direkt mit `## H2 Überschrift`.
