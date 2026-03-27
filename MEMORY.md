# FlowBoost Knowledge Architecture — Gesamtkonzept

## Überblick

FlowBoost generiert und veröffentlicht Content über mehrere Kanäle (LinkedIn, X, Instagram, Shopware-Landingpages, Newsletter). Über die Zeit sammelt sich Wissen aus zwei Richtungen:

1. **Generiertes Wissen** — Flow-Chats, produzierter Content, User-Edits
2. **Eingespeistes Wissen** — Daten aus verbundenen Plattformen via Connectors

Dieses Dokument definiert, wie dieses Wissen klassifiziert, gespeichert und den Content-Agents zur Verfügung gestellt wird.

---

## Die vier Datentypen

Jeder Datenstrom aus jedem Connector fällt in eine von vier Kategorien. Diese Klassifizierung bestimmt Speicherung, Verarbeitung und Konsum.

### 🟢 Content (→ RAG Pipeline)

Text mit semantischer Bedeutung, der zukünftige Content-Generierung beeinflussen soll. Wird in Chunks aufgeteilt, als Vektoren embedded und per Similarity Search bei der Generierung abgerufen.

**Beispiele:** Produktbeschreibungen als Stilreferenzen, vergangene Blog-Artikel als thematischer Kontext, Newsletter-Body-Text, Social-Post-Captions, Chat-Session-Zusammenfassungen.

**Speicherung:** `source_documents` (roh) → `knowledge_chunks` (chunked + embedded)

### 🔴 Referenzdaten (→ Strukturierter Katalog)

Strukturierte, faktische Daten die Content-Agents für genaue Ausgaben brauchen — Produktnamen, URLs, Kategoriebäume, interne Verlinkungsziele, Template-Namen. Diese Daten müssen exakt sein, nicht approximiert. RAG (Similarity Search) ist hier das falsche Werkzeug — der Agent braucht nicht "etwas semantisch Ähnliches wie ein Produkt", sondern das exakte Produkt mit seiner exakten URL.

**Beispiele:** Shopware-Produktkatalog (Name, URL, Slug, Kategorie, Preis, Verfügbarkeit, Bild-URLs), Shopware-Kategoriebaum, Listmonk-Listenstruktur und Template-Namen, GitHub-Repo-Dateiinventar, bestehende Landingpage-URLs.

**Speicherung:** `reference_catalog` (relational, filterbar per exakte Abfragen)

**Konsum:** Content-Agents greifen über strukturierte Queries (SQL/API) zu, nicht per Vektorsuche. Beispiel: "Gib mir alle Produkte in Kategorie Visitenkarten mit ihren URLs" → exaktes Ergebnis für interne Verlinkung.

**Hinweis:** Shop-Artikel die im Flow als Quelle angegeben werden (damit sie verlinkt werden können oder als Idee dienen) sind ebenfalls 🔴 Referenzdaten. Dieses Pattern existiert bereits — der Shopware-Connector liefert Produkte als Sources für die Content-Generierung. Das wird jetzt formalisiert.

### 🔵 Metriken (→ Relationale Tabellen)

Numerische Performance-Daten. Relational gespeichert, genutzt für Reporting, Dashboards und als Input für Enrichment-Agents. Werden als Metadaten an Content-Chunks angehängt wo relevant.

**Beispiele:** Engagement-Raten (Likes, Shares, Saves), Open/Click-Rates, Verkaufsstatistiken, Conversion-Rates, Subscriber-Zahlen, Bounce-Rates, Follower-Demografie.

**Speicherung:** `channel_metrics` (relational, Time-Series-Stil)

### 🟡 Mixed (→ Sowohl RAG + Metriken)

Daten die sowohl semantische Bedeutung als auch quantitatives Signal tragen. Typischerweise User-generierte Antworten (Kommentare, Reviews, Replies). Gespeichert als aggregierte Insights in RAG (nicht einzelne Items) plus Metriken.

**Beispiele:** Kundenbewertungen (aggregiertes Sentiment + Themen pro Produkt), Social-Media-Kommentare (aggregiert pro Post), User-Edit-Diffs (der bearbeitete Text für RAG, die Diff-Größe als Metrik).

**Speicherung:** Aggregierter Insight → `knowledge_chunks` / rohe Metriken → `channel_metrics`

**DSGVO-Hinweis:** Für Kommentare und Reviews nur aggregierte Insights speichern (Sentiment, Themen, Zahlen), nicht Rohtext mit personenbezogenen Daten. Rohdaten können temporär in `source_documents` mit TTL für Re-Processing gehalten und dann gelöscht werden.

---

## Connector-Daten-Mapping

### Shopware 🛒

| Datenstrom | Typ | Pipeline | Chunking / Speicherung | Anmerkungen |
|---|---|---|---|---|
| Produktkatalog (Name, URL, Slug, Kategorie, Preis, Verfügbarkeit, Bilder) | 🔴 Referenz | Strukturierter Katalog | Relationale Zeilen, eine pro Produkt | Kernquelle für interne Verlinkung in Landingpages. Muss exakt und aktuell sein. Sync via Webhook oder periodisch. |
| Kategoriebaum (Namen, Hierarchie, URLs) | 🔴 Referenz | Strukturierter Katalog | Relational, hierarchisch | Essenziell für navigations-bewussten Content und Kategorie-Verlinkung. |
| Produktbeschreibungen (Body-Text) | 🟢 Content | RAG | Semantisch (aufgeteilt an Überschriften/Absätzen) | Rich Text, oft zweisprachig DE/EN. Tag mit Produkt-ID und Kategorie als Metadaten. |
| Kategorie-Beschreibungen | 🟢 Content | RAG | Ganzes Dokument (meist kurz) | Thematischer Kontext für Content-Generierung. |
| Kundenbewertungen | 🟡 Mixed | RAG (aggregiert) + Metriken | Aggregiert pro Produkt: Sentiment, Themen, Sterne-Verteilung | DSGVO: nur aggregierte Insights. Rohtext in source_documents mit TTL. |
| Verkaufsstatistiken | 🔵 Metriken | Relational | — | Umsatz pro Produkt/Kategorie, Trends. Füttert Trend Spotter. |
| Bestellvolumen / Conversion-Rates | 🔵 Metriken | Relational | — | Korrelation Content-Änderungen mit Conversion-Auswirkung. |

### Listmonk 📧

| Datenstrom | Typ | Pipeline | Chunking / Speicherung | Anmerkungen |
|---|---|---|---|---|
| Listenstruktur + Template-Namen | 🔴 Referenz | Strukturierter Katalog | Relational | Welche Listen existieren, welche Templates verfügbar. Agent braucht das für Targeting. |
| Kampagnen-Content (Subject + Body) | 🟢 Content | RAG | Ganzes Dokument (Newsletter = 1 semantische Einheit) | Subject Line separat als Metadaten speichern — hoher Signal-Wert. |
| Open Rates / Click Rates | 🔵 Metriken | Relational | — | Pro Kampagne. Kern-Signal für Performance Analyzer. |
| Subscriber-Zahlen / Listen-Segmente | 🔵 Metriken | Relational | — | Publikumsgröße als Kontext. DSGVO: nur Zahlen, keine PII. |
| Bounce / Abmelde-Raten | 🔵 Metriken | Relational | — | Negatives Signal — Content der Abmeldungen verursacht. |

### LinkedIn 💼

| Datenstrom | Typ | Pipeline | Chunking / Speicherung | Anmerkungen |
|---|---|---|---|---|
| Veröffentlichte Posts (Text) | 🟢 Content | RAG | Ganzes Dokument (einzelne semantische Einheiten) | Mit Hashtags, Publish-Datum, Post-Typ als Metadaten. Nicht chunken. |
| Post-Engagement (Likes, Kommentare, Shares, Impressions) | 🔵 Metriken | Relational | — | An Post-Chunk als Metadaten anhängen. API Rate Limits: ~100 req/Tag. |
| Kommentare auf Posts | 🟡 Mixed | RAG (aggregiert) + Metriken | Aggregiert pro Post: Anzahl, Sentiment, Themen, bemerkenswerte Fragen | Keine Einzelkommentare speichern (DSGVO). Zusammenfassung als Insight pro Post. |
| Follower-Demografie | 🔵 Metriken | Relational | — | Publikums-Kontext. Periodisch snapshotten. Kann projekt-übergreifend sein. |

### Instagram 📸

| Datenstrom | Typ | Pipeline | Chunking / Speicherung | Anmerkungen |
|---|---|---|---|---|
| Post-Captions | 🟢 Content | RAG | Ganzes Dokument | Mit Hashtags, Post-Typ (Reel/Story/Carousel), Medien-Beschreibung als Metadaten. |
| Post-Metriken (Reach, Likes, Saves, Shares) | 🔵 Metriken | Relational | — | Saves und Shares sind höherwertige Signale als Likes. API-Scopes ändern sich häufig. |
| Kommentare | 🟡 Mixed | RAG (aggregiert) + Metriken | Aggregiert pro Post: Sentiment, Fragen, Themen | Gleicher DSGVO-Ansatz wie LinkedIn. |
| Story-Metriken | 🔵 Metriken | Relational | — | Ephemeral — erfassen bevor sie ablaufen (24h Fenster). |

### X (Twitter) 𝕏

| Datenstrom | Typ | Pipeline | Chunking / Speicherung | Anmerkungen |
|---|---|---|---|---|
| Veröffentlichte Posts | 🟢 Content | RAG | Ganzes Dokument | Mit Thread-Kontext wenn zutreffend. |
| Engagement (Likes, Reposts, Replies, Impressions) | 🔵 Metriken | Relational | — | Reposts und Quote Tweets sind stärkstes Signal. API zunehmend eingeschränkt/kostenpflichtig. |
| Replies / Quote Tweets | 🟡 Mixed | RAG (aggregiert) + Metriken | Aggregiert pro Post: Themen, Sentiment | Öffentliche Daten, aber trotzdem aggregieren. |

### FlowBoost (intern) ⚡

| Datenstrom | Typ | Pipeline | Chunking / Speicherung | Anmerkungen |
|---|---|---|---|---|
| Chat-Gespräche (Flow-Sessions) | 🟢 Content | RAG | Erst zusammenfassen, dann Summary embedden. Roher Chat → source_documents. | Rohe Chats sind verrauscht. Die Zusammenfassung ist das Wissen. |
| Generierter Content (Artikel, Posts, Seiten) | 🟢 Content | RAG | Source-aware: Social = ganzes Dok, Artikel = semantische Absätze, Landingpages = sektionsbasiert | Primäre Wissensquelle in Phase 1. |
| User Edit Diffs | 🟡 Mixed | RAG + Metriken | Strukturierten Diff speichern (Original vs. bearbeitet). Die bearbeitete Version embedden. | **Wertvollstes Feedback-Signal.** |
| Publish-History | 🔵 Metriken | Relational | — | Was wo wann veröffentlicht wurde. Verhindert Duplikate. |

### Git / GitHub 🐙

| Datenstrom | Typ | Pipeline | Chunking / Speicherung | Anmerkungen |
|---|---|---|---|---|
| Repo-Dateiinventar (Pfade, Dateinamen) | 🔴 Referenz | Strukturierter Katalog | Relational | Wissen was existiert. Verhindert Duplikate, identifiziert Lücken. |
| Veröffentlichte Artikel (Markdown-Content) | 🟢 Content | RAG | Semantisch (überschriftenbasierte Sektionen) | Blog-Posts, Dokumentation. |
| Commit-History / Änderungshäufigkeit | 🔵 Metriken | Relational | — | Signalisiert Content-Frische. Veraltete Artikel = Update-Kandidaten. |

---

## Connector-Konfiguration: Datentypen aktivierbar

Im Connector wird jede Content-Art per Schalter aktivierbar:

- 🔴 **Reference** — Referenzdaten (Produktkatalog, Kategorien, URLs) → bereits vorbereitet durch `useAsSource`-Flag
- 🟢 **Content** — Semantische Inhalte für RAG → noch nicht aktiv, aber Schalter vorbereitet
- 🔵 **Metrics** — Performance-Daten → noch nicht aktiv, aber Schalter vorbereitet
- 🟡 **Mixed** — Kombinierte Daten → noch nicht aktiv, aber Schalter vorbereitet

**Hinweis:** Die Source-Funktion (🔴 Referenz) wird bereits abgegriffen — Shop-Artikel im Flow als Quelle angeben, damit sie verlinkt oder als Ideengeber dienen. Das hat nichts mit der Knowledge-Architektur zu tun, sondern ist eine bestehende Flow-Funktion.

Die anderen drei Typen (Content, Metrics, Mixed) werden erst mit der Knowledge-Datenbank (Supabase) aktiv.

---

## Projekt-Scoping

- Ein **User** kann mehrere **Projekte** besitzen
- Ein **Projekt** bündelt eine Marke / einen Kunden / eine Kampagne über alle Kanäle
- **Connectors** werden pro Projekt konfiguriert (ein Shopware-Shop = ein Projekt, ein LinkedIn-Account = ein Projekt)
- `project_id` propagiert durch die gesamte Pipeline: source_documents → knowledge_chunks → enrichment_insights → channel_metrics → reference_catalog
- Jede Datenbankabfrage ist standardmäßig projekt-scoped
- Projekt-übergreifendes Wissens-Sharing ist explizit opt-in (zukünftiges Feature), nie implizit

---

## Datenbank-Schema (Supabase / PostgreSQL + pgvector)

```
projects
  id, user_id, name, settings

connector_configs
  id, project_id, type, credentials, is_active

source_configs
  id, connector_id, data_stream, data_type (content|reference|metrics|mixed),
  chunking_strategy, embedding_schedule, sync_frequency

source_documents
  id, project_id, connector_id, raw_content, source_url, language,
  data_type, ingested_at, ttl_expires_at

reference_catalog
  id, project_id, connector_id, entity_type (product|category|template|file),
  entity_name, entity_url, entity_slug, parent_id, metadata JSONB,
  synced_at, is_active

knowledge_chunks
  id, project_id, source_document_id, chunk_text, embedding vector(1536),
  embedding_model, cluster_id, language, metadata JSONB, created_at

enrichment_insights
  id, project_id, agent_type, insight_text, embedding vector(1536),
  embedding_model, created_at

channel_metrics
  id, project_id, connector_id, source_document_id, metric_type,
  metric_value, measured_at

content_edits
  id, project_id, original_chunk_id, original_text, edited_text,
  diff, edit_embedding vector(1536), embedding_model, created_at
```

Alle Tabellen nutzen Row Level Security (RLS) via Supabase Auth, scoped auf User → Projekt-Ownership.

---

## Phasen-Roadmap

### Phase 0 — Connector-Typisierung (jetzt, keine Datenbank)

**Ziel:** Jeder Connector klassifiziert seine Datenströme in die vier Typen und kann typisierte Antworten liefern.

- Connector-Interface erweitern: Daten getaggt als `content`, `reference`, `metrics` oder `mixed` zurückgeben
- Das einfache `useAsSource`-Flag durch eine `source_config` pro Datenstrom ersetzen
- Jeder Connector kennt seine verfügbaren Datenströme und deren Typen
- Daten werden klassifiziert und zurückgegeben, haben aber noch kein Ziel
- Shopware/Shopify-Connectors liefern bereits Artikel als Sources für Content-Generierung — dieses bestehende Pattern wird jetzt als 🔴 Referenzdaten-Typ formalisiert

**Deliverable:** Alle Connectors liefern typisierte, strukturierte Daten. Der Interface-Vertrag ist stabil.

### Phase 1 — Supabase + Schema + Datensammlung

**Ziel:** Alles sammeln. Noch kein RAG, keine AI-Verarbeitung — nur Speicherung.

- Supabase aufsetzen (gehosteter Tier für MVP, self-hosted auf Hetzner später)
- Auth + Row Level Security + Projekt-Scoping
- Vollständiges Schema deployen (alle Tabellen, auch leere für zukünftige Nutzung)
- Connectors beginnen zu schreiben:
  - 🔴 Referenzdaten → `reference_catalog` (Produktkataloge, Kategoriebäume)
  - 🔵 Metriken → `channel_metrics` (Engagement, Verkäufe, Open Rates)
  - 🟢 Content → `source_documents` (roh, noch nicht chunked/embedded)
  - 🟡 Mixed → `source_documents` (roh) + `channel_metrics` (numerischer Teil)
- Metriken-Sammlung startet sofort — günstig zu speichern, unmöglich nachzuholen
- Referenzkatalog ist ab Tag 1 abfragbar — Content-Agents können sofort exakte Produkt-Links nutzen

**Deliverable:** Daten fließen in die Datenbank. Referenzdaten sind nutzbar. Metriken sammeln sich an.

### Phase 2 — RAG Pipeline

**Ziel:** Den gesammelten Content semantisch durchsuchbar machen.

- pgvector-Extension in Supabase aktivieren
- Chunking-Pipeline bauen (source-aware Strategien pro Datentyp wie oben definiert)
- Embedding-Pipeline implementieren (`text-embedding-3-small`, Modellversion pro Chunk speichern)
- Similarity-Search-API-Endpoint bauen (projekt-scoped, mit Metadaten-Filterung)
- Content-Agent bekommt Zugriff auf relevantes Wissen zur Generierungszeit
- Spracherkennung + Tagging pro Chunk (DE/EN Boost beim Retrieval)
- Datenqualitäts-Gate: Mindestlänge, Duplikaterkennung (Cosine > 0.98 → Skip), Metadaten-Vollständigkeit

**Deliverable:** Content-Generierung wird durch vergangenes Wissen via RAG informiert.

### Phase 3 — Enrichment Agents

**Ziel:** Muster und Insights aus den angesammelten Daten extrahieren.

- **Performance Analyzer** (zuerst) — korreliert Content-Muster mit Kanal-Metriken. Schreibt in `enrichment_insights`.
- **Topic Clusterer** (zweitens) — weist cluster_ids zu Chunks zu. Ermöglicht hierarchisches Retrieval.
- **Gap Detector** (drittens) — vergleicht Content-Inventar mit Referenzkatalog und Trends.
- **Trend Spotter** (viertens) — täglicher Check auf Verkaufs-/Engagement-Spitzen. Braucht klare Schwellenwert-Definitionen.
- **Voice Profiler** (zuletzt, mit Vorsicht) — muss aus menschlich geschriebenem Content und User-Edits profilieren, NICHT aus AI-Output (Feedback-Loop-Risiko).
- Orchestrierung via n8n Cron-Triggers oder graphile-worker

**Deliverable:** Das System lernt aktiv und präsentiert handlungsrelevante Insights.

### Phase 4 — Feedback Loop

**Ziel:** Selbstverbessernde Content-Qualität basierend auf User-Verhalten.

- Edit-Diff-Erfassung aktivieren (Original vs. bearbeitete Version)
- Die bearbeitete Version embedden (repräsentiert was der User tatsächlich wollte)
- Diff-Größe als Metrik speichern
- Edit-Muster in Enrichment-Agents einspeisen
- Content-Generierung konvergiert in Richtung dessen, was User tatsächlich veröffentlichen, nicht was die AI initial produziert

**Deliverable:** Ein geschlossener Feedback-Loop — das System verbessert sich mit jeder Veröffentlichung.

---

## Zentrale technische Entscheidungen

| Entscheidung | Empfehlung | Begründung |
|---|---|---|
| Datenbank | Supabase (PostgreSQL + pgvector + Auth) | Ein System für Auth, relationale Daten und Vektoren. Self-hostbar. |
| Embedding-Modell | `text-embedding-3-small` (OpenAI) | Speziell für Retrieval gebaut, guter deutscher Support, vernachlässigbare Kosten. Nach 4 Wochen evaluieren. |
| Embedding-Versionierung | `embedding_model`-Spalte auf jeder Vektor-Tabelle | Ermöglicht Modell-Migration ohne Downtime. Vierteljährliches Re-Embedding einplanen. |
| Chunking | Source-aware (pro Datentyp, pro Connector) | Social Posts = ganzes Dok, Artikel = semantische Absätze, Chats = erst zusammenfassen, Kommentare = aggregieren. |
| Referenzdaten | Separate relationale Tabelle, NICHT im Vektor-Store | Exakte Lookups (Produkt-URLs, Kategoriebäume) brauchen SQL-Queries, nicht Similarity Search. |
| Connector vs. Source Config | Getrennte Concerns | Connector = Auth + Transport. Source Config = Chunking + Embedding + Datentyp pro Stream. |
| Projekt-Isolation | `project_id` FK auf jeder Tabelle, RLS enforced | Multi-Projekt pro User, kein implizites projekt-übergreifendes Sharing. |
| Ingestion-Pipeline | n8n (bereits im Stack) | Getrennt vom App-Code. Per-Connector Health Checks. Webhooks wo verfügbar, Polling wo nicht. |
| DSGVO | Nur aggregierte Insights für user-generierten Content | Embeddings + Aggregationen, nicht rohe PII. source_documents mit TTL. |

---

## Offene Fragen

1. **Supabase Deployment** — gehosteter Tier für MVP vs. self-hosted auf Hetzner von Tag 1?
2. **Embedding-Modell-Evaluation** — wann `text-embedding-3-large` oder Cohere embed-v4 für Deutsch benchmarken?
3. **Referenzkatalog-Sync** — Echtzeit via Shopware-Webhooks oder periodisches Polling?
4. **Projekt-übergreifendes Wissen** — wann/wie opt-in Sharing für Agenturen mit mehreren Kundenprojekten ermöglichen?
5. **Agent-Orchestrierung** — n8n für alles oder dediziertes Agent-Framework bei wachsender Komplexität?
6. **Edit-Diff-Granularität** — Volltext-Diff oder sektionsbasiert? Wie mit minimalen vs. substantiellen Edits umgehen?
