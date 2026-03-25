# Section Specs Skill

Definiert die exakten Anforderungen pro Content-Section-Typ. Jeder Section Writer lädt diesen Skill und liest die passende Sub-Datei basierend auf dem `type` Feld seiner Section-Spec.

## Wann laden

- Beim Schreiben einzelner Content-Sections (Section Writer Agent)
- Beim Validieren von Sections (Section Metrics Script)

## Verfügbare Section-Typen

| Typ | Datei | Verwendung |
|-----|-------|------------|
| `introduction` | `introduction.md` | Hook + Answer Capsule |
| `h2_section` | `h2-section.md` | H2 Body Section mit H3-Subsections |
| `conclusion` | `conclusion.md` | Fazit + CTA |
| `faq` | `faq.md` | FAQ Items (YAML, nur Frontmatter) |
| `meta` | `meta.md` | Frontmatter YAML |

## Workflow

1. Empfange Section-Spec aus der Outline (JSON)
2. Lies den passenden Typ: `section-specs/{type}.md`
3. Schreibe die Section nach den Regeln
4. Validiere mit `node scripts/section-metrics.js`

## Allgemeine Regeln (alle Typen)

- **Sprache:** Deutsch (DE) als Primärsprache
- **Tonalität:** Lade immer auch `brand-voice` Skill
- **Du-Ansprache** verwenden
- **Keine verbotenen Begriffe** (siehe brand-voice)
- **Aktive Sprache** bevorzugen
- **Keywords natürlich einbauen** - nicht forcieren
- **Max 20 Wörter pro Satz** im Durchschnitt
