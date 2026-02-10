# Style Guide

## Grundprinzipien

1. **Klarheit vor Cleverness** – Verständlich schreiben, nicht beeindrucken
2. **Kürze vor Vollständigkeit** – Auf den Punkt kommen
3. **Aktion vor Theorie** – Praktisch anwendbar sein
4. **Empathie vor Belehrung** – Den Leser verstehen

---

## Textformatierung

### Überschriften

| Level | Verwendung           | Beispiel                              |
| ----- | -------------------- | ------------------------------------- |
| H1    | Seitentitel (nur 1x) | "5-Minuten-Meditation für Einsteiger" |
| H2    | Hauptabschnitte      | "So funktioniert die Übung"           |
| H3    | Unterabschnitte      | "Schritt 1: Position einnehmen"       |
| H4    | Selten, für Details  | (vermeiden wenn möglich)              |

**Regeln:**

- Keywords natürlich in H1/H2 integrieren
- Keine Fragen als H1 (außer bei FAQ)
- H2 beschreibt Inhalt des Abschnitts
- Nummerierung nur bei Schritt-Anleitungen

### Absätze

- **Länge**: 2-4 Sätze pro Absatz
- **Satzlänge**: Max. 20 Wörter (Ausnahmen erlaubt)
- **Einleitung**: Jeder Abschnitt beginnt mit dem Wichtigsten
- **Übergang**: Natürliche Übergänge zwischen Absätzen

### Listen

**Bullet Points für:**

- Aufzählungen ohne Reihenfolge
- Features und Vorteile
- Tipps und Hinweise

**Nummerierte Listen für:**

1. Schritt-für-Schritt-Anleitungen
2. Priorisierte Informationen
3. Chronologische Abläufe

**Regeln:**

- Einheitliche Satzstruktur in einer Liste
- Max. 7 Punkte pro Liste
- Keine Punktlisten mit nur 2 Items

### ⚠️ WICHTIG: Listen-Formatierung

**IMMER echtes Markdown verwenden** – keine Absätze mit Fettdruck!

✅ **RICHTIG** (echte Markdown-Liste):

```markdown
Tipps für besseren Schlaf:

- **Feste Routine etablieren**: Geh jeden Abend zur gleichen Zeit ins Bett.
- **Bildschirme vermeiden**: Das blaue Licht stört den Schlafrhythmus.
- **Zimmer abdunkeln**: Dunkelheit signalisiert dem Körper Schlafenszeit.
```

❌ **FALSCH** (Absätze mit Fettdruck):

```markdown
Tipps für besseren Schlaf:

**Feste Routine etablieren**: Geh jeden Abend zur gleichen Zeit ins Bett.

**Bildschirme vermeiden**: Das blaue Licht stört den Schlafrhythmus.

**Zimmer abdunkeln**: Dunkelheit signalisiert dem Körper Schlafenszeit.
```

**Warum?** Die Website zeigt echte Listen mit farbigen Bullets an. Absätze mit Fettdruck haben kein visuelles Listenelement und sehen inkonsistent aus.

---

## Answer Capsule

Jeder Artikel beginnt mit einer Answer Capsule – eine prägnante Zusammenfassung.

### Format

```markdown
> **Kurze Antwort**: [Direkte Antwort auf die Suchintention]
> [Optional: 1-2 ergänzende Sätze mit dem Wichtigsten]
```

### Beispiele

**Gut:**

> **Kurze Antwort**: 5 Minuten Meditation täglich reichen aus, um Stress zu reduzieren und die Konzentration zu verbessern. Studien zeigen messbare Effekte bereits nach 2 Wochen.

**Schlecht:**

> In diesem Artikel erfährst du alles über Meditation. Wir werden verschiedene Aspekte beleuchten und dir zeigen, wie du anfangen kannst.

### Regeln

- Beantwortet die Hauptfrage sofort
- Max. 3 Sätze
- Enthält das Haupt-Keyword
- Steht nach H1, vor erster H2
- Formatiert als Blockquote

---

## Ansprache

### Du-Form

Wir verwenden konsequent "du" (nicht "Sie"):

✅ "Du kannst sofort anfangen."
❌ "Sie können sofort anfangen."
❌ "Man kann sofort anfangen."

### Inklusive Sprache

✅ "alle Menschen" / "jeder"
❌ gendern mit Sonderzeichen (\*, :, \_)

### Aktiv vs. Passiv

✅ "Die Übung reduziert Stress."
❌ "Stress wird durch die Übung reduziert."

---

## Fachbegriffe

### Mit Erklärung verwenden

| Begriff     | Erklärung                              |
| ----------- | -------------------------------------- |
| Cortisol    | das Stresshormon                       |
| Achtsamkeit | bewusste Wahrnehmung des Moments       |
| Body Scan   | systematisches Durchspüren des Körpers |
| Pranayama   | Atemtechniken aus dem Yoga             |

### Beispiel

✅ "Regelmäßige Meditation senkt den Cortisolspiegel – das ist das Stresshormon, das für Anspannung sorgt."

❌ "Meditation reduziert Cortisol und verbessert die HRV bei gleichzeitiger Aktivierung des Parasympathikus."

---

## Zahlen und Fakten

### Formatierung

| Typ         | Format         | Beispiel              |
| ----------- | -------------- | --------------------- |
| 1-12        | Ausgeschrieben | "fünf Minuten"        |
| 13+         | Ziffern        | "15 Minuten"          |
| Prozent     | Ziffern        | "47 % der Teilnehmer" |
| Statistiken | Immer Ziffern  | "5 von 10 Menschen"   |

### Quellenangaben

Bei Studien und Statistiken:

- Inline-Erwähnung: "Laut einer Harvard-Studie..."
- Am Ende: Link zur Quelle (wenn verfügbar)
- Keine Fußnoten im Fließtext

---

## Links

### Interne Links

- Natürlich in den Text integrieren
- Beschreibender Linktext (nicht "hier klicken")
- Mind. 2 interne Links pro Artikel
- Pillar ↔ Cluster bidirektional verlinken

**Gut:**
"Mehr dazu in unserem [Guide für Meditation](../guides/meditation-anfaenger)."

**Schlecht:**
"Klicke [hier](../guides/meditation-anfaenger) für mehr Infos."

### Externe Links

- Nur zu vertrauenswürdigen Quellen
- `target="_blank"` für externe Links
- Sparsam verwenden (Leser auf Seite halten)

---

## Bilder

### Naming Convention

```
[slug]-[beschreibung].jpg
5-minuten-meditation-hero.jpg
box-breathing-anleitung-step1.jpg
```

### Alt-Text

- Beschreibt was auf dem Bild zu sehen ist
- Enthält Keyword wenn natürlich
- Max. 125 Zeichen

**Gut:**
`alt="Person sitzt im Schneidersitz und meditiert in ruhiger Umgebung"`

**Schlecht:**
`alt="Bild"` oder `alt="meditation meditation meditation"`

---

## Call-to-Actions (CTAs)

### Formulierungen

| Zweck        | CTA                         |
| ------------ | --------------------------- |
| App-Download | "Jetzt kostenlos starten"   |
| Mehr lesen   | "Erfahre mehr über [Thema]" |
| Übung testen | "Probier die Übung aus"     |
| Newsletter   | "Bleib auf dem Laufenden"   |

### Platzierung

- Nach Answer Capsule (optional, subtle)
- Nach Hauptteil
- Im Fazit
- Nicht mehr als 3 pro Artikel

---

## Checkliste vor Veröffentlichung

### Struktur

- [ ] H1 enthält Haupt-Keyword
- [ ] Answer Capsule vorhanden
- [ ] 3-5 H2 Überschriften
- [ ] Absätze ≤ 4 Sätze

### Sprache

- [ ] Du-Ansprache durchgängig
- [ ] Keine verbotenen Begriffe
- [ ] Fachbegriffe erklärt
- [ ] Aktive Formulierungen

### SEO

- [ ] Titel 50-70 Zeichen
- [ ] Meta Description 100-160 Zeichen
- [ ] Mind. 2 interne Links
- [ ] Bilder mit Alt-Text

### Qualität

- [ ] Rechtschreibung geprüft
- [ ] Fakten verifiziert
- [ ] Ton entspricht Brand Voice
- [ ] Mehrwert für Leser klar
