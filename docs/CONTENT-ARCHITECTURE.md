# FlowBoost Content Architecture

> Version 3 — Headless Content Hub + AI Orchestrator

## Vision

FlowBoost ist ein **Headless Content Hub**, der Inhalte ueber externe AI-Services produziert, verwaltet und an beliebige Plattformen ausliefert. Drei Content-Saeulen unter einem Dach:

- **Site Content**: Blog Posts, Guides, Landing Pages (Markdown/HTML → GitHub, WordPress, Shopify, Webflow)
- **Media Content**: Videos, Audio, Podcasts (Dateien → YouTube, Spotify, Vimeo, SoundCloud)
- **Social Content**: Abgeleitet aus Site/Media Content (Text + Media → LinkedIn, Instagram, TikTok, X, Facebook)

FlowBoost **orchestriert** — es produziert nicht direkt. Kunden binden ihre eigenen AI-Service-Keys an (Anthropic, Google AI, Runway, ElevenLabs etc.), und FlowBoost koordiniert die Pipelines.

Alles wird in einem **universellen Content Index** getrackt — unabhaengig von Format, Plattform oder Herkunft.

---

## Architektur-Uebersicht

```
                       ┌───────────────────────────┐
                       │      CONTENT INDEX         │
                       │   (unified tracking)       │
                       └─────────────┬──────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
┌────────▼────────┐        ┌─────────▼─────────┐       ┌────────▼────────┐
│    AI LAYER     │        │    CONNECTORS      │       │  MEDIA PIPELINE │
│  (orchestrate   │        │    (deliver)       │       │  (upload/CDN)   │
│   external AIs) │        │                    │       │                 │
├─────────────────┤        ├────────────────────┤       ├─────────────────┤
│ Anthropic (Text)│        │ SiteConnector      │       │ Upload (local)  │
│ Imagen (Image)  │        │ MediaConnector     │       │ Process (thumb) │
│ Runway (Video)  │        │ SocialConnector    │       │ CDN (R2)        │
│ ElevenLabs (TTS)│        └────────┬───────────┘       └─────────────────┘
└─────────────────┘                 │
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────▼─────┐  ┌─────▼─────┐  ┌──────▼──────┐
              │   SITE    │  │   MEDIA   │  │   SOCIAL    │
              │           │  │           │  │             │
              │ GitHub    │  │ YouTube   │  │ LinkedIn    │
              │ WordPress │  │ Vimeo     │  │ Instagram   │
              │ Shopify   │  │ Spotify   │  │ TikTok      │
              │ Webflow   │  │ Apple Pod │  │ X/Twitter   │
              │ Filesystem│  │ SoundCloud│  │ Facebook    │
              └───────────┘  └───────────┘  └─────────────┘
```

---

## Grundprinzipien

### 1. FlowBoost orchestriert, produziert nicht

FlowBoost ruft externe AI-Services auf — es hat keinen eigenen AI-Kern. Kunden konfigurieren ihre API-Keys pro Projekt. FlowBoost steuert die Pipeline, speichert die Ergebnisse und verteilt sie.

```
Kunde → konfiguriert API Keys → FlowBoost → ruft AI API → speichert Ergebnis → liefert an Plattform
```

### 2. Template ≠ Connector

```
Template  = WAS gesendet wird (Format, Limits, Felder)
Connector = WIE gesendet wird (API Call, Auth, Upload)
```

### 3. SiteConnector Pattern (Ports & Adapters)

Jede Plattform implementiert ein universelles Interface. API-Endpoints kennen keine plattform-spezifische Logik.

```typescript
interface SiteConnector {
  readonly platform: string;
  createReader(): ContentReader;
  write(project, content, versions, versionDir): Promise<WriteResult>;
  update?(project, content, versions, versionDir, previousRef): Promise<WriteResult>;
  unpublish?(ref, options?): Promise<UnpublishResult>;
  publish?(writeRef): Promise<PublishResult>;
}
```

`write()` returned `published: boolean`:

| Plattform | write() | published | publish() noetig? |
|-----------|---------|-----------|-------------------|
| GitHub | PR erstellen | `false` | Ja (PR mergen) |
| Filesystem | Dateien kopieren | `true` | Nein |
| WordPress | POST /posts | `true` | Nein |
| Shopify | articleCreate | `true` | Nein |
| Webflow | Draft erstellen | `false` | Ja (publish) |

### 4. Drei Connector-Familien

Unterschiedliche Semantik pro Familie:

| Familie | Zweck | Interface |
|---------|-------|-----------|
| **SiteConnector** | Text-Content auf Websites | write/update/unpublish/publish |
| **MediaConnector** | Video/Audio auf Plattformen | upload/replace/setVisibility/delete |
| **SocialConnector** | Social Posts veroeffentlichen | publish/schedule/delete |

### 5. Content Model ist typ-agnostisch

Ein `ContentItem` kann ein Artikel, Video, Podcast oder Social Post sein. Der Lifecycle (Plan → Produce → Review → Deliver → Publish → Update → Archive) ist fuer alle Typen gleich. Die Unterschiede leben in den Versionen (typ-spezifische Metadaten) und den Pipelines.

### 6. Vollstaendiger Lifecycle (CRUD)

Jeder Content-Typ unterstuetzt: Create, Read, Update, Delete, Archive, Restore. Keine Einbahn-Pipeline — Content kann nach Publish aktualisiert oder entfernt werden.

### 7. Source ≠ Status

```
source: "flowboost" | "external"     // WER hat es erstellt
status: "planned" | "producing" | ...  // WO steht es im Lifecycle
```

### 8. Publish Queue mit Retry

Social APIs sind unzuverlaessig. Jeder Publish-Vorgang geht durch eine Queue mit Exponential Backoff, Dead Letter Queue nach 5 Fehlversuchen.

### 9. Canonical URL Strategie

Bei Multi-Platform Publishing: eigene Website ist Primaerquelle. 2-3 Tage warten vor Social Syndication.

---

## Content Model

### ContentItem

Ersetzt das bisherige `Article`-Modell. Erweitert es um `type`, erweiterte Status, und Media-Tracking.

```typescript
type ContentType =
  | "article"         // Blog Post, News
  | "guide"           // Pillar Page, Tutorial
  | "landing_page"    // Marketing Landing Page
  | "video"           // Video Content
  | "audio"           // Podcast Episode, Meditation, Voiceover
  | "social_post";    // Social Media Post

type ContentStatus =
  | "planned"         // Topic approved, nicht produziert
  | "producing"       // Pipeline laeuft
  | "draft"           // Produziert, nicht reviewed
  | "review"          // Wartet auf Approval
  | "approved"        // Approved, nicht delivered
  | "delivered"       // An Plattform gesendet (PR offen, Draft erstellt)
  | "published"       // Live auf Plattform(en)
  | "updating"        // Re-Delivery nach Content-Aenderung
  | "archived";       // Soft-Delete, von Plattformen entfernt

interface ContentItem {
  id: string;
  customerId: string;
  projectId: string;

  type: ContentType;
  status: ContentStatus;

  // Metadata
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  keywords?: string[];

  // Verknuepfungen
  topicId?: string;              // Aus Content-Planung
  translationKey?: string;       // Fuer Mehrsprachigkeit
  parentId?: string;             // Abgeleitet (Social aus Article, Clip aus Video)

  // Version Tracking
  currentVersionId?: string;
  lastPublishedVersionId?: string;

  // Delivery Tracking
  deliveryRef?: string;          // PR Number, Post ID, Draft ID
  deliveryUrl?: string;          // PR URL, Preview URL

  // Timestamps
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  deliveredAt?: string;
  publishedAt?: string;
  archivedAt?: string;
}
```

### ContentVersion

Ersetzt `ArticleVersion`. Unterstuetzt alle Content-Typen mit typ-spezifischen Metadaten.

```typescript
interface ContentVersion {
  id: string;
  contentId: string;
  versionNumber: number;         // Auto-increment: 1, 2, 3...

  // Sprach-Varianten
  languages: LanguageVariant[];

  // Media-Anhaenge
  assets: MediaAssetRef[];

  // Typ-spezifische Metadaten (discriminated by ContentItem.type)
  text?: TextVersionMeta;
  video?: VideoVersionMeta;
  audio?: AudioVersionMeta;
  social?: SocialVersionMeta;

  // Pipeline-Tracking
  pipelineRunId?: string;
  seoScore?: number;
  qualityScore?: number;

  createdAt: string;
  createdBy: "pipeline" | "user" | "sync";
}

interface LanguageVariant {
  lang: string;
  slug: string;
  title: string;
  description: string;
  contentPath: string;           // Relativ innerhalb Version-Dir
  wordCount?: number;
}

interface TextVersionMeta {
  wordCount: number;
  headingCount: number;
  hasFaq: boolean;
  hasAnswerCapsule: boolean;
  readabilityScore?: number;
}

interface VideoVersionMeta {
  durationSeconds: number;
  resolution: string;            // "1920x1080", "1080x1920"
  format: string;                // "mp4", "webm"
  hasSubtitles: boolean;
  scriptPath?: string;
}

interface AudioVersionMeta {
  durationSeconds: number;
  format: string;                // "mp3", "wav", "m4a"
  sampleRate: number;
  hasTranscript: boolean;
  transcriptPath?: string;
}

interface SocialVersionMeta {
  platform: string;
  characterCount: number;
  hashtagCount: number;
  hasMedia: boolean;
}
```

### MediaAsset

Eigene Entitaet fuer alle binaeren Assets. Kann ueber Versions und Content-Items geteilt werden.

```typescript
type MediaType = "image" | "video" | "audio" | "document";
type MediaSource = "generated" | "uploaded" | "extracted";

interface MediaAsset {
  id: string;
  customerId: string;
  projectId: string;

  type: MediaType;
  source: MediaSource;
  mimeType: string;
  fileName: string;
  fileSize: number;              // Bytes

  // Storage
  localPath: string;             // Relativ zum Projekt-Assets-Dir
  cdnUrl?: string;               // Nach Upload zu CDN

  // Bild-spezifisch
  width?: number;
  height?: number;
  altText?: string;

  // Video/Audio-spezifisch
  durationSeconds?: number;
  resolution?: string;
  thumbnailPath?: string;

  // AI Generation Tracking
  generationPrompt?: string;
  generationModel?: string;      // "imagen-4", "runway-gen3", "elevenlabs-v2"
  generationCostUsd?: number;

  createdAt: string;
  updatedAt: string;
}

interface MediaAssetRef {
  assetId: string;
  role: "hero" | "thumbnail" | "inline" | "attachment" | "social_media";
  lang?: string;                 // Sprach-spezifisches Asset
}
```

### Storage Layout

```
data/customers/{cid}/projects/{pid}/
  content/                             # Ersetzt articles/
    {contentId}/
      content.json                     # ContentItem
      versions/
        {versionId}/
          version.json                 # ContentVersion
          content/                     # Text pro Sprache
            de/slug.md
            en/slug.md
          assets/                      # Version-spezifische Assets
            de/slug-hero.png
          script/                      # Fuer Video/Audio
            script.md
            storyboard.json
  media/                               # Globale Media Library
    {assetId}/
      asset.json                       # MediaAsset Metadata
      original/                        # Originaldatei
      processed/                       # Thumbnails, Transcodes
  content-index.json                   # Unified Tracking
  revisions/                           # Audit Trail
    {contentId}.json
```

---

## Content Lifecycle

### Status-Maschine

Gilt fuer ALLE Content-Typen (article, video, audio, social_post):

```
                    ┌──────────┐
                    │ planned  │ ← Topic approved / manuell erstellt
                    └────┬─────┘
                         │ Pipeline starten
                    ┌────▼─────┐
                    │producing │ ← Pipeline laeuft
                    └────┬─────┘
                         │ Pipeline fertig
                    ┌────▼─────┐
              ┌─────┤  draft   │ ← Qualitaet nicht bestanden / braucht Review
              │     └────┬─────┘
              │          │ submit
              │     ┌────▼─────┐
              │     │ review   │ ← Wartet auf Mensch
              │     └────┬─────┘
              │          │ approve        │ reject (→ draft)
              │     ┌────▼─────┐          │
              │     │ approved │ ←────────┘
              │     └────┬─────┘
              │          │ deliver
              │     ┌────▼─────┐
              │     │delivered │ ← PR offen / Draft auf Plattform
              │     └────┬─────┘
              │          │ publish
              │     ┌────▼──────┐
              │     │ published │ ← Live auf Plattform(en)
              │     └─────┬─────┘
              │           │           │
              │     update│     archive│
              │     ┌─────▼────┐      │
              │     │ updating │      │ ← Neuer Version → Re-Delivery
              │     └─────┬────┘      │
              │           │           │
              │           ▼           │
              │      published        │
              │                  ┌────▼─────┐
              └──────────────────┤ archived │ ← Von Plattform entfernt
                                └──────────┘
```

### Lifecycle pro Content-Typ

| Phase | Article | Video | Audio | Social Post |
|-------|---------|-------|-------|-------------|
| **producing** | Outline → Write → Assemble → Quality → Translate | Script → Storyboard → Generate → Review | Script → Voice → Mix → Review | Repurpose → Format → Media |
| **delivered** | GitHub: PR erstellt. WP: Draft. | YouTube: Unlisted. | Spotify: Draft. | — (publish direkt) |
| **published** | PR merged / Post live | YouTube: Public | Episode live | Post veroeffentlicht |
| **updating** | Neuer PR mit Aenderungen | Neues Video, altes ersetzt | Neue Episode-Version | Post bearbeiten |
| **archived** | Dateien loeschen / Draft setzen | Private/Unlisted | Episode unpublishen | Post loeschen |

### Update-Flow

1. User bearbeitet Content im Editor oder Pipeline re-run
2. Neuer `ContentVersion` mit `versionNumber + 1`
3. Status: `published` → `updating`
4. `SiteConnector.update()` mit neuem Version-Dir
5. Erfolg: Status → `published`, `lastPublishedVersionId` aktualisiert
6. Fehler: Status → `published` (Rollback, alte Version bleibt live)

### Archive/Delete-Flow

**Archivieren** (Soft-Delete):
1. Status: `published` → `archived`
2. `SiteConnector.unpublish(ref, { soft: true })` — Inhalte von Plattform entfernen
3. Lokale Daten bleiben (Restore moeglich)

**Endgueltig loeschen**:
1. Nur fuer archivierte Inhalte
2. Lokale Daten (Versions, Media) geloescht
3. Content Index Entry entfernt

---

## SiteConnector Interface

### Vollstaendiges Interface

```typescript
interface SiteConnector {
  readonly platform: string;

  /** Reader fuer Sync */
  createReader(): ContentReader;

  /** Content erstmalig ausliefern */
  write(
    project: Project,
    content: ContentItem,
    versions: ContentVersion,
    versionDir: string,
  ): Promise<WriteResult>;

  /** Bestehenden Content aktualisieren */
  update?(
    project: Project,
    content: ContentItem,
    versions: ContentVersion,
    versionDir: string,
    previousRef: string,
  ): Promise<WriteResult>;

  /** Content von Plattform entfernen */
  unpublish?(
    ref: string,
    options?: { soft?: boolean },
  ): Promise<UnpublishResult>;

  /** Explizit publishen (nur fuer 2-Step-Plattformen) */
  publish?(writeRef: string): Promise<PublishResult>;
}

interface WriteResult {
  success: boolean;
  ref: string;                   // PR Number, Post ID, Draft ID
  url?: string;
  published: boolean;            // true = sofort live
  filesWritten: string[];
  commitHash?: string;
  error?: string;
}

interface PublishResult {
  success: boolean;
  ref?: string;
  url?: string;
  error?: string;
}

interface UnpublishResult {
  success: boolean;
  ref?: string;
  error?: string;
}
```

### Plattform-Verhalten

| Plattform | write() | update() | unpublish(soft) | unpublish(hard) | publish() |
|-----------|---------|----------|-----------------|-----------------|-----------|
| **GitHub** | PR erstellen (`published: false`) | Neuer PR (Update) | PR loescht Files | PR loescht Files | PR mergen |
| **Filesystem** | Kopieren (`published: true`) | Ueberschreiben | Loeschen | Loeschen | — |
| **WordPress** | POST /posts (`published: true`) | PUT /posts/{id} | status=draft | DELETE /posts/{id} | — |
| **Shopify** | articleCreate (`published: true`) | articleUpdate | published=false | articleDelete | — |
| **Webflow** | Draft (`published: false`) | Draft update | Draft loeschen | Draft loeschen | Publish |

### Implementierte Connectors

| Connector | Status | Datei |
|-----------|--------|-------|
| `GitHubSiteConnector` | ✅ write + publish | `connectors/site/github.ts` |
| `FilesystemSiteConnector` | ✅ write | `connectors/site/filesystem.ts` |
| `WordPressSiteConnector` | ⬜ Geplant | — |
| `ShopifySiteConnector` | ⬜ Geplant | — |
| `WebflowSiteConnector` | ⬜ Geplant | — |

### Factory

```typescript
// connectors/site/factory.ts
function createSiteConnector(project: Project): SiteConnector {
  switch (project.connector.type) {
    case "github":     return new GitHubSiteConnector(config);
    case "filesystem": return new FilesystemSiteConnector(outputDir);
    // Zukunft:
    // case "wordpress": return new WordPressSiteConnector(config);
    // case "shopify":   return new ShopifySiteConnector(config);
    // case "webflow":   return new WebflowSiteConnector(config);
  }
}
```

---

## MediaConnector Interface

Fuer Video/Audio-Plattformen (YouTube, Vimeo, Spotify, Apple Podcasts, SoundCloud).

```typescript
interface MediaConnector {
  readonly platform: string;

  /** Datei auf Plattform hochladen */
  upload(
    content: ContentItem,
    version: ContentVersion,
    mediaPath: string,
    metadata: MediaUploadMeta,
  ): Promise<MediaUploadResult>;

  /** Metadata aktualisieren (Titel, Beschreibung, Tags) */
  updateMetadata(
    platformId: string,
    metadata: Partial<MediaUploadMeta>,
  ): Promise<{ success: boolean; error?: string }>;

  /** Datei ersetzen (Re-Upload) */
  replace(
    platformId: string,
    mediaPath: string,
    metadata: MediaUploadMeta,
  ): Promise<MediaUploadResult>;

  /** Sichtbarkeit setzen (public, unlisted, private) */
  setVisibility(
    platformId: string,
    visibility: "public" | "unlisted" | "private",
  ): Promise<{ success: boolean; error?: string }>;

  /** Von Plattform loeschen */
  delete(platformId: string): Promise<{ success: boolean; error?: string }>;
}

interface MediaUploadMeta {
  title: string;
  description: string;
  tags?: string[];
  language?: string;
  thumbnailPath?: string;
  subtitlePaths?: Record<string, string>;
  visibility?: "public" | "unlisted" | "private";
  scheduledAt?: string;
}

interface MediaUploadResult {
  success: boolean;
  platformId?: string;           // YouTube Video ID, Spotify Episode ID
  platformUrl?: string;
  error?: string;
}
```

---

## SocialConnector Interface

Fuer Social Media Plattformen (LinkedIn, Instagram, TikTok, X, Facebook).

```typescript
interface SocialConnector {
  readonly platform: SocialPlatform;

  isAuthenticated(): Promise<boolean>;

  /** Post veroeffentlichen (nutzt Template intern) */
  publish(content: SocialContent): Promise<SocialPublishResult>;

  /** Post fuer spaeter planen */
  schedule(content: SocialContent, at: Date): Promise<SocialPublishResult>;

  /** Post loeschen */
  delete(platformPostId: string): Promise<void>;

  /** Media hochladen (Bild/Video fuer Post) */
  uploadMedia(file: Buffer, mimeType: string): Promise<string>;
}

interface SocialPublishResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
  retryable?: boolean;
}
```

---

## Media Pipeline

### Ingest-Flow

```
Quelle: User Upload ODER AI Generation
                │
                ▼
     MediaService.ingest(file | aiResult)
                │
                ├─ MediaAsset Record erstellen
                ├─ Original speichern: media/{id}/original/
                ├─ Metadaten extrahieren (Dimensionen, Dauer, EXIF)
                ├─ Thumbnails generieren (Bilder: resize, Video: Frame)
                │
                ▼
     MediaAsset { id, localPath, type, ... }
                │
                ├─ An ContentVersion anhaengen via MediaAssetRef
                │
                ▼ (optional, Phase 6)
     CDN Upload (Cloudflare R2)
                │
                ▼
     MediaAsset.cdnUrl aktualisiert
```

### AI Generation Integration

Bestehend:
- `flowboost_generate_image` → Google Imagen 4 Fast API

Geplant:
- `flowboost_generate_video` → Runway Gen-3 / Kling / Sora
- `flowboost_generate_audio` → ElevenLabs / PlayHT

Jeder MCP-Tool-Call:
1. Liest API Key aus Projekt-Config (`ApiKeys`)
2. Sendet Prompt an externe API
3. Speichert Ergebnis als `MediaAsset` mit `source: "generated"`
4. Trackt Kosten in `generationCostUsd`

---

## AI Service Registry

Kunden konfigurieren ihre AI-Service Keys pro Projekt:

```typescript
interface ApiKeys {
  // Text AI
  anthropicApiKey?: string;

  // Image AI
  googleAiApiKey?: string;

  // Video AI
  runwayApiKey?: string;
  klingApiKey?: string;

  // Audio AI
  elevenLabsApiKey?: string;
}
```

FlowBoost nutzt ein Registry-Pattern:

```typescript
const AI_SERVICES = [
  { type: "text",  provider: "anthropic",   model: "claude-sonnet-4",    apiKeyField: "anthropicApiKey" },
  { type: "image", provider: "google",      model: "imagen-4-fast",      apiKeyField: "googleAiApiKey" },
  { type: "video", provider: "runway",      model: "gen-3-alpha",        apiKeyField: "runwayApiKey" },
  { type: "video", provider: "kling",       model: "kling-v2",           apiKeyField: "klingApiKey" },
  { type: "audio", provider: "elevenlabs",  model: "v2",                 apiKeyField: "elevenLabsApiKey" },
];
```

Pipeline-Agents fragen: "Welcher Service ist fuer diesen Typ konfiguriert?" und rufen die entsprechende API.

---

## Production Pipelines

### Text Pipeline (bestehend)

```
Outline → Writing (parallel) → Assembly → Image → Quality → Translation
```

| Phase | Agent | Beschreibung |
|-------|-------|-------------|
| outline | outline-architect | Section-Level Outline |
| writing | section-writer × N | Paralleles Schreiben |
| assembly | content-editor | Zusammenfuegen + Uebergaenge |
| image | image-generator | Hero Image via Imagen 4 |
| quality | seo-checker + reviewer | SEO + Brand (mit Retry) |
| translation | translator × N | Parallele Uebersetzung |

### Video Pipeline (geplant)

```
Script → Storyboard → Generate → Review → Subtitle → Thumbnail
```

| Phase | Agent | Beschreibung |
|-------|-------|-------------|
| script | video-scriptwriter | Video-Script aus Topic |
| storyboard | video-storyboard | Szenen-Breakdown mit Prompts |
| generate | video-generator | Externe AI aufrufen (Runway/Kling) |
| review | video-reviewer | Qualitaet + Brand-Check |
| subtitle | subtitle-generator | SRT aus Transcript generieren |
| thumbnail | image-generator | Thumbnail via Imagen 4 |

### Audio Pipeline (geplant)

```
Script → Generate Voice → Mix → Review → Transcript
```

| Phase | Agent | Beschreibung |
|-------|-------|-------------|
| script | audio-scriptwriter | Narrations-Script |
| generate | voice-generator | ElevenLabs / TTS aufrufen |
| mix | audio-mixer | Hintergrundmusik, Normalisierung |
| review | audio-reviewer | Qualitaet, Pacing, Aussprache |
| transcript | transcript-generator | Text-Transcript erstellen |

### Social Pipeline (geplant)

```
Repurpose → Format → Media → Review
```

Leitet Social Posts aus bestehendem Site/Media Content ab (`parentId`).

### Pipeline Types

```typescript
type PipelineType =
  | "strategy"              // Topic-Recherche
  | "production"            // Text-Artikel
  | "video_production"      // Video
  | "audio_production"      // Audio
  | "social_production"     // Social Repurposing
  | "update"                // Content-Refresh
  | "translation";          // Sprache hinzufuegen
```

---

## Content Index

### Unified Tracking

Der Content Index trackt ALLE Inhalte pro Projekt — unabhaengig von Typ, Plattform oder Herkunft.

```typescript
interface ContentIndex {
  projectId: string;
  lastSyncedAt: string;
  schemaVersion: number;
  entries: ContentIndexEntry[];
}

interface ContentIndexEntry {
  id: string;
  channel: "website" | "social" | "video" | "audio" | "podcast";
  source: "flowboost" | "external";
  status: ContentStatus;

  // Typ-spezifisch
  site?: SiteContentMeta;
  social?: SocialContentMeta;
  video?: VideoContentMeta;
  audio?: AudioContentMeta;

  // Verknuepfungen
  parentId?: string;
  articleId?: string;            // Legacy: Link zu ContentItem
  topicId?: string;

  // Timestamps
  createdAt: string;
  firstPublishedAt?: string;
  lastUpdatedAt?: string;
  lastSyncedAt: string;

  // Multi-Platform Status
  publications: Publication[];
}

interface Publication {
  platform: string;
  status: "queued" | "publishing" | "published" | "failed" | "retrying";
  ref?: string;
  url?: string;
  publishedAt?: string;
  lastAttemptAt?: string;
  retryCount: number;
  error?: string;
}
```

### Sync Service

Plattform-agnostisch via `ContentReader` Interface:

```typescript
interface ContentReader {
  getContentTree(): Promise<Map<string, { path: string; sha: string }>>
  readFile(path: string): Promise<{ content: string; sha: string }>
  readFiles(paths: string[]): Promise<Map<string, { content: string; sha: string }>>
}
```

- **Full Sync**: Liest alle Dateien, baut Index neu auf
- **Delta Sync**: Vergleicht SHAs, liest nur Geaenderte
- **Post-Delivery Update**: Kein API-Call noetig — Daten sind bekannt

---

## Template Engine

Templates definieren das Dateiformat pro Plattform — getrennt von Transport.

```typescript
interface SiteTemplate {
  transform(content: SiteContentData): TransformResult;
  constraints: SiteConstraints;
}

interface SocialTemplate {
  transform(content: SocialContentData): Record<string, unknown>;
  formatText(text: string, hashtags: string[]): string;
  constraints: SocialConstraints;
}
```

### Implementierte Templates

| Template | Status | Datei |
|----------|--------|-------|
| Astro (Markdown + YAML) | ✅ | `templates/site/astro.ts` |
| WordPress (HTML + Meta) | ⬜ Geplant | — |
| Shopify (HTML + Metafields) | ⬜ Geplant | — |
| Webflow (RichText JSON) | ⬜ Geplant | — |
| Social Templates | ⬜ Geplant | — |

---

## REST API Surface

Alle Endpoints unter `/customers/:cid/projects/:pid/`.

### Content CRUD

```
GET    /content                           # List (filter: type, status, lang, category)
POST   /content                           # Create (manuell, ausserhalb Pipeline)
GET    /content/:id                       # Detail + Versions
PUT    /content/:id                       # Metadata aktualisieren
DELETE /content/:id                       # Archivieren oder loeschen
```

### Lifecycle Transitions

```
POST   /content/:id/submit               # draft → review
POST   /content/:id/approve              # review → approved → deliver
POST   /content/:id/reject               # review → draft (mit Feedback)
POST   /content/:id/publish              # delivered → published
POST   /content/:id/update               # published → updating → re-deliver
POST   /content/:id/archive              # published → archived
POST   /content/:id/restore              # archived → draft
```

### Versions

```
GET    /content/:id/versions              # Alle Versionen
GET    /content/:id/versions/:vid         # Version Detail
POST   /content/:id/versions              # Neue Version (manueller Edit)
```

### Media

```
GET    /media                             # List (filter: type, source)
POST   /media/upload                      # Multipart Upload
POST   /media/generate                    # AI Generation Request
GET    /media/:id                         # Metadata + URLs
DELETE /media/:id                         # Loeschen
```

### Content Index

```
GET    /content-index                     # Gefiltert (channel, status, source, lang, platform)
GET    /content-index/:entryId            # Detail + optional Revisions
GET    /content-index/:entryId/revisions  # Revision History
PATCH  /content-index/:entryId            # Status manuell aendern
DELETE /content-index/:entryId            # Entry entfernen
POST   /content-index/sync               # Manuellen Sync triggern
```

### Bulk Operations

```
POST   /content/bulk/approve              # Body: { ids: [...] }
POST   /content/bulk/archive              # Body: { ids: [...] }
POST   /content/bulk/delete               # Body: { ids: [...] }
```

### Pipelines

```
POST   /pipeline/strategy                 # Topic-Recherche
POST   /pipeline/produce                  # Text-Produktion
POST   /pipeline/produce-video            # Video-Produktion
POST   /pipeline/produce-audio            # Audio-Produktion
POST   /pipeline/produce-social           # Social Repurposing
POST   /pipeline/update-content           # Content-Refresh
POST   /pipeline/runs/:runId/cancel       # Pipeline abbrechen
GET    /pipeline/runs                     # Alle Runs
GET    /pipeline/runs/:runId              # Run Detail
```

### Webhooks

```
POST   /webhooks/github                   # GitHub App Events
POST   /webhooks/wordpress                # WordPress Webhooks (geplant)
POST   /webhooks/shopify                  # Shopify Webhooks (geplant)
```

---

## Publish Queue + Token Management

### Publish Queue

Dateibasierte Queue (konsistent mit Store-Pattern):

```typescript
class PublishQueue {
  async enqueue(job: PublishJob): Promise<string>
  async dequeue(): Promise<PublishJob | null>
  async complete(jobId: string, result: PublishResult): Promise<void>
  async fail(jobId: string, error: string): Promise<void>
  async retry(jobId: string): Promise<void>
  async getDeadLetterJobs(): Promise<PublishJob[]>
  async process(): Promise<void>
}
```

Retry: Exponential Backoff (1s, 2s, 4s, 8s, 16s + Jitter). Dead Letter Queue nach 5 Versuchen.

### Token Management

OAuth Tokens fuer Social Plattformen (NICHT fuer AI-Services — die nutzen API Keys):

```typescript
class TokenManager {
  async getToken(customerId: string, platform: string): Promise<string>
  async refreshToken(customerId: string, platform: string): Promise<string>
  async storeToken(customerId: string, platform: string, data: OAuthTokenData): Promise<void>
  async revokeToken(customerId: string, platform: string): Promise<void>
  async ensureFresh(customerId: string, platform: string): Promise<string>
}
```

| Plattform | Access Token Lifetime | Refresh |
|-----------|----------------------|---------|
| GitHub App | 1 Stunde | Neues JWT |
| LinkedIn | Variabel | Refresh vor Ablauf |
| Instagram | 60 Tage | Refresh zwischen 24h-60d |
| TikTok | Variabel | Refresh Token |
| X/Twitter | 2 Stunden | `offline.access` Scope |
| Facebook | 60 Tage | Nie-ablaufende Page Tokens moeglich |

---

## Projekt-Konfiguration

### Connector Config

```typescript
interface Project {
  // ... bestehende Felder ...

  // V1 (backward-kompatibel, aktuell aktiv)
  connector: ConnectorConfig;

  // V3 (optional, nimmt Vorrang wenn gesetzt)
  connectors?: {
    site: SiteConnectorConfig;
    media?: MediaConnectorConfig[];
    social?: SocialChannelConfig[];
  };
}

type SiteConnectorConfig =
  | { type: "github"; github: GitHubConnectorFields }
  | { type: "wordpress"; wordpress: WordPressConnectorFields }
  | { type: "shopify"; shopify: ShopifyConnectorFields }
  | { type: "webflow"; webflow: WebflowConnectorFields }
  | { type: "filesystem"; filesystem: FilesystemConnectorFields };

interface MediaConnectorConfig {
  platform: "youtube" | "vimeo" | "spotify" | "apple_podcasts" | "soundcloud";
  enabled: boolean;
  accountId: string;
  accountName: string;
  autoPublish: boolean;
}

interface SocialChannelConfig {
  platform: SocialPlatform;
  enabled: boolean;
  accountId: string;
  accountName: string;
  autoPublish: boolean;
  syndicationDelay?: number;     // Tage nach Site-Publish
}
```

### Pipeline Settings

```typescript
interface PipelineSettings {
  // Bestehend
  defaultModel: string;
  maxRetriesPerPhase: number;
  maxBudgetPerArticle: number;
  imagenModel: string;

  // NEU: External AI
  videoModel?: string;           // "runway-gen3" | "kling-v2"
  audioModel?: string;           // "elevenlabs-v2" | "playht"
  preferredVoice?: string;       // ElevenLabs Voice ID

  // NEU: Budgets pro Typ
  maxBudgetPerVideo?: number;
  maxBudgetPerAudio?: number;
  maxBudgetPerSocialPost?: number;
}
```

---

## Implementierungs-Roadmap

### Bereits implementiert (V2)

| Phase | Scope | Status |
|-------|-------|--------|
| **1a** | Content Index Model + Store + Versioning | ✅ Done |
| **1b** | GitHub Content Service (Read API) | ✅ Done |
| **1c** | Sync Service + GitHub Reader | ✅ Done |
| **1d** | Async Webhook (push event) | ✅ Done |
| **1e** | Webhook Router (zentral, idempotent) | ✅ Done |
| **1f** | Content Index API Endpoints | ✅ Done |
| **2a** | Template Engine (Interface + Astro Template) | ✅ Done |
| **2b** | SiteConnector Interface + GitHub/Filesystem | ✅ Done |
| **2c** | Approve/Publish Endpoints (plattform-agnostisch) | ✅ Done |

### Phase 0: Foundation Fixes (naechster Schritt)

Kritische Schulden schliessen bevor neue Features.

| Step | Scope | Aufwand |
|------|-------|---------|
| **0.1** | ContentItem Type (erweitert Article) | S |
| **0.2** | ContentStore (erweitert ArticleStore, Version-Numbering) | M |
| **0.3** | Content CRUD API (create, update, delete) | M |
| **0.4** | Review/Reject Workflow API | S |
| **0.5** | SiteConnector.update() + unpublish() | M |
| **0.6** | Content Index PATCH/DELETE Endpoints | S |
| **0.7** | Alte V1 Connector-Dateien aufraumen | S |
| **0.8** | Migration Script (Article → ContentItem) | M |

### Phase 1: Media Asset Management

| Step | Scope | Aufwand |
|------|-------|---------|
| **1.1** | MediaAsset Type + MediaAssetStore | M |
| **1.2** | Media Upload Endpoint (Multipart) | M |
| **1.3** | MediaAssetRef in ContentVersion | S |
| **1.4** | Thumbnail-Generierung | M |
| **1.5** | Media Gallery UI (Frontend) | L |

### Phase 2: Video Content Pipeline

| Step | Scope | Aufwand |
|------|-------|---------|
| **2.1** | VideoVersionMeta Type | S |
| **2.2** | Video Pipeline Phases + Agents | L |
| **2.3** | AI Service Registry + externe API Integration | L |
| **2.4** | MCP Tool: flowboost_generate_video | M |
| **2.5** | Video Vorschau UI (Frontend) | M |

### Phase 3: Audio Content Pipeline

| Step | Scope | Aufwand |
|------|-------|---------|
| **3.1** | AudioVersionMeta Type | S |
| **3.2** | Audio Pipeline Phases + Agents | M |
| **3.3** | MCP Tool: flowboost_generate_audio | M |
| **3.4** | Audio Player UI (Frontend) | M |

### Phase 4: Media Connectors

| Step | Scope | Aufwand |
|------|-------|---------|
| **4.1** | MediaConnector Interface | S |
| **4.2** | YouTube Connector | L |
| **4.3** | Spotify/Podcast Connector | L |
| **4.4** | Content Index Video/Audio Channel | M |

### Phase 5: Social Pipeline + Connectors

| Step | Scope | Aufwand |
|------|-------|---------|
| **5.1** | Social Production Pipeline | L |
| **5.2** | Social Templates | L |
| **5.3** | Social Connectors (LI, IG, X, TT, FB) | XL |
| **5.4** | Publish Queue (file-based) | M |
| **5.5** | Token Manager (encrypted + refresh) | M |
| **5.6** | Social Content UI (Frontend) | L |

### Phase 6: Advanced Features

| Step | Scope | Aufwand |
|------|-------|---------|
| **6.1** | Bulk Operations API | S |
| **6.2** | CDN Upload (Cloudflare R2) | M |
| **6.3** | Conflict Resolution bei Sync | M |
| **6.4** | Content Update Pipeline (decaying articles refreshen) | L |
| **6.5** | Multi-Site Connector Config aktivieren (V3) | M |

**Legende**: S = Small (< 1 Tag), M = Medium (1-2 Tage), L = Large (3-5 Tage), XL = Extra Large (1+ Woche)

---

## Datei-Uebersicht

### Implementierte Dateien

```
backend/src/
├── models/
│   ├── types.ts                          # ✅ Content Index Types, Article, Project
│   └── content-index.ts                  # ✅ ContentIndexStore + Revisions
├── services/
│   ├── github.ts                         # ✅ GitHub API (PR, Merge, Delete)
│   ├── github-content.ts                 # ✅ GitHub Read API (Trees + Contents)
│   └── sync.ts                           # ✅ SyncService + ContentReader Interface
├── connectors/
│   ├── site/
│   │   ├── types.ts                      # ✅ SiteConnector, WriteResult, PublishResult
│   │   ├── factory.ts                    # ✅ createSiteConnector()
│   │   ├── github.ts                     # ✅ GitHubSiteConnector
│   │   └── filesystem.ts                 # ✅ FilesystemSiteConnector
│   ├── readers/
│   │   └── github.ts                     # ✅ GitHubContentReader
│   └── templates/
│       ├── types.ts                      # ✅ Template Interfaces
│       └── site/astro.ts                 # ✅ Astro/Markdown Template
├── utils/
│   └── frontmatter.ts                    # ✅ Markdown Frontmatter Parser
└── api/routes/
    ├── articles.ts                       # ✅ Approve/Publish (SiteConnector)
    ├── webhooks.ts                       # ✅ Webhook Router (async, idempotent)
    ├── content-index.ts                  # ✅ Content Index API
    └── server.ts                         # ✅ Route Registration
```

### Geplante Dateien (Phase 0-6)

```
backend/src/
├── models/
│   ├── types.ts                          # Phase 0: ContentItem, ContentVersion, MediaAsset
│   ├── content.ts                        # Phase 0: ContentStore (erweitert ArticleStore)
│   └── media.ts                          # Phase 1: MediaAssetStore
├── services/
│   ├── media.ts                          # Phase 1: MediaService (ingest, thumbnail)
│   ├── ai-registry.ts                    # Phase 2: AI Service Registry
│   ├── publish-queue.ts                  # Phase 5: Publish Queue
│   └── token-manager.ts                  # Phase 5: Token Manager
├── connectors/
│   ├── site/
│   │   ├── wordpress.ts                  # Phase 6.5: WordPressSiteConnector
│   │   ├── shopify.ts                    # Phase 6.5: ShopifySiteConnector
│   │   └── webflow.ts                    # Phase 6.5: WebflowSiteConnector
│   ├── media/
│   │   ├── types.ts                      # Phase 4: MediaConnector Interface
│   │   ├── youtube.ts                    # Phase 4: YouTubeMediaConnector
│   │   └── spotify.ts                    # Phase 4: SpotifyMediaConnector
│   ├── social/
│   │   ├── types.ts                      # Phase 5: SocialConnector Interface
│   │   ├── linkedin.ts                   # Phase 5
│   │   ├── instagram.ts                  # Phase 5
│   │   ├── tiktok.ts                     # Phase 5
│   │   ├── x.ts                          # Phase 5
│   │   └── facebook.ts                   # Phase 5
│   └── templates/
│       ├── site/
│       │   ├── wordpress.ts              # Phase 6.5
│       │   ├── shopify.ts                # Phase 6.5
│       │   └── webflow.ts                # Phase 6.5
│       └── social/
│           ├── linkedin.ts               # Phase 5
│           ├── instagram.ts              # Phase 5
│           ├── tiktok.ts                 # Phase 5
│           ├── x.ts                      # Phase 5
│           └── facebook.ts              # Phase 5
├── pipeline/
│   ├── video/run.ts                      # Phase 2: Video Pipeline
│   └── audio/run.ts                      # Phase 3: Audio Pipeline
└── api/routes/
    ├── content.ts                        # Phase 0: Content CRUD + Lifecycle
    └── media.ts                          # Phase 1: Media Upload/Generate
```

---

## Offene Entscheidungen

| # | Frage | Empfehlung | Status |
|---|-------|------------|--------|
| 1 | Coolify Auto-Deploy bei Push auf main? | Ja, Coolify native GitHub Webhook | Offen |
| 2 | OAuth Tokens wo speichern? | Encrypted JSON im Data-Dir | Offen |
| 3 | Media-Assets CDN? | Cloudflare R2 (S3-kompatibel) | Offen |
| 4 | Video AI Provider? | Runway Gen-3 (bester Quality/Price) | Offen |
| 5 | Audio AI Provider? | ElevenLabs (bester TTS) | Offen |
| 6 | Squash Merge fuer PRs? | Ja (1 Commit = clean history) | Empfohlen |
| 7 | Syndication Delay? | 3 Tage nach Site-Publish | Empfohlen |
| 8 | Queue: File-based oder Redis? | File-based (konsistent) | Empfohlen |
| 9 | AI-Content Disclosure? | Immer setzen | Pflicht |
| 10 | Article → ContentItem Migration? | Backward-compat + Script | Phase 0 |
| 11 | V1 connector vs V3 connectors? | V1 behalten bis Phase 6.5 | Empfohlen |
