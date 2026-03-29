"use client";

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { marked } from "marked";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContentStatusBadge, ContentTypeBadge } from "@/components/status-badge";
import { ContentDetailLayout } from "@/components/content-detail-layout";
import { ContentChat } from "@/components/content-chat";
import { TiptapEditor } from "@/components/tiptap-editor";
import { useProject } from "@/lib/project-context";
import {
  getContentItem,
  getContentFile,
  getContentJson,
  getContentTypes,
  deleteContentVersion,
  updateContent,
  createContentVersion,
  submitContent,
  approveContent,
  rejectContent,
  publishContent,
  requestContentUpdate,
  archiveContent,
  restoreContent,
  getTopics,
  getContentMedia,
  getMedia,
  getMediaFileUrl,
  getMediaThumbnailUrl,
  generateHeroImage,
  uploadContentMedia,
  setHeroImage,
  deleteContentMedia,
  linkMediaToContent,
  reconcileContentMedia,
} from "@/lib/api";
import type { ContentTypeDefinition } from "@/lib/api";
import { LinkedInEditor } from "@/components/editors/linkedin-editor";
import { XEditor } from "@/components/editors/x-editor";
import { InstagramEditor } from "@/components/editors/instagram-editor";
import { TikTokEditor } from "@/components/editors/tiktok-editor";
import { NewsletterEditor } from "@/components/editors/newsletter-editor";
import { GenericEditor } from "@/components/editors/generic-editor";
import { ShopwareEditor } from "@/components/editors/shopware-editor";
import type { ContentItem, ContentItemStatus, ContentVersion, MediaAsset, Topic } from "@/lib/types";
import { MediaPicker } from "@/components/media-picker";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Save,
  Check,
  ChevronDown,
  ImageIcon,
  Plus,
  Trash2,
  Upload,
  Play,
  AlertTriangle,
  Send,
  Archive,
  RotateCcw,
  Loader2,
  X,
  CalendarIcon,
  GripVertical,
  Sparkles,
  Eye,
} from "lucide-react";
import Link from "next/link";

/** Sortable FAQ item */
function SortableFaqItem({
  id,
  index,
  faq,
  onUpdate,
  onRemove,
}: {
  id: string;
  index: number;
  faq: { question: string; answer: string };
  onUpdate: (field: "question" | "answer", value: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-3 items-start rounded-md border p-3 bg-background"
    >
      <button
        type="button"
        className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Badge variant="outline" className="text-xs shrink-0 mt-1">
        Q{index + 1}
      </Badge>
      <div className="flex-1 space-y-2">
        <Input
          placeholder="Question"
          value={faq.question}
          onChange={(e) => onUpdate("question", e.target.value)}
          className="text-sm"
        />
        <Textarea
          placeholder="Answer"
          value={faq.answer}
          onChange={(e) => onUpdate("answer", e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onRemove}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

/** FAQ section with drag-and-drop reordering */
function FaqSection({
  faqs,
  setFaqs,
}: {
  faqs: { question: string; answer: string }[];
  setFaqs: (items: { question: string; answer: string }[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Stable IDs for sortable items
  const faqIds = faqs.map((_, i) => `faq-${i}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = faqIds.indexOf(active.id as string);
    const newIndex = faqIds.indexOf(over.id as string);
    setFaqs(arrayMove(faqs, oldIndex, newIndex));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">FAQ ({faqs.length})</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {faqs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No FAQ items yet. Add questions for rich snippets.
          </p>
        )}
        {faqs.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={faqIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <SortableFaqItem
                    key={faqIds[i]}
                    id={faqIds[i]}
                    index={i}
                    faq={faq}
                    onUpdate={(field, value) => {
                      const updated = [...faqs];
                      updated[i] = { ...updated[i], [field]: value };
                      setFaqs(updated);
                    }}
                    onRemove={() => setFaqs(faqs.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}

/** Parse YAML frontmatter into metadata fields */
function parseFrontmatter(fm: string) {
  const getField = (key: string): string => {
    const m = fm.match(new RegExp(`^${key}:\\s*"(.+?)"\\s*$`, "m"));
    return m?.[1] ?? "";
  };

  const getList = (key: string): string[] => {
    const idx = fm.indexOf(`${key}:`);
    if (idx === -1) return [];
    const after = fm.slice(idx + key.length + 1);
    // Inline list: key: [a, b, c]  or  key: value (single)
    const inlineMatch = after.match(/^\s*\[(.+?)\]/);
    if (inlineMatch) return inlineMatch[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    // Block list
    const lines = after.split("\n");
    const items: string[] = [];
    for (const line of lines.slice(1)) {
      if (/^\S/.test(line) && line.includes(":")) break;
      const m = line.match(/^\s+-\s+(.+)/);
      if (m) items.push(m[1].replace(/^["']|["']$/g, "").trim());
    }
    return items;
  };

  // Parse FAQ block
  const faqs: { question: string; answer: string }[] = [];
  const faqIdx = fm.indexOf("faq:");
  if (faqIdx !== -1) {
    const lines = fm.slice(faqIdx + 4).split("\n");
    let q = "", a = "";
    for (const line of lines) {
      if (/^\S/.test(line) && line.includes(":")) break;
      const qMatch = line.match(/^\s+-\s+question:\s*"(.+?)"\s*$/);
      const aMatch = line.match(/^\s+answer:\s*"(.+?)"\s*$/);
      if (qMatch) { if (q && a) faqs.push({ question: q, answer: a }); q = qMatch[1]; a = ""; }
      else if (aMatch) { a = aMatch[1]; }
    }
    if (q && a) faqs.push({ question: q, answer: a });
  }

  return {
    title: getField("title"),
    description: getField("description"),
    category: fm.match(/^category:\s*(.+)$/m)?.[1]?.trim() ?? "",
    tags: getList("tags").join(", "),
    keywords: getList("keywords").join(", "),
    author: getField("author") || (fm.match(/^author:\s*(.+)$/m)?.[1]?.trim() ?? ""),
    faqs,
  };
}

/** Strip YAML frontmatter from markdown, return body only */
function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n*/, "");
}

/** Rebuild YAML frontmatter from sidebar fields */
function buildFrontmatter(
  meta: { title: string; description: string; category: string; tags: string; keywords: string; author: string; faqs: { question: string; answer: string }[] },
  lang: string,
): string {
  const lines: string[] = ["---"];
  lines.push(`title: "${meta.title}"`);
  if (meta.description) lines.push(`description: "${meta.description}"`);
  if (meta.author) lines.push(`author: "${meta.author}"`);
  if (meta.category) lines.push(`category: ${meta.category}`);
  if (meta.tags) {
    const items = meta.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (items.length > 0) {
      lines.push("tags:");
      items.forEach((t) => lines.push(`  - ${t}`));
    }
  }
  if (meta.keywords) {
    const items = meta.keywords.split(",").map((k) => k.trim()).filter(Boolean);
    if (items.length > 0) {
      lines.push("keywords:");
      items.forEach((k) => lines.push(`  - ${k}`));
    }
  }
  lines.push(`lang: ${lang}`);
  if (meta.faqs.length > 0) {
    lines.push("faq:");
    meta.faqs.forEach((f) => {
      lines.push(`  - question: "${f.question}"`);
      lines.push(`    answer: "${f.answer}"`);
    });
  }
  lines.push("---");
  return lines.join("\n") + "\n";
}

interface LangMeta {
  title: string;
  description: string;
  tags: string;
  keywords: string;
  category: string;
  author: string;
  faqs: { question: string; answer: string }[];
}

export default function ContentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { customerId, projectId, categories, authors, languages: projectLanguages, loading: projectLoading } = useProject();

  const [item, setItem] = useState<ContentItem | null>(null);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Per-language metadata parsed from frontmatter
  const [metaByLang, setMetaByLang] = useState<Record<string, LangMeta>>({});

  // Editor content per language (body only, no frontmatter)
  const [activeLang, setActiveLang] = useState("de");
  const [editorContent, setEditorContent] = useState<Record<string, string>>({});
  const [originalContent, setOriginalContent] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [versionPopoverOpen, setVersionPopoverOpen] = useState(false);
  const [deleteVersionId, setDeleteVersionId] = useState<{ id: string; number: number } | null>(null);

  // Topic scheduling
  const [topic, setTopic] = useState<Topic | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");

  // Hero image / media gallery
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const mediaPickerResolveRef = useRef<((url: string | null) => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor mode: "markdown" for articles, "json" for social/email/custom
  const [editorMode, setEditorMode] = useState<"markdown" | "json">("markdown");
  const [jsonValues, setJsonValues] = useState<Record<string, unknown>>({});
  const [originalJsonValues, setOriginalJsonValues] = useState<Record<string, unknown>>({});
  const [contentTypeId, setContentTypeId] = useState<string | null>(null);
  const [contentTypeDef, setContentTypeDef] = useState<ContentTypeDefinition | null>(null);

  // Track which languages the user actually edited (vs TiptapEditor roundtrip noise)
  const userEditedLangs = useRef<Set<string>>(new Set());

  // Derived sidebar fields from active language
  const langMeta = metaByLang[activeLang];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [author, setAuthor] = useState("");
  const faqs = langMeta?.faqs ?? [];
  const setFaqs = (items: { question: string; answer: string }[]) =>
    setMetaByLang((prev) => ({ ...prev, [activeLang]: { ...prev[activeLang], faqs: items } }));

  // Sync sidebar fields when language changes
  useEffect(() => {
    if (!langMeta) return;
    setTitle(langMeta.title);
    setDescription(langMeta.description);
    setCategory(langMeta.category);
  }, [activeLang, langMeta]);

  // Load content item
  const loadItem = useCallback(async () => {
    if (!customerId || !projectId) return;
    setLoading(true);
    try {
      const data = await getContentItem(customerId, projectId, id);
      setItem(data);
      setVersions(data.versions ?? []);

      // Determine editor mode from content type
      const isMarkdown = data.type === "article" || data.type === "guide";
      const detectedMode = isMarkdown ? "markdown" : "json";
      setEditorMode(detectedMode);

      // Load content type definition
      if (!isMarkdown) {
        try {
          const types = await getContentTypes(customerId!, projectId!);
          // Use stored contentTypeId, or derive from type+category (legacy compat)
          const ctId = (data as { contentTypeId?: string }).contentTypeId
            ?? (data.type === "social_post" ? `${data.category ?? "linkedin"}-post`
              : data.type === "newsletter" ? "newsletter"
              : "blog-post");
          const ct = types.find((t) => t.id === ctId);
          if (ct) {
            setContentTypeId(ctId);
            setContentTypeDef(ct);
          }
        } catch { /* ignore */ }
      }

      // Load topic
      if (data.topicId) {
        try {
          const topics = await getTopics(customerId, projectId);
          const t = topics.find((tp) => tp.id === data.topicId);
          if (t) setTopic(t);
        } catch { /* ignore */ }
      }

      // Use content item's own scheduledDate
      if (data.scheduledDate) {
        const [d, time] = data.scheduledDate.includes("T")
          ? data.scheduledDate.split("T")
          : [data.scheduledDate, ""];
        setSchedDate(d);
        setSchedTime(time);
      }

      // Load media assets
      try {
        const media = await getContentMedia(customerId, projectId, id);
        setMediaAssets(media.assets);
      } catch { /* ignore */ }

      // Load editor content from latest version's markdown files
      if (data.versions && data.versions.length > 0) {
        const latest = data.versions[data.versions.length - 1];
        setActiveVersionId(latest.id);
        await loadVersionContent(latest, data, detectedMode);
        setAuthor(data.author ?? "");
      } else {
        // No versions — initialize empty editor with default language
        setTitle(data.title);
        setDescription(data.description ?? "");
        setCategory(data.category ?? "");
        setAuthor(data.author ?? "");

        if (detectedMode === "markdown") {
          // Start with empty editor in project default language
          const defaultLang = "en";
          setEditorContent({ [defaultLang]: "" });
          setMetaByLang({ [defaultLang]: { title: "", description: "", category: data.category ?? "", tags: "", keywords: "", author: data.author ?? "", faqs: [] } });
          setActiveLang(defaultLang);
          setTitle("");
        }
      }
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId, id]);

  // Shared helper: load a version's files into the editor
  const loadVersionContent = useCallback(async (version: ContentVersion, data: ContentItem, mode?: "markdown" | "json") => {
    // For JSON content types, load JSON instead of markdown
    const effectiveMode = mode ?? editorMode;
    if (effectiveMode === "json") {
      try {
        const jsonData = await getContentJson(customerId!, projectId!, id, version.id, version.languages[0]?.lang ?? "de");
        setJsonValues(jsonData);
        setOriginalJsonValues(jsonData);
      } catch {
        setJsonValues({});
        setOriginalJsonValues({});
      }
      return; // Skip markdown loading
    }

    const rawContent: Record<string, string> = {};
    await Promise.all(
      version.languages.map(async (lang) => {
        try {
          rawContent[lang.lang] = await getContentFile(
            customerId!, projectId!, id, version.id, lang.lang,
          );
        } catch {
          rawContent[lang.lang] = "";
        }
      }),
    );

    const allMeta: Record<string, LangMeta> = {};
    const bodyContent: Record<string, string> = {};
    for (const lang of version.languages) {
      const md = rawContent[lang.lang] ?? "";
      const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        allMeta[lang.lang] = parseFrontmatter(fmMatch[1]);
      } else {
        allMeta[lang.lang] = { title: lang.title, description: "", category: data.category ?? "", tags: "", keywords: "", author: data.author ?? "", faqs: [] };
      }
      bodyContent[lang.lang] = stripFrontmatter(md) || `# ${lang.title}\n\n*No content*`;
    }
    setMetaByLang(allMeta);
    setEditorContent(bodyContent);
    setOriginalContent(bodyContent);
    userEditedLangs.current = new Set();

    if (version.languages.length > 0) {
      setActiveLang(version.languages[0].lang);
    }
  }, [customerId, projectId, id, editorMode]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  // Switch to a different version
  const switchVersion = useCallback(async (versionId: string) => {
    if (!item || versionId === activeVersionId) return;
    const version = versions.find((v) => v.id === versionId);
    if (!version) return;
    setActiveVersionId(versionId);
    await loadVersionContent(version, item);
  }, [item, versions, activeVersionId, loadVersionContent]);

  // Body dirty = user explicitly edited at least one language
  const bodyDirty = userEditedLangs.current.size > 0;

  // Save metadata + body (creates new version if body changed)
  const handleSave = async () => {
    if (!item) return;

    // JSON editor mode — save structured content
    if (editorMode === "json") {
      setSaving(true);
      try {
        const lang = item.versions?.[item.versions.length - 1]?.languages?.[0]?.lang ?? "de";
        await createContentVersion(customerId!, projectId!, id, {
          [lang]: JSON.stringify(jsonValues, null, 2),
        }, "user");
        setOriginalJsonValues(jsonValues);
        await loadItem();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      // 1. Always save metadata
      const updated = await updateContent(customerId, projectId, item.id, {
        title,
        description: description || undefined,
        category: category || undefined,
        author: author || undefined,
      });
      setItem({ ...item, ...updated });

      // 2. Reconcile inline media usage (extract asset IDs from all editor content)
      const allContent = Object.values(editorContent).join("\n");
      const mediaUrlPattern = /\/media\/([0-9a-f-]{36})\/file/g;
      const inlineAssetIds = [...new Set([...allContent.matchAll(mediaUrlPattern)].map((m) => m[1]))];
      await reconcileContentMedia(customerId, projectId, item.id, inlineAssetIds);

      // 3. If body changed, create new version
      if (bodyDirty) {
        const files: Record<string, string> = {};
        for (const lang of Object.keys(editorContent)) {
          const meta = metaByLang[lang] ?? { title, description, category, tags: "", keywords: "", faqs: [] };
          const fm = buildFrontmatter(
            { title: lang === activeLang ? title : meta.title, description: lang === activeLang ? description : meta.description, category: lang === activeLang ? category : meta.category, tags: meta.tags, keywords: meta.keywords, author: lang === activeLang ? author : meta.author, faqs: meta.faqs },
            lang,
          );
          files[lang] = fm + editorContent[lang];
        }
        await createContentVersion(customerId, projectId, item.id, files);
        userEditedLangs.current = new Set();
        await loadItem(); // reload to show new version
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  // Lifecycle actions
  const handleAction = async (action: string) => {
    if (!item) return;
    setActionLoading(action);
    try {
      switch (action) {
        case "submit":
          await submitContent(customerId, projectId, item.id);
          break;
        case "approve":
          await approveContent(customerId, projectId, item.id);
          break;
        case "reject":
          await rejectContent(customerId, projectId, item.id);
          break;
        case "publish":
          await publishContent(customerId, projectId, item.id);
          break;
        case "update":
          await requestContentUpdate(customerId, projectId, item.id);
          break;
        case "archive":
          await archiveContent(customerId, projectId, item.id);
          break;
        case "restore":
          await restoreContent(customerId, projectId, item.id);
          break;
      }
      await loadItem();
    } finally {
      setActionLoading(null);
    }
  };

  // ── Unsaved changes warning ──────────────────────────────────────
  const hasChangesRef = useRef(false);
  const bodyDirtyForEffect = userEditedLangs.current.size > 0;
  hasChangesRef.current = bodyDirtyForEffect || (item
    ? title !== (item.title ?? "") || description !== (item.description ?? "") || category !== (item.category ?? "")
    : false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── Cmd+S / Ctrl+S shortcut ─────────────────────────────────────
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasChangesRef.current) {
          handleSaveRef.current();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Preview in new tab ─────────────────────────────────────────
  const handlePreview = useCallback(() => {
    const md = editorContent[activeLang];
    if (!md) return;
    const meta = metaByLang[activeLang];
    const title = meta?.title || item?.title || "Preview";
    const description = meta?.description || item?.description || "";
    const authorName = authors.find((a) => a.id === meta?.author)?.name ?? meta?.author ?? "";
    const keywords = meta?.keywords ?? "";
    const faqs = meta?.faqs ?? [];
    const heroUrl = item?.heroImageId
      ? getMediaFileUrl(customerId, projectId,item.heroImageId)
      : "";
    const version = versions.find((v) => v.id === activeVersionId) ?? versions[versions.length - 1];
    const langs = version?.languages?.map((l) => l.lang) ?? [activeLang];
    const datePublished = item?.createdAt ? new Date(item.createdAt).toISOString() : "";
    const dateModified = item?.updatedAt ? new Date(item.updatedAt).toISOString() : "";
    const langVariant = version?.languages?.find((v) => v.lang === activeLang);
    const slug = langVariant?.slug ?? "";
    const canonicalUrl = `/${activeLang}/${slug}`;
    const wordCount = langVariant?.wordCount ?? 0;
    const category = meta?.category ?? item?.category ?? "";

    // Render body markdown → HTML, strip leading duplicate of title
    let bodyHtml = (marked.parse(md) as string).trim();
    const titleEsc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    bodyHtml = bodyHtml.replace(new RegExp(`^\\s*<(p|h1)>${titleEsc}<\\/\\1>\\s*`), "");

    // Escape helper for JSON-LD strings
    const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

    // Build FAQ visible section
    const faqLines: string[] = [];
    if (faqs.length > 0) {
      faqLines.push("");
      faqLines.push("  <section class=\"faq\">");
      faqLines.push("    <h2>Häufig gestellte Fragen</h2>");
      for (const f of faqs) {
        faqLines.push("");
        faqLines.push("    <details>");
        faqLines.push(`      <summary>${f.question}</summary>`);
        faqLines.push(`      <p>${f.answer}</p>`);
        faqLines.push("    </details>");
      }
      faqLines.push("  </section>");
    }

    // Build JSON-LD: FAQPage
    const faqJsonLd: string[] = [];
    if (faqs.length > 0) {
      faqJsonLd.push("  <script type=\"application/ld+json\">");
      faqJsonLd.push("  {");
      faqJsonLd.push("    \"@context\": \"https://schema.org\",");
      faqJsonLd.push("    \"@type\": \"FAQPage\",");
      faqJsonLd.push("    \"mainEntity\": [");
      faqs.forEach((f, i) => {
        faqJsonLd.push("      {");
        faqJsonLd.push("        \"@type\": \"Question\",");
        faqJsonLd.push(`        "name": "${esc(f.question)}",`);
        faqJsonLd.push("        \"acceptedAnswer\": {");
        faqJsonLd.push("          \"@type\": \"Answer\",");
        faqJsonLd.push(`          "text": "${esc(f.answer)}"`);
        faqJsonLd.push("        }");
        faqJsonLd.push(`      }${i < faqs.length - 1 ? "," : ""}`);
      });
      faqJsonLd.push("    ]");
      faqJsonLd.push("  }");
      faqJsonLd.push("  </script>");
    }

    // Build JSON-LD: Article
    const articleJsonLd: string[] = [
      "  <script type=\"application/ld+json\">",
      "  {",
      "    \"@context\": \"https://schema.org\",",
      "    \"@type\": \"BlogPosting\",",
      `    "headline": "${esc(title)}",`,
      ...(description ? [`    "description": "${esc(description)}",`] : []),
      ...(heroUrl ? [`    "image": "${heroUrl}",`] : []),
      ...(authorName ? [
        "    \"author\": {",
        "      \"@type\": \"Person\",",
        `      "name": "${esc(authorName)}"`,
        "    },",
      ] : []),
      ...(datePublished ? [`    "datePublished": "${datePublished}",`] : []),
      ...(dateModified ? [`    "dateModified": "${dateModified}",`] : []),
      ...(wordCount ? [`    "wordCount": ${wordCount},`] : []),
      ...(category ? [`    "articleSection": "${esc(category)}",`] : []),
      `    "inLanguage": "${activeLang}"`,
      "  }",
      "  </script>",
    ];

    // Indent body HTML into the article tag
    const indentedBody = bodyHtml
      .split("\n")
      .map((line) => (line.trim() ? `    ${line}` : ""))
      .join("\n");

    const previewHtml = [
      "<!DOCTYPE html>",
      `<html lang="${activeLang}">`,
      "<head>",
      "  <meta charset=\"utf-8\">",
      "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      `  <title>${title}</title>`,
      ...(description ? [`  <meta name="description" content="${esc(description)}">`] : []),
      ...(keywords ? [`  <meta name="keywords" content="${esc(keywords)}">`] : []),
      `  <link rel="canonical" href="${canonicalUrl}">`,
      "",
      "  <!-- Open Graph -->",
      `  <meta property="og:title" content="${esc(title)}">`,
      `  <meta property="og:type" content="article">`,
      `  <meta property="og:url" content="${canonicalUrl}">`,
      ...(description ? [`  <meta property="og:description" content="${esc(description)}">`] : []),
      ...(heroUrl ? [`  <meta property="og:image" content="${heroUrl}">`] : []),
      `  <meta property="og:locale" content="${activeLang}">`,
      ...(datePublished ? [`  <meta property="article:published_time" content="${datePublished}">`] : []),
      ...(dateModified ? [`  <meta property="article:modified_time" content="${dateModified}">`] : []),
      ...(authorName ? [`  <meta property="article:author" content="${esc(authorName)}">`] : []),
      "",
      "  <!-- Twitter Card -->",
      `  <meta name="twitter:card" content="summary_large_image">`,
      `  <meta name="twitter:title" content="${esc(title)}">`,
      ...(description ? [`  <meta name="twitter:description" content="${esc(description)}">`] : []),
      ...(heroUrl ? [`  <meta name="twitter:image" content="${heroUrl}">`] : []),
      "",
      "  <!-- hreflang -->",
      ...langs.map((l) => {
        const s = version?.languages?.find((v) => v.lang === l)?.slug ?? "";
        return `  <link rel="alternate" hreflang="${l}" href="/${l}/${s}">`;
      }),
      "",
      "  <!-- Structured Data -->",
      ...articleJsonLd,
      ...faqJsonLd,
      "",
      "  <style>",
      "    :root {",
      "      --border: #e2e2e2;",
      "      --muted-foreground: #737373;",
      "    }",
      "",
      "    * { box-sizing: border-box; }",
      "",
      "    body {",
      "      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
      "      max-width: 720px;",
      "      margin: 2rem auto;",
      "      padding: 0 1.5rem;",
      "      line-height: 1.7;",
      "      color: #1a1a1a;",
      "    }",
      "",
      "    h1 { font-size: 2rem; margin: 1.5rem 0 0.5rem; }",
      "    h2 { font-size: 1.5rem; margin: 2rem 0 0.75rem; }",
      "    h3 { font-size: 1.2rem; margin: 1.5rem 0 0.5rem; }",
      "    p { margin: 0.75rem 0; }",
      "    img { max-width: 100%; height: auto; }",
      "    blockquote { border-left: 3px solid #ddd; margin: 1rem 0; padding: 0.5rem 1rem; color: #555; }",
      "    hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }",
      "    ul, ol { padding-left: 1.5rem; }",
      "    a { color: #2563eb; }",
      "    .meta { color: #737373; font-size: 0.85rem; margin-bottom: 1.5rem; }",
      "",
      "    /* Image figures */",
      "    figure.image-figure { margin: 1rem 0; padding: 0; }",
      "    figure.image-figure[data-align=\"left\"] { float: left; margin: 0 1rem 0.75rem 0; }",
      "    figure.image-figure[data-align=\"center\"] { text-align: center; }",
      "    figure.image-figure[data-align=\"center\"] img { margin-inline: auto; display: block; }",
      "    figure.image-figure[data-align=\"right\"] { float: right; margin: 0 0 0.75rem 1rem; }",
      "    figure.image-figure[data-rounded=\"sm\"] img { border-radius: 4px; }",
      "    figure.image-figure[data-rounded=\"md\"] img { border-radius: 8px; }",
      "    figure.image-figure[data-rounded=\"lg\"] img { border-radius: 16px; }",
      "    figure.image-figure[data-border=\"thin\"] img { border: 1px solid var(--border); }",
      "    figure.image-figure[data-border=\"thick\"] img { border: 2px solid var(--border); }",
      "    figure.image-figure[data-shadow=\"sm\"] img { box-shadow: 0 1px 3px rgba(0,0,0,.1); }",
      "    figure.image-figure[data-shadow=\"md\"] img { box-shadow: 0 4px 12px rgba(0,0,0,.12); }",
      "    figure.image-figure[data-shadow=\"lg\"] img { box-shadow: 0 8px 24px rgba(0,0,0,.16); }",
      "    figure.image-figure figcaption { text-align: center; font-size: 0.85rem; color: var(--muted-foreground); margin-top: 0.5rem; }",
      "",
      "    /* FAQ */",
      "    .faq { margin-top: 2.5rem; border-top: 1px solid #ddd; padding-top: 1.5rem; }",
      "    .faq h2 { font-size: 1.4rem; margin-bottom: 1rem; }",
      "    details { border-bottom: 1px solid #e5e5e5; padding: 0; }",
      "    details:last-of-type { border-bottom: none; }",
      "    details summary { cursor: pointer; padding: 0.75rem 0; font-weight: 500; list-style: none; }",
      "    details summary::-webkit-details-marker { display: none; }",
      "    details summary::before { content: \"\\25B6\"; display: inline-block; margin-right: 0.5rem; font-size: 0.7rem; transition: transform 0.2s; }",
      "    details[open] summary::before { transform: rotate(90deg); }",
      "    details p { padding: 0 0 0.75rem; margin: 0; color: #555; }",
      "  </style>",
      "</head>",
      "<body>",
      "",
      `  <h1>${title}</h1>`,
      ...(description || authorName ? [
        "  <p class=\"meta\">",
        ...(description ? [`    <em>${description}</em>`] : []),
        ...(authorName ? [`    ${description ? "<br>" : ""}Von ${authorName}${datePublished ? ` · ${new Date(datePublished).toLocaleDateString(activeLang, { day: "numeric", month: "long", year: "numeric" })}` : ""}`] : []),
        "  </p>",
        "",
      ] : [""]),
      "  <article>",
      indentedBody,
      "  </article>",
      ...faqLines,
      "",
      "</body>",
      "</html>",
      "",
    ].join("\n");
    const blob = new Blob([previewHtml], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  }, [editorContent, activeLang, metaByLang, item, authors, customerId, projectId, versions, activeVersionId]);

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Content not found</p>
        <Link href="/flows" className="text-primary underline text-sm">
          Back to Flows
        </Link>
      </div>
    );
  }

  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;
  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? latestVersion;
  const isViewingOldVersion = activeVersion && latestVersion && activeVersion.id !== latestVersion.id;
  const origMeta = metaByLang[activeLang];
  const metaDirty = origMeta
    ? title !== origMeta.title || description !== origMeta.description || category !== origMeta.category || author !== (item.author ?? "")
    : title !== (item.title ?? "") || description !== (item.description ?? "") || category !== (item.category ?? "") || author !== (item.author ?? "");
  const jsonDirty = editorMode === "json" && JSON.stringify(jsonValues) !== JSON.stringify(originalJsonValues);
  const hasChanges = editorMode === "json" ? jsonDirty : (metaDirty || bodyDirty);

  return (
    <>
    <ContentDetailLayout
      header={
        <div className="flex items-center gap-4">
          <Link href={item.flowId ? `/flows/${item.flowId}` : item.topicId ? `/flows/${item.topicId}` : "/flows"}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 flex items-center gap-2">
            <ContentStatusBadge status={item.status} />
            <ContentTypeBadge type={item.type} label={contentTypeDef?.label} connectorType={contentTypeDef?.connectorType} />
            {activeVersion && (
              <span className={`text-xs ${isViewingOldVersion ? "text-violet-600 font-medium" : "text-muted-foreground"}`}>
                v{activeVersion.versionNumber}{isViewingOldVersion ? ` (latest: v${latestVersion!.versionNumber})` : ""}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Updated: {new Date(item.updatedAt).toLocaleDateString("de-DE")}
            </span>
            {/* Language switcher moved to sidebar */}
          </div>
          <div className="flex gap-2">
            {editorMode === "markdown" && (
              <Button variant="outline" size="icon" onClick={handlePreview} title="Preview">
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {/* Save Button */}
            {hasChanges ? (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </Button>
            )}

            {/* Smart Action Button */}
            <SmartActionButton
              status={item.status}
              loading={!!actionLoading}
              platform={item.type === "social_post" ? (item.category ?? "linkedin") : item.type === "newsletter" ? "newsletter" : undefined}
              onStatusChange={async (newStatus) => {
                if (!customerId || !projectId) return;
                setActionLoading(newStatus);
                try {
                  await updateContent(customerId, projectId, id, { status: newStatus as ContentItemStatus });
                  await loadItem();
                } catch (err) {
                  console.error("Status change failed:", err);
                } finally {
                  setActionLoading(null);
                }
              }}
              onPublish={async () => {
                if (!customerId || !projectId) return;
                setActionLoading("publish");
                try {
                  await handleAction("approve");
                } finally {
                  setActionLoading(null);
                }
              }}
            />
          </div>
        </div>
      }
      metadataPanel={
        <>
          {/* Language (multi-language content types only) */}
          {editorMode === "markdown" && (contentTypeDef?.localization?.mode ?? "multi") === "multi" && Object.keys(editorContent).length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Language</h3>
              <div className="flex flex-wrap items-center gap-1">
                {(() => {
                  const versionLangs = activeVersion?.languages ?? [];
                  const versionLangCodes = new Set(versionLangs.map((l) => l.lang));
                  const localLangs = Object.keys(editorContent).filter((l) => !versionLangCodes.has(l));
                  return [...versionLangs.map((l) => l.lang), ...localLangs].map((lc) => (
                    <button
                      key={lc}
                      onClick={() => setActiveLang(lc)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${activeLang === lc ? "bg-primary text-primary-foreground font-medium" : "border text-muted-foreground hover:bg-muted"}`}
                    >
                      {lc.toUpperCase()}
                    </button>
                  ));
                })()}
                {(() => {
                  const allExisting = new Set([...(activeVersion?.languages.map((l) => l.lang) ?? []), ...Object.keys(editorContent)]);
                  const available = projectLanguages.filter((l) => !allExisting.has(l.code));
                  if (available.length === 0) return null;
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="px-2.5 py-1 text-xs border rounded-md text-muted-foreground hover:bg-muted transition-colors">+ Add</button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {available.map((l) => (
                          <DropdownMenuItem key={l.code} onClick={() => {
                            setEditorContent((prev) => ({ ...prev, [l.code]: "" }));
                            setMetaByLang((prev) => ({ ...prev, [l.code]: { title: title || "", description: "", category: category || "", tags: "", keywords: "", author: author || "", faqs: [] } }));
                            setActiveLang(l.code);
                          }}>
                            {l.code.toUpperCase()} — {l.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })()}
              </div>
              {/* Translate with AI — only for non-primary languages */}
              {(() => {
                const primaryLang = activeVersion?.languages?.[0]?.lang ?? Object.keys(editorContent)[0];
                if (activeLang === primaryLang) return null;
                const hasPrimaryContent = editorContent[primaryLang]?.trim();
                if (!hasPrimaryContent) return null;
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      // Copy primary content as starting point (actual AI translation would be a pipeline call)
                      const primary = editorContent[primaryLang] ?? "";
                      setEditorContent((prev) => ({ ...prev, [activeLang]: primary }));
                    }}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Translate {primaryLang.toUpperCase()} → {activeLang.toUpperCase()} with AI
                  </Button>
                );
              })()}
            </div>
          )}

          {/* Version Selector */}
          {versions.length > 0 && activeVersion && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Version</h3>
              <Popover open={versionPopoverOpen} onOpenChange={setVersionPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-xs h-9">
                    <span className="flex items-center gap-2">
                      <Badge
                        variant={activeVersion.publishedAt ? "default" : "outline"}
                        className={`text-[10px] px-1.5 ${activeVersion.publishedAt ? "bg-green-600 hover:bg-green-600" : ""}`}
                      >
                        v{activeVersion.versionNumber}
                      </Badge>
                      <span className="text-muted-foreground">
                        {activeVersion.languages?.[0]?.wordCount ? `${activeVersion.languages[0].wordCount}w` : ""} · {activeVersion.createdByName ?? activeVersion.createdBy}
                      </span>
                      {isViewingOldVersion && (
                        <span className="text-violet-600 font-medium">older</span>
                      )}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1.5" align="start">
                  <div className="space-y-1">
                    {[...versions].reverse().map((v) => {
                      const isActive = v.id === activeVersionId;
                      const isPublished = !!v.publishedAt;
                      return (
                        <button
                          type="button"
                          key={v.id}
                          className={`group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-muted ${isActive ? "bg-muted" : ""}`}
                          onClick={() => {
                            switchVersion(v.id);
                            setVersionPopoverOpen(false);
                          }}
                        >
                          <Badge
                            variant={isPublished ? "default" : "outline"}
                            className={`text-[10px] px-1.5 shrink-0 ${isPublished ? "bg-green-600 hover:bg-green-600" : ""}`}
                          >
                            v{v.versionNumber}
                          </Badge>
                          <span className="text-muted-foreground truncate">
                            {v.languages?.[0]?.wordCount ? `${v.languages[0].wordCount}w` : ""}
                            {" · "}
                            {new Date(v.createdAt).toLocaleDateString("de-DE")}
                            {" · "}
                            {v.createdByName ?? v.createdBy}
                          </span>
                          {isPublished && (
                            <span className="ml-auto text-[10px] text-green-600 shrink-0">live</span>
                          )}
                          {!isPublished && versions.length > 1 && (
                            <button
                              type="button"
                              className="ml-auto text-muted-foreground/50 hover:text-red-500 shrink-0 p-0.5 rounded hover:bg-red-50"
                              title="Delete version"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVersionPopoverOpen(false);
                                setDeleteVersionId({ id: v.id, number: v.versionNumber });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground h-7 mt-1"
                onClick={async () => {
                  if (!customerId || !projectId || !item) return;
                  try {
                    const lang = versions[versions.length - 1]?.languages?.[0]?.lang ?? "de";
                    if (editorMode === "json") {
                      await createContentVersion(customerId, projectId, id, {
                        [lang]: JSON.stringify(jsonValues, null, 2),
                      }, undefined, true);
                    } else {
                      // Markdown: build file from current editor state
                      const md = editorContent[activeLang] ?? "";
                      await createContentVersion(customerId, projectId, id, {
                        [activeLang]: md,
                      }, undefined, true);
                    }
                    await loadItem();
                  } catch (err) {
                    console.error("Create version failed:", err);
                  }
                }}
              >
                <Plus className="mr-1 h-3 w-3" />
                Save as new version
              </Button>
            </div>
          )}

          {/* Scheduling */}
          {topic && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Scheduling
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sched-date" className="text-xs">Date</Label>
                  <Input
                    id="sched-date"
                    type="date"
                    value={schedDate}
                    onChange={(e) => {
                      setSchedDate(e.target.value);
                      if (e.target.value && customerId && projectId && item) {
                        const newVal = schedTime ? `${e.target.value}T${schedTime}` : e.target.value;
                        updateContent(customerId, projectId, item.id, { scheduledDate: newVal });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sched-time" className="text-xs">Time</Label>
                  <Input
                    id="sched-time"
                    type="time"
                    value={schedTime}
                    onChange={(e) => {
                      setSchedTime(e.target.value);
                      if (schedDate && customerId && projectId && item) {
                        const newVal = e.target.value ? `${schedDate}T${e.target.value}` : schedDate;
                        updateContent(customerId, projectId, item.id, { scheduledDate: newVal });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Metadata — conditional fields based on editor mode */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Metadata</h3>

            {/* Description + Category only for articles */}
            {editorMode === "markdown" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {description.length}/160 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.labels.de ?? cat.labels.en ?? cat.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Author — only for articles (social uses connector account, not author) */}
            {editorMode === "markdown" && <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              {authors.length > 0 ? (
                <Select value={author} onValueChange={setAuthor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select author" />
                  </SelectTrigger>
                  <SelectContent>
                    {authors.map((a) => (
                      <SelectItem key={a.id} value={a.name}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Author name"
                />
              )}
            </div>}
          </div>

          {/* Hero Image moved to main editor area */}

          {/* Delivery Info */}
          {(item.deliveryRef || item.deliveryUrl) && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Delivery</h3>
              {item.deliveryRef && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Ref: </span>
                  <span className="font-mono">{item.deliveryRef}</span>
                </div>
              )}
              {item.deliveryUrl && (
                <div className="text-xs">
                  <span className="text-muted-foreground">URL: </span>
                  <a
                    href={item.deliveryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {item.deliveryUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Content Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Info</h3>
            <div className="text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">ID: </span>
                <span className="font-mono">{item.id}</span>
              </div>
              {item.topicId && (
                <div>
                  <span className="text-muted-foreground">Topic: </span>
                  <Link href={`/flows/${item.topicId}`} className="font-mono text-primary hover:underline">
                    {item.topicId}
                  </Link>
                </div>
              )}
              {item.translationKey && (
                <div>
                  <span className="text-muted-foreground">Translation Key: </span>
                  <span className="font-mono">{item.translationKey}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Created: </span>
                {new Date(item.createdAt).toLocaleDateString("de-DE")}
              </div>
              {item.publishedAt && (
                <div>
                  <span className="text-muted-foreground">Published: </span>
                  {new Date(item.publishedAt).toLocaleDateString("de-DE")}
                </div>
              )}
            </div>
          </div>
        </>
      }
      mediaPanel={
        <SocialMediaPanel
          customerId={customerId!}
          projectId={projectId!}
          contentId={id}
          images={editorMode === "json" ? ((jsonValues.images ?? jsonValues.media ?? []) as string[]) : []}
          onImagesChange={editorMode === "json" ? (images) => setJsonValues((prev) => ({ ...prev, images })) : () => {}}
          mediaAssets={mediaAssets}
          onMediaAssetsChange={setMediaAssets}
        />
      }
      chatPanel={
        <ContentChat
          customerId={customerId!}
          projectId={projectId!}
          contentId={id}
          onApplyUpdates={(updates) => {
            if (editorMode === "json") {
              setJsonValues((prev) => ({ ...prev, ...updates }));
            }
          }}
        />
      }
      defaultSidebarTab="metadata"
    >
      {/* ── Main Content ── */}
      <div className="space-y-6">
        {/* Save Error Banner */}
        {saveError && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200 flex-1">{saveError}</p>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSaveError(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Viewing Older Version Banner */}
        {isViewingOldVersion && (
          <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950">
            <RotateCcw className="h-4 w-4 text-violet-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-violet-800 dark:text-violet-200">
                Viewing v{activeVersion!.versionNumber} — latest is v{latestVersion!.versionNumber}
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                Editing and saving will create a new version based on this content.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => switchVersion(latestVersion!.id)}
            >
              Go to latest
            </Button>
          </div>
        )}

        {/* Status Banners */}
        {item.status === "producing" && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
            <Play className="h-4 w-4 text-blue-600 shrink-0 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Pipeline is producing this content
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Content is being generated. Check the Monitor page for progress.
              </p>
            </div>
          </div>
        )}

        {item.status === "updating" && (
          <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-800 dark:bg-orange-950">
            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Content update in progress
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Published {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("de-DE") : "—"} — update is being delivered.
              </p>
            </div>
          </div>
        )}

        {item.status === "review" && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Content is pending review
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Approve to deliver, or reject to return to draft.
              </p>
            </div>
          </div>
        )}

        {editorMode === "markdown" ? (
          <>
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="editor-title" className="text-xs text-muted-foreground">Title</Label>
              <Input
                id="editor-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title…"
                className="text-xl font-bold h-auto py-2"
              />
              <p className="text-xs text-muted-foreground">{title.length}/70 characters</p>
            </div>

            {/* Hero Image — drag & drop from media library */}
            <div
              className={`relative rounded-lg overflow-hidden transition-colors ${
                item.heroImageId
                  ? "border"
                  : "border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/40"
              }`}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-primary"); }}
              onDrop={async (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("ring-2", "ring-primary");
                const url = e.dataTransfer.getData("text/plain");
                if (url && item) {
                  // Extract asset ID from media URL pattern: /media/{assetId}/file
                  const assetIdMatch = url.match(/\/media\/([^/]+)\/file/);
                  if (assetIdMatch) {
                    await setHeroImage(customerId, projectId, item.id, assetIdMatch[1]);
                    setItem({ ...item, heroImageId: assetIdMatch[1] });
                  }
                }
              }}
            >
              {item.heroImageId ? (
                <div className="relative group">
                  <img
                    src={getMediaFileUrl(customerId, projectId, item.heroImageId)}
                    alt="Hero"
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <Button size="sm" variant="secondary" className="text-xs" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-1 h-3 w-3" />Replace
                    </Button>
                    <Button size="sm" variant="secondary" className="text-xs" onClick={async () => {
                      if (!item) return;
                      setItem({ ...item, heroImageId: undefined });
                    }}>
                      <Trash2 className="mr-1 h-3 w-3" />Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Add hero image — click to upload or drag from media library</p>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !item) return;
                  setUploading(true);
                  try {
                    const asset = await uploadContentMedia(customerId, projectId, item.id, file);
                    setItem({ ...item, heroImageId: asset.id });
                  } catch (err) {
                    console.error("Upload failed:", err);
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {/* Language Tabs + Editor */}
            <Tabs value={activeLang} onValueChange={setActiveLang}>
              {/* Language tabs moved to header — hidden here */}
              {false && (
              <TabsList>
                {(() => {
                  // Combine version languages + locally added languages (from editorContent keys)
                  const versionLangs = activeVersion?.languages ?? [];
                  const versionLangCodes = new Set(versionLangs.map((l) => l.lang));
                  const localLangs = Object.keys(editorContent).filter((l) => !versionLangCodes.has(l));
                  const allLangs = [...versionLangs.map((l) => l.lang), ...localLangs];

                  return allLangs.map((langCode) => {
                    const vLang = versionLangs.find((l) => l.lang === langCode);
                    return (
                      <TabsTrigger key={langCode} value={langCode}>
                        {langCode.toUpperCase()}
                        {vLang?.wordCount ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">({vLang.wordCount}w)</span>
                        ) : null}
                      </TabsTrigger>
                    );
                  });
                })()}
                {/* Add language button */}
                {(() => {
                  const allExisting = new Set([
                    ...(activeVersion?.languages.map((l) => l.lang) ?? []),
                    ...Object.keys(editorContent),
                  ]);
                  const availableLangs = projectLanguages.filter((l) => !allExisting.has(l.code));
                  if (availableLangs.length === 0) return null;
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="ml-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                          + {availableLangs.length > 1 ? "Language" : availableLangs[0].code.toUpperCase()}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {availableLangs.map((lang) => (
                          <DropdownMenuItem
                            key={lang.code}
                            onClick={() => {
                              setEditorContent((prev) => ({ ...prev, [lang.code]: `# ${title}\n\n` }));
                              setMetaByLang((prev) => ({
                                ...prev,
                                [lang.code]: { title, description: "", category: category || "", tags: "", keywords: "", author: author || "", faqs: [] },
                              }));
                              setActiveLang(lang.code);
                            }}
                          >
                            {lang.code.toUpperCase()} — {lang.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })()}
              </TabsList>
              )}

              {[...(activeVersion?.languages ?? [{ lang: "de", slug: "", title: "", description: "", contentPath: "" }]), ...Object.keys(editorContent).filter((l) => !(activeVersion?.languages ?? []).some((vl) => vl.lang === l)).map((l) => ({ lang: l, slug: "", title: "", description: "", contentPath: "" }))].map((lang) => (
                <TabsContent key={lang.lang} value={lang.lang} className="mt-4">
                  {editorContent[lang.lang] != null ? (
                    <TiptapEditor
                      key={`${lang.lang}-${activeVersionId ?? "new"}`}
                      content={editorContent[lang.lang] || ""}
                      onChange={(md) => {
                        userEditedLangs.current.add(lang.lang);
                        setEditorContent((prev) => ({ ...prev, [lang.lang]: md }));
                      }}
                      onImageUpload={async (file) => {
                        const asset = await uploadContentMedia(customerId, projectId, item!.id, file, "inline");
                        return getMediaFileUrl(customerId, projectId, asset.id);
                      }}
                    />
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <p className="text-sm text-muted-foreground">
                          {lang.lang === (activeVersion?.languages?.[0]?.lang ?? activeLang)
                            ? "Start writing your content"
                            : `No content for ${lang.lang.toUpperCase()} yet`}
                        </p>
                        {lang.lang !== (activeVersion?.languages?.[0]?.lang ?? activeLang) && (
                          <Button variant="outline" size="sm" className="mt-3">
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                            Generate Translation
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              ))}
            </Tabs>

            {/* FAQ Section */}
            <FaqSection faqs={faqs} setFaqs={setFaqs} />
          </>
        ) : (
          /* JSON editor mode — render platform-specific editor */
          <JsonEditorSwitch
            contentTypeId={contentTypeId}
            contentType={contentTypeDef}
            values={jsonValues}
            onChange={setJsonValues}
            projectName={item.title}
            authorName={authors[0]?.name}
            authorRole={typeof authors[0]?.role === "string" ? authors[0].role : authors[0]?.role?.en ?? authors[0]?.role?.de}
            authorImage={authors[0]?.image}
            readOnly={false}
          />
        )}
      </div>
    </ContentDetailLayout>
    <Dialog open={!!deleteVersionId} onOpenChange={(open) => { if (!open) setDeleteVersionId(null); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Version?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <strong>Version {deleteVersionId?.number} will be permanently deleted.</strong>{" "}
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setDeleteVersionId(null)}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!deleteVersionId) return;
              try {
                await deleteContentVersion(customerId!, projectId!, id, deleteVersionId.id);
                setDeleteVersionId(null);
                await loadItem();
              } catch (err) {
                console.error("Delete version failed:", err);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function SmartActionButton({
  status,
  loading,
  platform,
  onStatusChange,
  onPublish,
}: {
  status: string;
  loading: boolean;
  platform?: string;
  onStatusChange: (status: string) => void;
  onPublish: () => void;
}) {
  const platformLabel = platform
    ? platform.charAt(0).toUpperCase() + platform.slice(1)
    : "Platform";
  const publishLabel = `Publish on ${platformLabel}`;

  const config: Record<string, { label: string; primary: string; className: string; items: Array<{ label: string; action: string; separator?: boolean }> }> = {
    draft: {
      label: "Submit for Review",
      primary: "review",
      className: "bg-blue-600 hover:bg-blue-700 text-white",
      items: [
        { label: "Submit for Review", action: "review" },
        { label: "Mark as Approved", action: "approved" },
        { label: publishLabel, action: "published", separator: true },
      ],
    },
    review: {
      label: "Approve",
      primary: "approved",
      className: "bg-emerald-600 hover:bg-emerald-700 text-white",
      items: [
        { label: "Approve", action: "approved" },
        { label: publishLabel, action: "published" },
        { label: "Back to Draft", action: "draft", separator: true },
      ],
    },
    approved: {
      label: publishLabel,
      primary: "published",
      className: "bg-green-600 hover:bg-green-700 text-white",
      items: [
        { label: publishLabel, action: "published" },
        { label: "Back to Draft", action: "draft", separator: true },
      ],
    },
    published: {
      label: "Published",
      primary: "",
      className: "bg-green-600/10 text-green-700 border-green-200",
      items: [
        { label: "Archive", action: "archived" },
        { label: "Back to Draft", action: "draft" },
      ],
    },
    archived: {
      label: "Restore",
      primary: "draft",
      className: "",
      items: [
        { label: "Restore to Draft", action: "draft" },
      ],
    },
  };

  const c = config[status] ?? config.draft;

  return (
    <div className="flex items-center">
      {/* Primary button */}
      <Button
        className={`rounded-r-none ${c.className}`}
        disabled={loading || !c.primary}
        onClick={() => {
          if (c.primary === "published") onPublish();
          else if (c.primary) onStatusChange(c.primary);
        }}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {c.label}
      </Button>

      {/* Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className={`rounded-l-none border-l border-white/20 px-2 ${c.className}`} disabled={loading}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {c.items.map((item, i) => (
            <div key={item.action}>
              {item.separator && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => {
                  if (item.action === "published") onPublish();
                  else onStatusChange(item.action);
                }}
              >
                <span className={`mr-2 h-2 w-2 rounded-full ${
                  item.action === "draft" ? "bg-yellow-500" :
                  item.action === "review" ? "bg-blue-500" :
                  item.action === "approved" ? "bg-emerald-500" :
                  item.action === "published" ? "bg-green-600" :
                  "bg-gray-400"
                }`} />
                {item.label}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function JsonEditorSwitch({
  contentTypeId,
  contentType,
  values,
  onChange,
  projectName,
  authorName,
  authorRole,
  authorImage,
  readOnly,
}: {
  contentTypeId: string | null;
  contentType: ContentTypeDefinition | null;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  projectName?: string;
  authorName?: string;
  authorRole?: string;
  authorImage?: string;
  readOnly?: boolean;
}) {
  const commonProps = { values, onChange, projectName, authorName, authorRole, authorImage, readOnly };
  switch (contentTypeId) {
    case "linkedin-post":
      return <LinkedInEditor {...commonProps} />;
    case "x-post":
      return <XEditor {...commonProps} />;
    case "instagram-post":
      return <InstagramEditor {...commonProps} />;
    case "tiktok-post":
      return <TikTokEditor {...commonProps} />;
    case "newsletter":
      return <NewsletterEditor {...commonProps} />;
    default:
      return <GenericEditor values={values} onChange={onChange} contentType={contentType} readOnly={readOnly} />;
  }
}

/** Media panel for social/email editors — focused on this post + recent library */
function SocialMediaPanel({
  customerId,
  projectId,
  contentId,
  images,
  onImagesChange,
  mediaAssets,
  onMediaAssetsChange,
}: {
  customerId: string;
  projectId: string;
  contentId: string;
  images: string[];
  onImagesChange: (images: string[]) => void;
  mediaAssets: import("@/lib/types").MediaAsset[];
  onMediaAssetsChange: (assets: import("@/lib/types").MediaAsset[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  // Load recent images from library (6 newest)
  const [recentMedia, setRecentMedia] = useState<import("@/lib/types").MediaAsset[]>([]);
  useEffect(() => {
    getMedia(customerId, projectId, { type: "image", limit: 6 }).then((res) => setRecentMedia(res.assets)).catch(() => {});
  }, [customerId, projectId]);

  // Recent = library images NOT already attached to this post
  const recentFiltered = useMemo(() => {
    const attachedUrls = new Set(images);
    return recentMedia.filter((a) => {
      const url = getMediaFileUrl(customerId, projectId, a.id);
      return !attachedUrls.has(url);
    });
  }, [recentMedia, images, customerId, projectId]);

  const refreshMedia = () => {
    getMedia(customerId, projectId, { type: "image", limit: 6 }).then((res) => setRecentMedia(res.assets)).catch(() => {});
    getContentMedia(customerId, projectId, contentId).then(({ assets }) => onMediaAssetsChange(assets)).catch(() => {});
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" className="text-xs" disabled={uploading}
          onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
          Upload
        </Button>
        <Button variant="outline" size="sm" className="text-xs" disabled={generating}
          onClick={async () => {
            setGenerating(true);
            try {
              const asset = await generateHeroImage(customerId, projectId, contentId, "Professional social media image, modern clean style");
              const url = getMediaFileUrl(customerId, projectId, asset.id);
              onImagesChange([...images, url]);
              refreshMedia();
            } catch (err) { console.error("Generate failed:", err); }
            finally { setGenerating(false); }
          }}>
          {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
          Generate
        </Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setBrowseOpen(true)}>
          <ImageIcon className="mr-1 h-3 w-3" />
          Browse
        </Button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          setUploading(true);
          try {
            for (const file of files) {
              const asset = await uploadContentMedia(customerId, projectId, contentId, file);
              const url = getMediaFileUrl(customerId, projectId, asset.id);
              onImagesChange([...images, url]);
            }
            refreshMedia();
          } catch (err) { console.error("Upload failed:", err); }
          finally { setUploading(false); e.target.value = ""; }
        }}
      />

      {/* This Post */}
      {images.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">This post ({images.length})</p>
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((url, i) => (
              <div key={url} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button"
                  className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onImagesChange(images.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent from library */}
      {recentFiltered.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Recent</p>
          <div className="grid grid-cols-3 gap-1.5">
            {recentFiltered.map((asset) => {
              const url = getMediaFileUrl(customerId, projectId, asset.id);
              const thumbUrl = getMediaThumbnailUrl(customerId, projectId, asset.id);
              return (
                <button key={asset.id} type="button" draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", url); e.dataTransfer.effectAllowed = "copy"; }}
                  className="aspect-square rounded-md overflow-hidden border bg-muted hover:ring-2 hover:ring-primary/50 transition-all cursor-grab active:cursor-grabbing"
                  onClick={() => onImagesChange([...images, url])}>
                  <img src={thumbUrl} alt="" className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = url; }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MediaPicker */}
      <MediaPicker
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        typeFilter="image"
        onSelect={(asset) => {
          const url = getMediaFileUrl(customerId, projectId, asset.id);
          if (!images.includes(url)) onImagesChange([...images, url]);
          setBrowseOpen(false);
        }}
      />
    </div>
  );
}
