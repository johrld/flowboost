"use client";

import { use, useState, useEffect, useCallback } from "react";
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
import { ContentStatusBadge, ContentTypeBadge } from "@/components/status-badge";
import { TiptapEditor } from "@/components/tiptap-editor";
import { useProject } from "@/lib/project-context";
import {
  getContentItem,
  getContentFile,
  updateContent,
  submitContent,
  approveContent,
  rejectContent,
  publishContent,
  requestContentUpdate,
  archiveContent,
  restoreContent,
} from "@/lib/api";
import type { ContentItem, ContentVersion } from "@/lib/types";
import {
  ArrowLeft,
  Save,
  Check,
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
} from "lucide-react";
import Link from "next/link";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Per-language metadata parsed from frontmatter
  const [metaByLang, setMetaByLang] = useState<Record<string, LangMeta>>({});

  // Editor content per language (body only, no frontmatter)
  const [activeLang, setActiveLang] = useState("de");
  const [editorContent, setEditorContent] = useState<Record<string, string>>({});

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

      // Load editor content from latest version's markdown files
      if (data.versions && data.versions.length > 0) {
        const latest = data.versions[data.versions.length - 1];
        const rawContent: Record<string, string> = {};
        await Promise.all(
          latest.languages.map(async (lang) => {
            try {
              rawContent[lang.lang] = await getContentFile(
                customerId!, projectId!, id, latest.id, lang.lang,
              );
            } catch {
              rawContent[lang.lang] = "";
            }
          }),
        );

        // Parse frontmatter per language → metadata + stripped body
        const allMeta: Record<string, LangMeta> = {};
        const bodyContent: Record<string, string> = {};
        for (const lang of latest.languages) {
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

        if (latest.languages.length > 0) {
          setActiveLang(latest.languages[0].lang);
        }
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

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  // Save metadata
  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const updated = await updateContent(customerId, projectId, item.id, {
        title,
        description: description || undefined,
        category: category || undefined,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
      });
      setItem({ ...item, ...updated });
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
  const origMeta = metaByLang[activeLang];
  const hasChanges = origMeta
    ? title !== origMeta.title || description !== origMeta.description || category !== origMeta.category
    : title !== (item.title ?? "") || description !== (item.description ?? "") || category !== (item.category ?? "");

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
          <div className="flex-1">
            <h1 className="text-xl font-bold">{item.title || "Untitled"}</h1>
            <div className="flex items-center gap-2 mt-1">
              <ContentStatusBadge status={item.status} />
              <ContentTypeBadge type={item.type} />
              {latestVersion && (
                <span className="text-xs text-muted-foreground">
                  v{latestVersion.versionNumber}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Updated: {new Date(item.updatedAt).toLocaleDateString("de-DE")}
              </span>
            </div>
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

        {/* Language Tabs + Editor */}
        <Tabs value={activeLang} onValueChange={setActiveLang}>
          <TabsList>
            {latestVersion?.languages.map((lang) => (
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

          {(latestVersion?.languages ?? [{ lang: "de", slug: "", title: "", description: "", contentPath: "" }]).map((lang) => (
            <TabsContent key={lang.lang} value={lang.lang} className="mt-4">
              {editorContent[lang.lang] ? (
                <TiptapEditor
                  content={editorContent[lang.lang]}
                  onChange={(md) =>
                    setEditorContent((prev) => ({ ...prev, [lang.lang]: md }))
                  }
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
            {faqs.map((faq, i) => (
              <div key={i} className="flex gap-3 items-start rounded-md border p-3">
                <Badge variant="outline" className="text-xs shrink-0 mt-1">
                  Q{i + 1}
                </Badge>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Question"
                    value={faq.question}
                    onChange={(e) => {
                      const updated = [...faqs];
                      updated[i] = { ...updated[i], question: e.target.value };
                      setFaqs(updated);
                    }}
                    className="text-sm"
                  />
                  <Textarea
                    placeholder="Answer"
                    value={faq.answer}
                    onChange={(e) => {
                      const updated = [...faqs];
                      updated[i] = { ...updated[i], answer: e.target.value };
                      setFaqs(updated);
                    }}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Version History */}
        {versions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Version History ({versions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...versions].reverse().map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <Badge variant="outline" className="text-xs">
                      v{v.versionNumber}
                    </Badge>
                    <span className="text-muted-foreground">
                      {v.languages.map((l) => l.lang.toUpperCase()).join(", ")}
                    </span>
                    {v.text && (
                      <span className="text-muted-foreground">
                        {v.text.wordCount}w
                      </span>
                    )}
                    {v.seoScore != null && (
                      <span className="text-muted-foreground">
                        SEO: {v.seoScore}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString("de-DE")} — {v.createdBy}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Sidebar - Metadata */}
      <div className="w-80 shrink-0 overflow-y-auto border-l bg-muted/30 p-6 space-y-6">
        {/* Metadata */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Metadata</h3>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/70 characters
            </p>
          </div>

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
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="keyword1, keyword2"
            />
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
