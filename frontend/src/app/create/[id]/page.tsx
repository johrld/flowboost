"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { TiptapEditor } from "@/components/tiptap-editor";
import { useProject } from "@/lib/project-context";
import {
  getContentItem,
  getContentFile,
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
  scheduleTopic,
} from "@/lib/api";
import type { ContentItem, ContentVersion, Topic } from "@/lib/types";
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
  Clock,
  GripVertical,
} from "lucide-react";
import Link from "next/link";

/** Tag input with chips */
function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function addItem(text: string) {
    const trimmed = text.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed].join(", "));
    setInput("");
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index).join(", "));
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-2 py-2 focus-within:ring-1 focus-within:ring-ring">
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
        >
          {item}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => removeItem(i)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addItem(input);
          }
          if (e.key === "Backspace" && !input && items.length > 0) {
            removeItem(items.length - 1);
          }
        }}
        onBlur={() => { if (input) addItem(input); }}
        placeholder={items.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

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
    faqs,
  };
}

/** Strip YAML frontmatter from markdown, return body only */
function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n*/, "");
}

/** Rebuild YAML frontmatter from sidebar fields */
function buildFrontmatter(
  meta: { title: string; description: string; category: string; tags: string; keywords: string; faqs: { question: string; answer: string }[] },
  lang: string,
): string {
  const lines: string[] = ["---"];
  lines.push(`title: "${meta.title}"`);
  if (meta.description) lines.push(`description: "${meta.description}"`);
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
  faqs: { question: string; answer: string }[];
}

export default function ContentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { customerId, projectId, categories, loading: projectLoading } = useProject();

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

  // Topic scheduling
  const [topic, setTopic] = useState<Topic | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");

  // Track which languages the user actually edited (vs TiptapEditor roundtrip noise)
  const userEditedLangs = useRef<Set<string>>(new Set());

  // Derived sidebar fields from active language
  const langMeta = metaByLang[activeLang];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [keywords, setKeywords] = useState("");
  const faqs = langMeta?.faqs ?? [];
  const setFaqs = (items: { question: string; answer: string }[]) =>
    setMetaByLang((prev) => ({ ...prev, [activeLang]: { ...prev[activeLang], faqs: items } }));

  // Sync sidebar fields when language changes
  useEffect(() => {
    if (!langMeta) return;
    setTitle(langMeta.title);
    setDescription(langMeta.description);
    setCategory(langMeta.category);
    setTags(langMeta.tags);
    setKeywords(langMeta.keywords);
  }, [activeLang, langMeta]);

  // Load content item
  const loadItem = useCallback(async () => {
    if (!customerId || !projectId) return;
    setLoading(true);
    try {
      const data = await getContentItem(customerId, projectId, id);
      setItem(data);
      setVersions(data.versions ?? []);

      // Load topic for scheduling info
      if (data.topicId) {
        try {
          const topics = await getTopics(customerId, projectId);
          const t = topics.find((tp) => tp.id === data.topicId);
          if (t) {
            setTopic(t);
            if (t.scheduledDate) {
              const [d, time] = t.scheduledDate.includes("T")
                ? t.scheduledDate.split("T")
                : [t.scheduledDate, ""];
              setSchedDate(d);
              setSchedTime(time);
            }
          }
        } catch { /* ignore */ }
      }

      // Load editor content from latest version's markdown files
      if (data.versions && data.versions.length > 0) {
        const latest = data.versions[data.versions.length - 1];
        setActiveVersionId(latest.id);
        await loadVersionContent(latest, data);
      } else {
        // No versions — use ContentItem-level metadata
        setTitle(data.title);
        setDescription(data.description ?? "");
        setCategory(data.category ?? "");
        setTags(data.tags?.join(", ") ?? "");
        setKeywords(data.keywords?.join(", ") ?? "");
      }
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId, id]);

  // Shared helper: load a version's files into the editor
  const loadVersionContent = useCallback(async (version: ContentVersion, data: ContentItem) => {
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
        allMeta[lang.lang] = { title: lang.title, description: "", category: data.category ?? "", tags: "", keywords: "", faqs: [] };
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
  }, [customerId, projectId, id]);

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
    setSaving(true);
    setSaveError(null);
    try {
      // 1. Always save metadata
      const updated = await updateContent(customerId, projectId, item.id, {
        title,
        description: description || undefined,
        category: category || undefined,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
      });
      setItem({ ...item, ...updated });

      // 2. If body changed, create new version
      if (bodyDirty) {
        const files: Record<string, string> = {};
        for (const lang of Object.keys(editorContent)) {
          const meta = metaByLang[lang] ?? { title, description, category, tags, keywords, faqs: [] };
          const fm = buildFrontmatter(
            { title: lang === activeLang ? title : meta.title, description: lang === activeLang ? description : meta.description, category: lang === activeLang ? category : meta.category, tags: lang === activeLang ? tags : meta.tags, keywords: lang === activeLang ? keywords : meta.keywords, faqs: meta.faqs },
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
        <Link href="/create" className="text-primary underline text-sm">
          Back to Content
        </Link>
      </div>
    );
  }

  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;
  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? latestVersion;
  const isViewingOldVersion = activeVersion && latestVersion && activeVersion.id !== latestVersion.id;
  const origMeta = metaByLang[activeLang];
  const metaDirty = origMeta
    ? title !== origMeta.title || description !== origMeta.description || category !== origMeta.category
    : title !== (item.title ?? "") || description !== (item.description ?? "") || category !== (item.category ?? "");
  const hasChanges = metaDirty || bodyDirty;

  return (
    <div className="flex h-full">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/create">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 flex items-center gap-2">
            <ContentStatusBadge status={item.status} />
            <ContentTypeBadge type={item.type} />
            {activeVersion && (
              <span className={`text-xs ${isViewingOldVersion ? "text-violet-600 font-medium" : "text-muted-foreground"}`}>
                v{activeVersion.versionNumber}{isViewingOldVersion ? ` (latest: v${latestVersion!.versionNumber})` : ""}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Updated: {new Date(item.updatedAt).toLocaleDateString("de-DE")}
            </span>
          </div>
          <div className="flex gap-2">
            {/* Save */}
            <Button variant="outline" onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>

            {/* Status-aware lifecycle actions */}
            {item.status === "draft" && (
              <Button onClick={() => handleAction("submit")} disabled={!!actionLoading}>
                {actionLoading === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit for Review
              </Button>
            )}
            {item.status === "review" && (
              <>
                <Button onClick={() => handleAction("approve")} disabled={!!actionLoading}>
                  {actionLoading === "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Approve
                </Button>
                <Button variant="outline" onClick={() => handleAction("reject")} disabled={!!actionLoading}>
                  {actionLoading === "reject" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  Reject
                </Button>
              </>
            )}
            {item.status === "delivered" && (
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleAction("publish")} disabled={!!actionLoading}>
                {actionLoading === "publish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Publish
              </Button>
            )}
            {item.status === "published" && (
              <>
                <Button variant="outline" onClick={() => handleAction("update")} disabled={!!actionLoading}>
                  {actionLoading === "update" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Re-Publish
                </Button>
                <Button variant="outline" className="text-muted-foreground" onClick={() => handleAction("archive")} disabled={!!actionLoading}>
                  {actionLoading === "archive" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                  Archive
                </Button>
              </>
            )}
            {item.status === "archived" && (
              <Button onClick={() => handleAction("restore")} disabled={!!actionLoading}>
                {actionLoading === "restore" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                Restore
              </Button>
            )}
          </div>
        </div>

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

        {/* Language Tabs + Editor */}
        <Tabs value={activeLang} onValueChange={setActiveLang}>
          <TabsList>
            {activeVersion?.languages.map((lang) => (
              <TabsTrigger key={lang.lang} value={lang.lang}>
                {lang.lang.toUpperCase()}
                {lang.wordCount ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">({lang.wordCount}w)</span>
                ) : null}
              </TabsTrigger>
            )) ?? (
              <>
                <TabsTrigger value="de">DE</TabsTrigger>
                <TabsTrigger value="en">EN</TabsTrigger>
                <TabsTrigger value="es">ES</TabsTrigger>
              </>
            )}
          </TabsList>

          {(activeVersion?.languages ?? [{ lang: "de", slug: "", title: "", description: "", contentPath: "" }]).map((lang) => (
            <TabsContent key={lang.lang} value={lang.lang} className="mt-4">
              {editorContent[lang.lang] ? (
                <TiptapEditor
                  content={editorContent[lang.lang]}
                  onChange={(md) => {
                    userEditedLangs.current.add(lang.lang);
                    setEditorContent((prev) => ({ ...prev, [lang.lang]: md }));
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      No content for {lang.lang.toUpperCase()} yet
                    </p>
                    <Button variant="outline" size="sm" className="mt-3">
                      Generate Translation
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* FAQ Section */}
        <FaqSection faqs={faqs} setFaqs={setFaqs} />

      </div>

      {/* Right Sidebar */}
      <div className="w-80 shrink-0 overflow-y-auto border-l bg-muted/30 p-6 space-y-6">
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
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-muted ${isActive ? "bg-muted" : ""}`}
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
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
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
                    if (e.target.value && customerId && projectId && topic) {
                      const newVal = schedTime ? `${e.target.value}T${schedTime}` : e.target.value;
                      scheduleTopic(customerId, projectId, topic.id, newVal);
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
                    if (schedDate && customerId && projectId && topic) {
                      const newVal = e.target.value ? `${schedDate}T${e.target.value}` : schedDate;
                      scheduleTopic(customerId, projectId, topic.id, newVal);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Metadata</h3>

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

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} placeholder="Add tag…" />
          </div>

          <div className="space-y-2">
            <Label>Keywords</Label>
            <TagInput value={keywords} onChange={setKeywords} placeholder="Add keyword…" />
          </div>
        </div>

        {/* Hero Image */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Hero Image</h3>
          <div className="flex items-center justify-center rounded-md border border-dashed bg-muted/50 p-8">
            <div className="text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">No image</p>
              <Button variant="outline" size="sm" className="mt-2">
                Generate
              </Button>
            </div>
          </div>
        </div>

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
                <span className="font-mono">{item.topicId}</span>
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
      </div>
    </div>
  );
}
