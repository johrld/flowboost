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
  ArrowUp,
  RefreshCw,
  Copy,
  RotateCcw,
  Bot,
  User,
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
  getTopicChat,
  sendTopicChat,
  addFlowInput,
  uploadFlowFile,
  deleteFlowInput,
  createContent,
  deleteContent,
  updateContent,
  produceFlowOutput,
  getContent,
  getContentTypes,
  reprocessFlowInput,
  updateTopic,
  type ContentTypeDefinition,
} from "@/lib/api";
import type { Topic, FlowInput, ChatMessage, ContentItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";

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

// ── Thinking Animation ────────────────────────────────────────

const THINKING_PHRASES = [
  "Thinking",
  "Reading your sources",
  "Analyzing context",
  "Crafting response",
];

function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const phrase = THINKING_PHRASES[phraseIndex];

  useEffect(() => {
    if (charIndex < phrase.length) {
      const timer = setTimeout(() => setCharIndex((c) => c + 1), 30);
      return () => clearTimeout(timer);
    }
    // Pause at end, then move to next phrase
    const timer = setTimeout(() => {
      setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
      setCharIndex(0);
    }, 1500);
    return () => clearTimeout(timer);
  }, [charIndex, phrase.length, phraseIndex]);

  return (
    <div className="flex gap-3">
      <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm text-muted-foreground">
          {phrase.slice(0, charIndex)}
          <span className="inline-block w-[2px] h-4 bg-muted-foreground/50 ml-0.5 animate-pulse align-text-bottom" />
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function FlowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { customerId, projectId } = useProject();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [outputs, setOutputs] = useState<ContentItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Data Loading ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const [t, chat, contentRes, types] = await Promise.all([
        getTopic(customerId, projectId, id),
        getTopicChat(customerId, projectId, id).catch(() => []),
        getContent(customerId, projectId).catch(() => ({ items: [] })),
        getContentTypes(customerId, projectId).catch(() => []),
      ]);
      setTopic(t);
      setChatMessages(chat);
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

  // Auto-scroll chat only when new messages arrive (not on initial load)
  const prevMsgCount = useRef(chatMessages.length);
  useEffect(() => {
    if (chatMessages.length > prevMsgCount.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages.length]);

  // ── Handlers ──────────────────────────────────────────────

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !customerId || !projectId || sending) return;
    setSending(true);
    try {
      await sendTopicChat(customerId, projectId, id, message.trim());
      setChatInput("");
      const chat = await getTopicChat(customerId, projectId, id);
      setChatMessages(chat);
      const t = await getTopic(customerId, projectId, id);
      setTopic(t);
    } catch (err) {
      console.error("Chat failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleSendChat = async () => {
    handleSendMessage(chatInput);
  };

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

  // Generate a content piece WITH pipeline (✨ button)
  const handleProduce = async (contentTypeId: string) => {
    if (!customerId || !projectId) return;
    try {
      await produceFlowOutput(customerId, projectId, id, { contentTypeId });
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
        <Link href="/flows" className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to Flows
        </Link>
      </div>
    );
  }

  const inputs = topic.inputs ?? [];

  return (
    <div
      className="h-screen overflow-y-auto relative"
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

      <div className="max-w-3xl mx-auto px-6">

        {/* ── Flow Title ────────────────────────────────── */}
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
          <Button variant="outline" size="sm" className="shrink-0 ml-3" onClick={() => setChatOpen(true)}>
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

        {/* ── 1. Briefing ──────────────────────────────── */}
        <div className="pb-12 space-y-10">
          <div>
            <div className="mb-3">
              <h3 className="text-base font-semibold">Briefing</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Describe your project — what is it about, who is the audience, what tone should the content have?</p>
            </div>
            <textarea
              value={topic?.briefing ?? ""}
              onChange={(e) => {
                if (topic) setTopic({ ...topic, briefing: e.target.value });
              }}
              onBlur={async () => {
                if (!customerId || !projectId || !topic) return;
                try {
                  await updateTopic(customerId, projectId, id, { briefing: topic.briefing ?? "" } as Partial<import("@/lib/types").Topic>);
                } catch { /* ignore */ }
              }}
              placeholder="Describe what this campaign is about — target audience, goals, key messages, tone..."
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[80px]"
              rows={3}
            />
          </div>

          {/* ── 2. Sources ──────────────────────────────── */}
          <div>
            <div className="mb-3">
              <h3 className="text-base font-semibold">Sources</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Add reference material — URLs, documents, images, or notes to give the AI context.</p>
            </div>
            <div className={inputs.length > 0 ? "rounded-xl bg-background border shadow-sm p-5" : ""}>

            {inputs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddSource(true)}
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-3 w-full border-b"
              >
                <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </div>
                Add Source
              </button>
            )}

            {inputs.length > 0 && (
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{input.fileName ?? INPUT_LABELS[input.type] ?? input.type}</span>
                          {isProcessing && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                              <Loader2 className="h-3 w-3 animate-spin" />Analyzing
                            </span>
                          )}
                          {isCompleted && <span className="text-xs text-emerald-500">Analyzed</span>}
                          {isFailed && <span className="text-xs text-destructive">Failed</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {INPUT_LABELS[input.type] ?? input.type}
                          {input.createdAt && ` · ${formatDistanceToNow(new Date(input.createdAt), { addSuffix: true })}`}
                        </p>
                        {input.type === "url" && (
                          <a href={input.content} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {input.content.replace(/^https?:\/\//, "").slice(0, 50)}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {hasSummary && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{input.processed?.summary ?? input.processed?.description}</p>
                        )}
                        {isFailed && <p className="text-xs text-destructive/70 mt-0.5 truncate">{input.processed?.error}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(notProcessed || isFailed) && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleReanalyze(input.id); }} className="text-xs text-primary hover:underline px-2 py-1">
                            {isFailed ? "Retry" : "Analyze"}
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {hasSummary && (
                              <DropdownMenuItem onClick={() => setSelectedInputId(input.id)}>
                                <Search className="mr-2 h-3.5 w-3.5" />View Summary
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleReanalyze(input.id)}>
                              <RefreshCw className="mr-2 h-3.5 w-3.5" />Refine
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteInput(input.id)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {inputs.length === 0 && (
              <div
                className={`rounded-xl border-2 border-dashed p-14 text-center transition-colors ${
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
                <p className="text-xs text-muted-foreground mb-5">Upload files, paste URLs, or add notes to help the AI understand what you need.</p>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowAddSource(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Add Source
                </Button>
              </div>
            )}
            </div>
          </div>

          {/* ── 3. Content ──────────────────────────────── */}
          <div>
            <div className="mb-3">
              <h3 className="text-base font-semibold">Content</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Choose what to create — blog posts, social media, newsletters. Generate with AI or write manually.</p>
            </div>
            <div className={outputs.length > 0 ? "rounded-xl bg-background border shadow-sm p-5" : ""}>

            {outputs.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed p-10 text-center">
                <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No content yet</p>
                <p className="text-xs text-muted-foreground mb-4">Create content pieces and generate them with AI or write manually.</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />Add Content
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
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
            ) : (
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-3 w-full border-b">
                      <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                        <Plus className="h-4 w-4" />
                      </div>
                      Add Content
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
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

                <div className="divide-y mt-1">
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
                          const { produceAllFlowOutputs } = await import("@/lib/api");
                          await produceAllFlowOutputs(customerId, projectId, id);
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
<<<<<<< HEAD

              {/* Onboarding Checklist */}
              {(outputs.length === 0 || inputs.length === 0) && (
                <div className="rounded-xl bg-muted/30 p-4 mb-4">
                  <p className="text-sm font-medium mb-3">Get started</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-sm">
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${inputs.length > 0 ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30"}`}>
                        {inputs.length > 0 && <Check className="h-3 w-3" />}
                      </div>
                      <button type="button" onClick={() => setBottomTab("sources")} className={`hover:underline ${inputs.length > 0 ? "text-muted-foreground line-through" : ""}`}>
                        Add sources (URLs, documents, images)
                      </button>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${outputs.length > 0 ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30"}`}>
                        {outputs.length > 0 && <Check className="h-3 w-3" />}
                      </div>
                      <span className={outputs.length > 0 ? "text-muted-foreground line-through" : ""}>
                        Create your first content piece
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {outputs.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed p-10 text-center">
                  <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">No content yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Create content pieces and generate them with AI or write manually.</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-full">
                        <Plus className="mr-1.5 h-3.5 w-3.5" />Create Content
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {contentTypes.length > 0 ? contentTypes.map((ct) => (
                        <DropdownMenuItem key={ct.id} className="gap-2" onClick={() => handleProduce(ct.id)}>
                          {getContentTypeIcon(ct)}
                          {ct.label}
                        </DropdownMenuItem>
                      )) : FALLBACK_OUTPUT_OPTIONS.map((opt) => (
                        <DropdownMenuItem key={opt.contentTypeId} className="gap-2" onClick={() => handleProduce(opt.contentTypeId)}>
                          {opt.icon}{opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div>
                  {/* + Create Content row */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-3 w-full border-b">
                        <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                          <Plus className="h-4 w-4" />
                        </div>
                        Create Content
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {contentTypes.length > 0 ? contentTypes.map((ct) => (
                        <DropdownMenuItem key={ct.id} className="gap-2" onClick={() => handleProduce(ct.id)}>
                          {getContentTypeIcon(ct)}
                          {ct.label}
                        </DropdownMenuItem>
                      )) : FALLBACK_OUTPUT_OPTIONS.map((opt) => (
                        <DropdownMenuItem key={opt.contentTypeId} className="gap-2" onClick={() => handleProduce(opt.contentTypeId)}>
                          {opt.icon}{opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="divide-y mt-1">
                  {outputs.map((item) => {
                    const status = STATUS_BADGE[item.status] ?? { label: item.status, variant: "secondary" as const };
                    const isProducing = item.status === "producing";
                    const isPlanned = item.status === "planned";
                    return (
                      <Link key={item.id} href={`/content/${item.id}`} className="block py-3 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                        {/* Header row */}
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            {(() => {
                              const ct = item.contentTypeId ? contentTypes.find((t) => t.id === item.contentTypeId) : null;
                              if (ct) return getContentTypeIcon(ct);
                              return OUTPUT_ICONS[item.category ?? ""] ?? OUTPUT_ICONS[item.type] ?? <FileText className="h-4 w-4" />;
                            })()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const ct = item.contentTypeId ? contentTypes.find((t) => t.id === item.contentTypeId) : null;
                                if (ct) return ct.label;
                                return ({ linkedin: "LinkedIn Post", instagram: "Instagram Post", x: "X Post", tiktok: "TikTok Post" } as Record<string, string>)[item.category ?? ""]
                                  ?? ({ article: "Article", guide: "Guide", newsletter: "Newsletter", social_post: "Social Post" } as Record<string, string>)[item.type]
                                  ?? item.type.replace("_", " ");
                              })()}
                            </p>
                          </div>
                          {isProducing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                          <Badge variant={status.variant} className="text-xs shrink-0">{status.label}</Badge>
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
                                  // Derive contentTypeId from content item type + category
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
                </div>
              )}
            )
            </div>
          </div>
        </div>
      </div>

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

      {/* ── Chat Sidebar Overlay ──────────────────────── */}
      {chatOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20" onClick={() => setChatOpen(false)} />
          {/* Panel */}
          <div className="relative w-full max-w-md bg-background border-l shadow-xl flex flex-col h-full animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h3 className="text-sm font-semibold">Chat</h3>
              <button type="button" onClick={() => setChatOpen(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center">
                  <MessageCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">Chat with AI</p>
                  <p className="text-xs text-muted-foreground">Brainstorm ideas, get feedback on your content, or ask for help.</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  msg.role === "user" ? (
                    <div key={i} className="flex justify-end group">
                      <div className="max-w-[80%]">
                        <div className="bg-muted rounded-2xl rounded-br-sm px-4 py-2.5">
                          <p className="text-sm">{msg.content}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatDistanceToNow(new Date(msg.ts), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3 group">
                      <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted mt-0.5">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-hr:my-3 prose-blockquote:my-2 prose-a:text-primary">
                          <ReactMarkdown>{msg.content.replace(/```json\s*\n?\{[\s\S]*?\}\s*\n?```/g, "").trim()}</ReactMarkdown>
                        </div>
                        {/* Apply Actions Button */}
                        {(() => {
                          const jsonMatch = msg.content.match(/```json\s*\n?([\s\S]*?)\n?```/);
                          if (!jsonMatch) return null;
                          try {
                            const parsed = JSON.parse(jsonMatch[1]) as { actions?: Array<{ type: string; value?: string; contentTypeId?: string; updates?: Record<string, unknown> }>; updates?: Record<string, unknown> };
                            const actions = parsed.actions ?? (parsed.updates ? [{ type: "update_content", updates: parsed.updates }] : []);
                            if (actions.length === 0) return null;
                            // Show what will change
                            const actionLabels: Record<string, string> = {
                              update_briefing: "Briefing",
                              update_title: "Title",
                              update_direction: "Direction",
                              create_content: "Create content piece",
                              update_content: "Content",
                            };
                            return (
                              <div className="mt-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-3 space-y-2">
                                {actions.map((a, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="font-medium text-violet-700 dark:text-violet-400">{actionLabels[a.type] ?? a.type}:</span>{" "}
                                    <span className="text-foreground/80">
                                      {a.value ? (a.value.length > 150 ? a.value.slice(0, 150) + "..." : a.value) : a.contentTypeId ?? JSON.stringify(a.updates ?? {}).slice(0, 100)}
                                    </span>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900 dark:hover:bg-violet-800 px-3 py-1.5 rounded-lg transition-colors w-full justify-center"
                                onClick={async () => {
                                  if (!customerId || !projectId || !topic) return;
                                  for (const action of actions) {
                                    try {
                                      if (action.type === "update_briefing" && action.value) {
                                        await updateTopic(customerId, projectId, id, { briefing: action.value } as Partial<Topic>);
                                        setTopic((prev) => prev ? { ...prev, briefing: action.value } : prev);
                                      } else if (action.type === "update_title" && action.value) {
                                        await updateTopic(customerId, projectId, id, { title: action.value } as Partial<Topic>);
                                        setTopic((prev) => prev ? { ...prev, title: action.value! } : prev);
                                      } else if (action.type === "update_direction" && action.value) {
                                        await updateTopic(customerId, projectId, id, { direction: action.value } as Partial<Topic>);
                                        setTopic((prev) => prev ? { ...prev, direction: action.value } : prev);
                                      } else if (action.type === "create_content" && action.contentTypeId) {
                                        const { createContent } = await import("@/lib/api");
                                        const catMap: Record<string, string> = { "blog-post": "article", "linkedin-post": "social_post", "instagram-post": "social_post", "x-post": "social_post", "tiktok-post": "social_post", "newsletter": "newsletter" };
                                        const platMap: Record<string, string> = { "linkedin-post": "linkedin", "instagram-post": "instagram", "x-post": "x", "tiktok-post": "tiktok" };
                                        await createContent(customerId, projectId, { type: (catMap[action.contentTypeId] ?? "article") as import("@/lib/types").ContentType, title: topic.title, category: platMap[action.contentTypeId], flowId: id });
                                      }
                                    } catch (err) { console.error("Action failed:", err); }
                                  }
                                  await loadData();
                                }}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Apply {actions.length > 1 ? `${actions.length} changes` : "changes"}
                                </button>
                              </div>
                            );
                          } catch { return null; }
                        })()}
                        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(msg.content)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                            title="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs text-muted-foreground ml-1">
                            {formatDistanceToNow(new Date(msg.ts), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                ))
              )}
              {sending && <ThinkingIndicator />}
              <div ref={chatEndRef} />
            </div>
            {/* Chat Input */}
            <div className="p-4 border-t shrink-0">
              <div className="rounded-2xl border shadow-sm px-4 py-3 bg-background">
                <div className="flex gap-3 items-center">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                    placeholder={`Message in ${topic.title.slice(0, 30)}...`}
                    disabled={sending}
                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || sending}
                    className="shrink-0 p-1.5 rounded-lg bg-foreground text-background disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
