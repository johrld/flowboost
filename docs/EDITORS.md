# Content Editors

## Overview

Each content type has its own **platform-native editor** that matches the look and feel of the target platform. The editor is selected automatically based on the ContentType ID.

```
contentType.id      →  Editor Component                                          Status
──────────────────────────────────────────────────────────────────────────────────────────
"blog-post"         →  Article Editor      (TipTap WYSIWYG + Frontmatter)        ✅ Done
"linkedin-post"     →  LinkedIn Editor     (Rich text + side-by-side preview)     ✅ Done
"instagram-post"    →  Instagram Editor    (Image-first + caption)               🔧 Prepared
"x-post"            →  X Editor           (280ch + tweet preview)                🔧 Prepared
"tiktok-post"       →  TikTok Editor      (Script sections + caption)            🔧 Prepared
"newsletter"        →  Newsletter Editor   (Subject + sections + email preview)  🔧 Prepared
*                   →  Generic Editor      (Dynamic form from ContentType fields) 🔧 Prepared
```

> **✅ Done** = Fully functional, tested, production-ready
> **🔧 Prepared** = Component exists with UI structure, needs visual polish and testing

## Editor Architecture

All editors share the same shell:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Draft  LinkedIn Post  v2  Updated: 28.3.2026  [Save] [Submit ▼]│  Header
├──────────────────────────────────────┬──────────────────────────────┤
│                                      │  [Metadata] [Media] [AI Chat]│
│                                      │                              │
│         Editor Component             │     Sidebar                  │
│    (platform-specific)               │  Version, Scheduling,        │
│                                      │  Media Library,              │
│                                      │  AI Refinement Chat          │
│                                      │                              │
└──────────────────────────────────────┴──────────────────────────────┘
```

### Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| `ContentDetailLayout` | `components/content-detail-layout.tsx` | Shell: header + editor + sidebar (Metadata/Media/Chat tabs) |
| `ContentChat` | `components/content-chat.tsx` | AI refinement sidebar — receives full campaign context |
| `SocialMediaPanel` | `app/content/[id]/page.tsx` | Media library in sidebar — drag images to editor |
| `SmartActionButton` | `app/content/[id]/page.tsx` | Context-aware action: Submit → Approve → Publish on LinkedIn |

### Mode Detection

The page detects the editor mode from the content type:

```typescript
const isArticle = data.type === "article" || data.type === "guide";
const editorMode = isArticle ? "markdown" : "json";
```

- **Markdown mode**: Loads `.md` files, renders TipTap WYSIWYG editor
- **JSON mode**: Loads `.json` files, renders platform-specific editor

## LinkedIn Editor ✅

**File:** `components/editors/linkedin-editor.tsx`

```
┌──────────────────────────────┬─────────────────────────────┐
│  [B][I][S] [•][1.] [↩][↪]  📋│  Post Preview    [📱][🖥]  │
├──────────────────────────────┤                             │
│                              │  👤 Alex Demo               │
│  Write your post...         │     Content Manager          │
│                              │     12h · 🌐                │
│                              │                             │
│  847/3,000                   │  Post text here...          │
│                              │  ─ ─ ─ ─ ─ ─ ─ ─  ...more │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │  Text below the fold...     │
│  │ Add images to post  │    │                             │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │  [Image Grid]               │
│                              │                             │
│  # Hashtags          0/5    │  👍 57   24 comments         │
│  # Add hashtag              │  Like Comment Repost Send    │
└──────────────────────────────┴─────────────────────────────┘
```

### Features
- **TipTap editor** with Bold, Italic, Strikethrough, Lists, Undo/Redo
- **Unicode formatting** on copy — bold becomes 𝗕𝗼𝗹𝗱, italic becomes 𝘐𝘵𝘢𝘭𝘪𝘤 (LinkedIn doesn't support HTML)
- **Live preview** with LinkedIn's exact font stack, 3-line "...more" truncation via CSS line-clamp
- **Image gallery** — upload, drag from media library, LinkedIn grid layout (1/2/3+ images)
- **Hashtag chips** — add/remove, max 5
- **Desktop/Mobile toggle** for preview width
- **Copy button** in toolbar — copies with Unicode formatting

### LinkedIn Image Grid
- 1 image: full width
- 2 images: 50/50 side by side
- 3+ images: large left (2/3), stacked right (1/3), "+N" overlay on 4+

## X (Twitter) Editor 🔧

**File:** `components/editors/x-editor.tsx`

- Simple textarea (no formatting — X doesn't support it)
- **Circular SVG character counter** — blue → yellow (260) → red (280+)
- Tweet-style preview with avatar, handle, engagement metrics
- Copy button

## Instagram Editor 🔧

**File:** `components/editors/instagram-editor.tsx`

- **Image primary** — upload/generate area at top
- Caption textarea (2,200 chars)
- Hashtag input (max 15)
- Instagram-style preview: photo card with avatar, image, like/comment icons

## TikTok Editor 🔧

**File:** `components/editors/tiktok-editor.tsx`

- **Video script sections**: Hook (3s) → Setup (10s) → Value → Payoff (5s)
- Caption textarea (4,000 chars)
- Hashtag input (max 5)
- TikTok-style preview: vertical 9:16 black card with caption overlay

## Newsletter Editor 🔧

**File:** `components/editors/newsletter-editor.tsx`

- Subject line (60 char counter)
- Preview text (120 chars)
- **Sections** with drag-and-drop reorder (heading + body per section)
- **CTA editor** (text + button label + URL)
- Email preview card (inbox header + body + CTA button)

## Generic Editor 🔧

**File:** `components/editors/generic-editor.tsx`

Dynamic form from ContentType fields. Used for custom and connector-imported types.

| FieldType | UI Component |
|-----------|-------------|
| `short-text` | Input + char counter |
| `long-text` | Textarea + char counter |
| `markdown` | Monospace textarea |
| `image` | Image prompt display |
| `faq` | Question/answer pairs |
| `cta` | 3 inputs (text, label, URL) |
| `list` | Tag chips (add/remove) |
| `number` | Number input |
| `boolean` | Checkbox |

## Article Editor ✅

**File:** `app/content/[id]/page.tsx` (inline, not extracted)

The original editor — TipTap WYSIWYG with:
- Frontmatter parsing (title, description, category, tags, keywords, author)
- Language tabs (multi-language support)
- FAQ section with drag-and-drop reorder
- Hero image (upload, generate, browse from media library)
- Full article preview in new tab

## AI Refinement Chat

**File:** `components/content-chat.tsx`

Sidebar chat panel available in **every** editor. The AI receives full context:

```
1. Project Brief + Brand Voice (always, injected by backend)
2. Flow Briefing + Source Summaries + Chat Distillation (from linked Flow)
3. Current Content (what's in the editor right now)
4. ContentType Guidelines (writing rules for this format)
```

When the AI suggests changes, it returns a JSON block:
```json
{"updates": {"text": "New text...", "hashtags": ["#new"]}}
```

An "Apply Changes" button appears in the chat to merge updates into the editor.

## Version Management

- **Save** always overwrites the current draft version (no version bloat)
- **"Save as new version"** explicitly creates a checkpoint
- **Pipeline** always creates a new version
- **Version selector** in sidebar with delete option (confirmation dialog)
- Published versions cannot be deleted

## Status Management

Status is controlled via the **Smart Action Button** (top right):

| Current Status | Primary Action | Dropdown Options |
|---------------|---------------|-----------------|
| Draft | Submit for Review | Submit, Approve, Publish on LinkedIn |
| In Review | Approve | Approve, Publish, Back to Draft |
| Approved | Publish on LinkedIn | Publish, Back to Draft |
| Published | Published (badge) | Archive, Back to Draft |
| Archived | Restore | Restore to Draft |

The button label adapts to the platform: "Publish on LinkedIn", "Publish on Instagram", etc.
