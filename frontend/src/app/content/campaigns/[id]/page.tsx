"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  FileText,
  Linkedin,
  Instagram,
  Twitter,
  Mail,
  Mic,
  Image as ImageIcon,
  Link as LinkIcon,
  FileEdit,
  Plus,
  ExternalLink,
  ChevronDown,
  Video,
  Search,
  Package,
  MessageCircle,
  MessageSquare,
  Pencil,
  Trash2,
  MoreHorizontal,
  Sparkles,
  RefreshCw,
  X,
  Upload,
  Paperclip,
  Loader2,
  ShoppingBag,
  Globe,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import {
  getTopic,
  addFlowInput,
  uploadFlowFile,
  deleteFlowInput,
  createContent,
  deleteContent,
  updateContent,
  getContent,
  getContentTypes,
  reprocessFlowInput,
  updateTopic,
  type ContentTypeDefinition,
} from "@/lib/api";
import { TopicChat } from "@/components/topic-chat";
import type { Topic, FlowInput, ContentItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

// ── Icons & Config ────────────────────────────────────────────

const INPUT_ICONS: Record<string, React.ReactNode> = {
  text: <FileEdit className="h-4 w-4" />,
  transcript: <Mic className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  url: <LinkIcon className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
};

const INPUT_LABELS: Record<string, string> = {
  text: "Note",
  transcript: "Voice Memo",
  image: "Image",
  url: "URL",
  document: "Document",
};

const OUTPUT_ICONS: Record<string, React.ReactNode> = {
  article: <FileText className="h-4 w-4" />,
  guide: <FileText className="h-4 w-4" />,
  social_post: <MessageCircle className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  instagram: <Instagram className="h-4 w-4" />,
  x: <Twitter className="h-4 w-4" />,
  newsletter: <Mail className="h-4 w-4" />,
  tiktok: <Video className="h-4 w-4" />,
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  planned: { label: "Planned", variant: "secondary" },
  producing: { label: "Producing", variant: "outline" },
  draft: { label: "Draft", variant: "secondary" },
  review: { label: "Review", variant: "outline" },
  approved: { label: "Approved", variant: "outline" },
  delivered: { label: "Delivered", variant: "outline" },
  published: { label: "Published", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

const FALLBACK_OUTPUT_OPTIONS = [
  { contentTypeId: "blog-post", label: "Article", icon: <FileText className="h-3.5 w-3.5" /> },
  { contentTypeId: "linkedin-post", label: "LinkedIn", icon: <Linkedin className="h-3.5 w-3.5" /> },
  { contentTypeId: "instagram-post", label: "Instagram", icon: <Instagram className="h-3.5 w-3.5" /> },
  { contentTypeId: "x-post", label: "X", icon: <Twitter className="h-3.5 w-3.5" /> },
  { contentTypeId: "newsletter", label: "Newsletter", icon: <Mail className="h-3.5 w-3.5" /> },
  { contentTypeId: "tiktok-post", label: "TikTok", icon: <Video className="h-3.5 w-3.5" /> },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  site: <FileText className="h-3.5 w-3.5" />,
  social: <MessageCircle className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  media: <Video className="h-3.5 w-3.5" />,
};

const CT_ICONS: Record<string, React.ReactNode> = {
  "blog-post": <FileText className="h-3.5 w-3.5" />,
  "linkedin-post": <Linkedin className="h-3.5 w-3.5" />,
  "instagram-post": <Instagram className="h-3.5 w-3.5" />,
  "x-post": <Twitter className="h-3.5 w-3.5" />,
  "tiktok-post": <Video className="h-3.5 w-3.5" />,
  "newsletter": <Mail className="h-3.5 w-3.5" />,
};

const CONNECTOR_ICONS: Record<string, React.ReactNode> = {
  shopware: <ShoppingBag className="h-3.5 w-3.5" />,
  wordpress: <Globe className="h-3.5 w-3.5" />,
};

function getContentTypeIcon(ct: { id?: string; connectorType?: string; category: string }): React.ReactNode {
  if (ct.id && CT_ICONS[ct.id]) return CT_ICONS[ct.id];
  if (ct.connectorType && CONNECTOR_ICONS[ct.connectorType]) return CONNECTOR_ICONS[ct.connectorType];
  return CATEGORY_ICONS[ct.category] ?? <FileText className="h-3.5 w-3.5" />;
}

// ── Page ──────────────────────────────────────────────────────

export default function FlowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { customerId, projectId } = useProject();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [outputs, setOutputs] = useState<ContentItem[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [editingBriefing, setEditingBriefing] = useState(false);
  const [briefingDraft, setBriefingDraft] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [addingInput, setAddingInput] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [showAddSource, setShowAddSource] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [reanalyzeNote, setReanalyzeNote] = useState("");
  const [showReanalyzeNote, setShowReanalyzeNote] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data Loading ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const [t, contentRes, types] = await Promise.all([
        getTopic(customerId, projectId, id),
        getContent(customerId, projectId).catch(() => ({ items: [] })),
        getContentTypes(customerId, projectId).catch(() => []),
      ]);
      setTopic(t);
      setContentTypes(types);
      const linked = (contentRes.items ?? []).filter(
        (item: ContentItem) => item.flowId === id || item.topicId === id || item.briefingId === id,
      );
      setOutputs(linked);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId, id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-poll when any input is processing or content is producing
  useEffect(() => {
    const hasProcessing = topic?.inputs?.some((i) => i.processed?.status === "processing");
    const hasProducing = outputs.some((o) => o.status === "planned" || o.status === "producing");
    if (!hasProcessing && !hasProducing) return;
    const interval = setInterval(() => loadData(), 3000);
    return () => clearInterval(interval);
  }, [topic?.inputs, outputs, loadData]);

  // ── Handlers ──────────────────────────────────────────────

  const handleAddSource = async () => {
    if (!sourceText.trim() || !customerId || !projectId || addingInput) return;
    setAddingInput(true);
    try {
      const isUrl = /^https?:\/\/.+/.test(sourceText.trim());
      await addFlowInput(customerId, projectId, id, {
        type: isUrl ? "url" : "text",
        content: sourceText.trim(),
        fileName: sourceTitle.trim() || undefined,
      });
      setSourceText("");
      setSourceTitle("");
      await loadData();
    } catch (err) {
      console.error("Failed to add source:", err);
    } finally {
      setAddingInput(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !customerId || !projectId) return;
    for (const file of Array.from(files)) {
      try {
        await uploadFlowFile(customerId, projectId, id, file);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    await loadData();
  };

  const handleDeleteInput = async (inputId: string) => {
    if (!customerId || !projectId) return;
    try {
      await deleteFlowInput(customerId, projectId, id, inputId);
      await loadData();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleReanalyze = async (inputId: string, note?: string) => {
    if (!customerId || !projectId) return;
    try {
      await reprocessFlowInput(customerId, projectId, id, inputId, note);
      setShowReanalyzeNote(false);
      setReanalyzeNote("");
      setSelectedInputId(null);
      await loadData();
    } catch (err) {
      console.error("Reanalyze failed:", err);
    }
  };

  // Add a content piece WITHOUT starting the pipeline
  const handleAddContent = async (contentTypeId: string) => {
    if (!customerId || !projectId || !topic) return;
    try {
      const categoryMap: Record<string, string> = {
        "blog-post": "article", "linkedin-post": "social_post", "instagram-post": "social_post",
        "x-post": "social_post", "tiktok-post": "social_post", "newsletter": "newsletter",
      };
      const platformMap: Record<string, string> = {
        "linkedin-post": "linkedin", "instagram-post": "instagram", "x-post": "x", "tiktok-post": "tiktok",
      };
      await createContent(customerId, projectId, {
        type: (categoryMap[contentTypeId] ?? "article") as import("@/lib/types").ContentType,
        title: topic.title,
        category: platformMap[contentTypeId],
        flowId: id,
      });
      await loadData();
    } catch (err) {
      console.error("Add content failed:", err);
    }
  };

  // Generate a content piece via Job system (✨ button)
  const handleProduce = async (contentTypeId: string) => {
    if (!customerId || !projectId) return;
    try {
      const { createArticleJob, createSocialJob } = await import("@/lib/api");
      const socialTypes = ["linkedin-post", "instagram-post", "x-post", "tiktok-post"];
      if (socialTypes.includes(contentTypeId)) {
        const platform = contentTypeId.replace("-post", "");
        await createSocialJob(customerId, projectId, { flowId: id, platform });
      } else {
        await createArticleJob(customerId, projectId, { flowId: id });
      }
      await loadData();
    } catch (err) {
      console.error("Produce failed:", err);
    }
  };

  // ── Drag & Drop ───────────────────────────────────────────

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || !customerId || !projectId) return;
    try {
      await updateTopic(customerId, projectId, id, { title: titleDraft.trim() });
      setTopic((t) => t ? { ...t, title: titleDraft.trim() } : t);
      setEditingTitle(false);
      // Notify sidebar to refresh
      window.dispatchEvent(new Event("flows-updated"));
    } catch (err) {
      console.error("Failed to update title:", err);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!customerId || !projectId) return;
    try {
      await deleteContent(customerId, projectId, contentId, true);
      await loadData();
    } catch (err) {
      console.error("Failed to delete content:", err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Flow not found.</p>
        <Link href="/content/campaigns" className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const inputs = topic.inputs ?? [];

  return (
    <div
      className="flex h-full flex-col relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
    >
      {/* Fullscreen drag overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
        >
          <div className="flex items-center gap-4 mb-4 text-muted-foreground/50">
            <FileText className="h-8 w-8" />
            <ImageIcon className="h-8 w-8" />
            <Paperclip className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium">Drop files to add as source</p>
          <p className="text-sm text-muted-foreground mt-1">Documents, images, and more</p>
        </div>
      )}

      {/* ── 2-Column Layout ──────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Main Area ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 lg:px-10 max-w-3xl">

            {/* ── Flow Title ──────────────────────────── */}
            <div className="flex items-start justify-between pt-8 pb-6">
              <div className="flex-1 min-w-0">
                {editingTitle ? (
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    autoFocus
                    className="text-2xl font-semibold bg-transparent outline-none border-b-2 border-primary w-full"
                  />
                ) : (
                  <h1
                    className="text-2xl font-semibold cursor-text hover:text-muted-foreground transition-colors"
                    onClick={() => { setTitleDraft(topic.title); setEditingTitle(true); }}
                  >
                    {topic.title}
                  </h1>
                )}
              </div>
              <Button variant="outline" size="sm" className="shrink-0 ml-3 lg:hidden" onClick={() => setMobileSidebarOpen(true)}>
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />Chat
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => { handleFileUpload(e.target.files); e.target.value = ""; }}
            />

            {/* ── Content ──────────────────────────────── */}
          <div className="pb-12">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold">Content</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Choose what to create — blog posts, social media, newsletters.</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs">
                    <Plus className="mr-1 h-3.5 w-3.5" />Add Content
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {contentTypes.length > 0 ? contentTypes.map((ct) => (
                    <DropdownMenuItem key={ct.id} className="gap-2" onClick={() => handleAddContent(ct.id)}>
                      {CT_ICONS[ct.id] ?? CATEGORY_ICONS[ct.category] ?? <FileText className="h-3.5 w-3.5" />}
                      {ct.label}
                    </DropdownMenuItem>
                  )) : FALLBACK_OUTPUT_OPTIONS.map((opt) => (
                    <DropdownMenuItem key={opt.contentTypeId} className="gap-2" onClick={() => handleAddContent(opt.contentTypeId)}>
                      {opt.icon}{opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {outputs.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed p-10 text-center">
                <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No content yet</p>
                <p className="text-xs text-muted-foreground">Create content pieces and generate them with AI or write manually.</p>
              </div>
            ) : (
              <div className="rounded-xl bg-background border shadow-sm p-5">
                <div className="divide-y">
                {outputs.map((item) => {
                  const status = STATUS_BADGE[item.status] ?? { label: item.status, variant: "secondary" as const };
                  const isProducing = item.status === "producing";
                  return (
                    <Link key={item.id} href={`/content/${item.id}`} className="block py-3 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          {OUTPUT_ICONS[item.category ?? ""] ?? OUTPUT_ICONS[item.type] ?? <FileText className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {({ linkedin: "LinkedIn Post", instagram: "Instagram Post", x: "X Post", tiktok: "TikTok Post" } as Record<string, string>)[item.category ?? ""]
                              ?? ({ article: "Blog Post", guide: "Guide", newsletter: "Newsletter", social_post: "Social Post" } as Record<string, string>)[item.type]
                              ?? item.type.replace("_", " ")}
                          </p>
                        </div>
                        {isProducing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                        <Badge variant={status.variant} className="text-xs shrink-0">{status.label}</Badge>
                        {!isProducing && (
                          <button
                            type="button"
                            title="Generate with AI"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const ctId = item.type === "social_post" ? `${item.category ?? "linkedin"}-post`
                                : item.type === "newsletter" ? "newsletter"
                                : "blog-post";
                              handleProduce(ctId);
                            }}
                            className="p-1.5 rounded-full hover:bg-violet-50 text-muted-foreground hover:text-violet-600 transition-colors shrink-0"
                          >
                            <Sparkles className="h-4 w-4" />
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                            <button type="button" className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/content/${item.id}`}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                              </Link>
                            </DropdownMenuItem>
                            {!isProducing && (
                              <DropdownMenuItem onClick={(e) => { e.preventDefault();
                                const ctId = item.type === "social_post" ? `${item.category ?? "linkedin"}-post`
                                  : item.type === "newsletter" ? "newsletter"
                                  : "blog-post";
                                handleProduce(ctId);
                              }}>
                                <Sparkles className="mr-2 h-3.5 w-3.5" />Generate with AI
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.preventDefault(); handleDeleteContent(item.id); }}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Link>
                  );
                })}
                </div>

                {/* Generate All with AI button */}
                {outputs.some((o) => o.status === "planned" || o.status === "draft") && (
                  <div className="mt-4 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-4">
                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={async () => {
                        if (!customerId || !projectId) return;
                        try {
                          const { createArticleJob, createSocialJob } = await import("@/lib/api");
                          const socialTypes = ["linkedin-post", "instagram-post", "x-post", "tiktok-post"];
                          for (const item of outputs.filter((o) => o.status === "planned" || o.status === "draft")) {
                            const ctId = item.type === "social_post" ? `${item.category ?? "linkedin"}-post`
                              : item.type === "newsletter" ? "newsletter" : "blog-post";
                            if (socialTypes.includes(ctId)) {
                              await createSocialJob(customerId, projectId, { flowId: id, platform: ctId.replace("-post", ""), contentId: item.id });
                            } else {
                              await createArticleJob(customerId, projectId, { flowId: id, contentId: item.id });
                            }
                          }
                          await loadData();
                        } catch (err) {
                          console.error("Generate all failed:", err);
                        }
                      }}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />Generate All with AI
                    </Button>
                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 text-center">
                      Articles are generated first, then social posts can reference them.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Briefing ──────────────────────────────── */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Briefing</h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setBriefingDraft(topic?.briefing ?? ""); setEditingBriefing(true); }}>
                <Pencil className="mr-1 h-3.5 w-3.5" />Edit
              </Button>
            </div>
            <div
              className="rounded-xl border bg-background shadow-sm p-5 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => { setBriefingDraft(topic?.briefing ?? ""); setEditingBriefing(true); }}
            >
              <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                {topic?.briefing || "Describe your project — target audience, goals, key messages, tone..."}
              </p>
            </div>
          </div>

          {/* ── Sources ──────────────────────────────── */}
          <div className="mt-6 pb-12">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Sources</h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAddSource(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />Add Source
              </Button>
            </div>

            {inputs.length > 0 ? (
              <div className="rounded-xl border bg-background shadow-sm p-5">
                <div className="divide-y">
                  {inputs.map((input) => {
                    const status = input.processed?.status;
                    const isProcessing = status === "processing";
                    const isCompleted = status === "completed";
                    const isFailed = status === "failed";
                    const notProcessed = !status || status === "pending";
                    const hasSummary = isCompleted && (input.processed?.summary || input.processed?.description);

                    return (
                      <div
                        key={input.id}
                        className="flex items-center gap-3 py-3 group transition-colors hover:bg-muted/20 cursor-pointer"
                        onClick={() => hasSummary && setSelectedInputId(input.id)}
                      >
                        <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          {INPUT_ICONS[input.type] ?? <FileText className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{input.fileName ?? INPUT_LABELS[input.type] ?? input.type}</span>
                          <p className="text-xs text-muted-foreground">
                            {INPUT_LABELS[input.type] ?? input.type}
                            {input.createdAt && ` · ${formatDistanceToNow(new Date(input.createdAt), { addSuffix: true })}`}
                          </p>
                        </div>
                        {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500 shrink-0" />}
                        {isCompleted && <span className="text-xs text-emerald-500 shrink-0">Analyzed</span>}
                        {isFailed && <span className="text-xs text-destructive shrink-0">Failed</span>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {hasSummary && (
                              <DropdownMenuItem onClick={() => setSelectedInputId(input.id)}>
                                <Search className="mr-2 h-3.5 w-3.5" />View Summary
                              </DropdownMenuItem>
                            )}
                            {(notProcessed || isFailed) && (
                              <DropdownMenuItem onClick={() => handleReanalyze(input.id)}>
                                <RefreshCw className="mr-2 h-3.5 w-3.5" />{isFailed ? "Retry" : "Analyze"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteInput(input.id)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/15"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex items-center justify-center gap-2 mb-3 text-muted-foreground/30">
                  <Upload className="h-5 w-5" />
                  <Paperclip className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium mb-1">Add context for your content</p>
                <p className="text-xs text-muted-foreground mb-4">Upload files, paste URLs, or add notes to help the AI understand what you need.</p>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowAddSource(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Add Source
                </Button>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* ── Right Sidebar: Chat ──────────────────── */}
        <div className="hidden lg:flex w-[400px] shrink-0 flex-col pt-[6.5rem] pr-6 pb-6">
          <div className="flex-1 flex flex-col rounded-xl border bg-background shadow-sm overflow-hidden">
            <div className="shrink-0 px-4 py-3 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />Chat
              </h3>
            </div>
            {customerId && projectId && (
              <TopicChat
                customerId={customerId}
                projectId={projectId}
                topicId={id}
                onTopicUpdated={(t) => { setTopic(t); loadData(); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile Chat Overlay ──────────────────── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex justify-end lg:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative w-full max-w-md bg-background border-l shadow-xl flex flex-col h-full animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />Chat
              </h3>
              <button type="button" onClick={() => setMobileSidebarOpen(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {customerId && projectId && (
              <TopicChat customerId={customerId} projectId={projectId} topicId={id} onTopicUpdated={(t) => { setTopic(t); loadData(); }} />
            )}
          </div>
        </div>
      )}

      {/* ── Briefing Edit Dialog ──────────────────────── */}
      <Dialog open={editingBriefing} onOpenChange={setEditingBriefing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Briefing</DialogTitle>
          </DialogHeader>
          <textarea
            value={briefingDraft}
            onChange={(e) => setBriefingDraft(e.target.value)}
            placeholder="Describe what this campaign is about — target audience, goals, key messages, tone..."
            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[160px]"
            rows={6}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingBriefing(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              if (!customerId || !projectId || !topic) return;
              try {
                await updateTopic(customerId, projectId, id, { briefing: briefingDraft } as Partial<import("@/lib/types").Topic>);
                setTopic({ ...topic, briefing: briefingDraft });
                setEditingBriefing(false);
              } catch { /* ignore */ }
            }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Source Dialog (Step 1: Drop + Buttons) ── */}
      <Dialog open={showAddSource} onOpenChange={(open) => { setShowAddSource(open); if (!open) setSourceText(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Sources</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/15"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => { handleDrop(e); setShowAddSource(false); }}
            >
              <Upload className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Drop files here</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { fileInputRef.current?.click(); setShowAddSource(false); }}
                className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 hover:bg-muted transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium">Upload</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowAddSource(false); setShowTextInput(true); }}
                className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 hover:bg-muted transition-colors"
              >
                <FileEdit className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium">Text or URL</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Text/URL Input Dialog (Step 2) ──────────────── */}
      <Dialog open={showTextInput} onOpenChange={(open) => { setShowTextInput(open); if (!open) { setSourceText(""); setSourceTitle(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Text Source</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Paste a URL or type text to add as a source for this flow.</p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title (optional)</label>
              <Input
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
                placeholder="e.g. Team Onboarding Notes"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Text</label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste URL or type text here..."
                rows={6}
                autoFocus
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[150px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowTextInput(false); setShowAddSource(true); }}>Back</Button>
            <Button size="sm" onClick={() => { handleAddSource(); setShowTextInput(false); }} disabled={!sourceText.trim() || addingInput}>
              {addingInput && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Source Detail Dialog ─────────────────────────── */}
      <Dialog open={!!selectedInputId} onOpenChange={(open) => { if (!open) { setSelectedInputId(null); setShowReanalyzeNote(false); setReanalyzeNote(""); } }}>
        <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[85vh] overflow-y-auto pt-10">
          {(() => {
            const input = inputs.find((i) => i.id === selectedInputId);
            if (!input?.processed) return null;
            const p = input.processed;
            return (
              <>
                {/* Header Card + Actions */}
                <div className="rounded-xl bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center text-muted-foreground shadow-sm">
                      {INPUT_ICONS[input.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{input.fileName ?? INPUT_LABELS[input.type] ?? input.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {INPUT_LABELS[input.type] ?? input.type}
                        {input.createdAt && ` · ${formatDistanceToNow(new Date(input.createdAt), { addSuffix: true })}`}
                        {p.status === "completed" && " · Analyzed"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => { handleReanalyze(input.id); }}>Refine</Button>
                      <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setShowReanalyzeNote(!showReanalyzeNote)}>Refine with note</Button>
                    </div>
                  </div>
                  {input.type === "url" && (
                    <a href={input.content} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 ml-[52px]">
                      {input.content} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {showReanalyzeNote && (
                    <div className="flex gap-2 ml-[52px]">
                      <Input
                        value={reanalyzeNote}
                        onChange={(e) => setReanalyzeNote(e.target.value)}
                        placeholder="Focus on..."
                        className="text-sm"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter" && reanalyzeNote.trim()) handleReanalyze(input.id, reanalyzeNote); }}
                      />
                      <Button size="sm" onClick={() => reanalyzeNote.trim() && handleReanalyze(input.id, reanalyzeNote)}>Go</Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Summary */}
                  {p.summary && (
                    <div className="rounded-xl bg-muted/30 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</h4>
                      <p className="text-sm leading-relaxed">{p.summary}</p>
                    </div>
                  )}

                  {/* Description */}
                  {p.description && (
                    <div className="rounded-xl bg-muted/30 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h4>
                      <p className="text-sm leading-relaxed">{p.description}</p>
                    </div>
                  )}

                  {/* Key Points */}
                  {p.keyPoints && p.keyPoints.length > 0 && (
                    <div className="rounded-xl bg-muted/30 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Key Points</h4>
                      <ul className="text-sm space-y-1.5">
                        {p.keyPoints.map((point, i) => (
                          <li key={i} className="flex gap-2"><span className="text-muted-foreground shrink-0">•</span><span>{point}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Transcript */}
                  {p.transcript && (
                    <div className="rounded-xl bg-muted/30 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transcript</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.transcript.slice(0, 2000)}</p>
                    </div>
                  )}

                  {/* Extracted Text */}
                  {p.extractedText && (
                    <div className="rounded-xl bg-muted/30 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Extracted Text</h4>
                      <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{p.extractedText.slice(0, 1000)}</p>
                    </div>
                  )}

                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
