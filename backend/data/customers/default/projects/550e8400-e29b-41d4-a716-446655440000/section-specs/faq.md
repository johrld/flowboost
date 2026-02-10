# Section Spec: FAQ Items

## Ziel

Erstelle 3-5 FAQ-Items als YAML für das Frontmatter. FAQs werden NICHT im Content-Body geschrieben - Astro rendert sie automatisch als Accordion mit FAQPage Schema.

## Format

```yaml
faq:
  - question: "Wie oft sollte ich Box Breathing üben?"
    answer: "2-3 mal täglich für je 5 Minuten ist ideal. Du kannst Box Breathing aber auch situativ bei akutem Stress einsetzen – die Technik wirkt bereits nach wenigen Atemzyklen beruhigend."
  - question: "Kann ich Box Breathing vor dem Schlafen machen?"
    answer: "Ja, Box Breathing eignet sich hervorragend als Einschlafritual. Die gleichmäßige Atmung aktiviert den Parasympathikus und bereitet deinen Körper auf erholsamen Schlaf vor."
```

## Anforderungen

| Eigenschaft | Wert |
|-------------|------|
| Anzahl Items | 3-5 (aus Outline `faq_specs`) |
| Antwort-Länge | 40-60 Wörter pro Antwort |
| Format | YAML (`- question:` / `answer:`) |
| Primary Keyword | In mindestens 1 Frage enthalten |

## Frage-Formulierung

- **Wie echte User fragen** - nicht akademisch
- Orientiere dich an "People Also Ask" Stil
- Beginne mit: "Wie...", "Kann ich...", "Was ist...", "Wann..."
- Nutze die `faq_specs` aus der Outline als Basis
- Fragen in natürlicher Sprache, nicht keyword-stuffed

## Antwort-Formulierung

- **Direkte Antwort** im ersten Satz (ja/nein/zahl)
- Dann 1-2 Sätze Erklärung
- Du-Ansprache verwenden
- Ermutigender Ton (nicht belehrend)
- Wissenschaftlich korrekt

## Verboten

- Fragen mit "Warum sollte ich Breathe nutzen?" (zu werblich)
- Antworten über 80 Wörter
- Antworten unter 30 Wörter
- Esoterische Begriffe in Antworten
- "muss" oder "soll" in Antworten

## Output-Datei

Speichere als `faq.yaml` im Scratchpad. NUR das YAML-Array, kein Frontmatter-Wrapper.

```yaml
- question: "..."
  answer: "..."
- question: "..."
  answer: "..."
```
