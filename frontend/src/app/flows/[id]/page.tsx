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
  Pencil,
  Trash2,
  MoreHorizontal,
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
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import {
  getTopic,
  getTopicChat,
  sendTopicChat,
  addFlowInput,
  uploadFlowFile,
  deleteFlowInput,
  deleteContent,
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
import { ChatOnboarding } from "@/components/chat-onboarding";

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
  { type: "article", label: "Article", icon: <FileText className="h-3.5 w-3.5" /> },
  { type: "social_post", platform: "linkedin", label: "LinkedIn", icon: <Linkedin className="h-3.5 w-3.5" /> },
  { type: "social_post", platform: "instagram", label: "Instagram", icon: <Instagram className="h-3.5 w-3.5" /> },
  { type: "social_post", platform: "x", label: "X", icon: <Twitter className="h-3.5 w-3.5" /> },
  { type: "newsletter", label: "Newsletter", icon: <Mail className="h-3.5 w-3.5" /> },
  { type: "social_post", platform: "tiktok", label: "TikTok", icon: <Video className="h-3.5 w-3.5" /> },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  site: <FileText className="h-3.5 w-3.5" />,
  social: <MessageCircle className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  media: <Video className="h-3.5 w-3.5" />,
};

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
  const [bottomTab, setBottomTab] = useState<"chat" | "sources" | "content">("chat");
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
  const [onboardingContentType, setOnboardingContentType] = useState<ContentTypeDefinition | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState<Record<string, string>>({});
  const [onboardingShowUpload, setOnboardingShowUpload] = useState(false);
  const [onboardingUploadedFiles, setOnboardingUploadedFiles] = useState<string[]>([]);
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
        (item: ContentItem) => item.briefingId === id || item.topicId === id,
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

  const handleProduce = async (type: string, platform?: string) => {
    if (!customerId || !projectId) return;
    try {
      await produceFlowOutput(customerId, projectId, id, { type, platform });
      setBottomTab("content");
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
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
    >
      {/* Fullscreen drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="shrink-0 ml-4">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create
                <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {contentTypes.length > 0 ? contentTypes.map((ct) => {
                let apiType = "article";
                let platform: string | undefined;
                if (ct.category === "social") { apiType = "social_post"; platform = ct.id.replace("-post", ""); }
                else if (ct.category === "email") { apiType = "newsletter"; }
                return (
                  <DropdownMenuItem key={ct.id} className="gap-2" onClick={() => handleProduce(apiType, platform)}>
                    {CATEGORY_ICONS[ct.category] ?? <FileText className="h-3.5 w-3.5" />}
                    {ct.label}
                  </DropdownMenuItem>
                );
              }) : FALLBACK_OUTPUT_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.platform ?? opt.type} className="gap-2" onClick={() => handleProduce(opt.type, opt.platform)}>
                  {opt.icon}{opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => { handleFileUpload(e.target.files); e.target.value = ""; }}
        />

        {/* ── Tabs: Chat | Sources | Content ────────────── */}
        <div className="pb-12">
          <div className="flex items-center gap-2 mb-6">
            {(["chat", "sources", "content"] as const).map((tab) => {
              const count = tab === "sources" ? inputs.length : tab === "content" ? outputs.length : chatMessages.length;
              const isActive = bottomTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setBottomTab(tab)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                    isActive
                      ? "bg-muted text-foreground border-border"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}{count > 0 ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>

          {/* ── Chat Tab ──────────────────────────── */}
          {bottomTab === ("chat" as string) && (
            <div className="space-y-4 pb-20">
              {onboardingContentType ? (
                <ChatOnboarding
                  contentType={onboardingContentType}
                  step={onboardingStep}
                  answers={onboardingAnswers}
                  onStepChange={setOnboardingStep}
                  onAnswersChange={setOnboardingAnswers}
                  showUpload={onboardingShowUpload}
                  onShowUploadChange={setOnboardingShowUpload}
                  uploadedFiles={onboardingUploadedFiles}
                  onUploadedFilesChange={setOnboardingUploadedFiles}
                  sources={inputs}
                  onComplete={(answers, summary) => {
                    if (!onboardingContentType) return;
                    setOnboardingContentType(null);
                    setOnboardingDone(true);
                    handleSendMessage(summary);
                    // If user said they want to add sources, switch to Sources tab
                    if (answers.sources?.includes("add them now")) {
                      setTimeout(() => setBottomTab("sources"), 500);
                    }
                  }}
                  onFileUpload={async (files) => { await handleFileUpload(files); }}
                  onCancel={() => setOnboardingContentType(null)}
                />
              ) : chatMessages.length === 0 && !onboardingDone ? (
                <div className="space-y-6">
                  {/* AI Welcome */}
                  <div className="flex gap-3">
                    <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm mb-4">What would you like to create? Pick a format or just tell me your idea.</p>
                      <p className="text-xs text-muted-foreground mb-4">Have URLs, documents, or images? Add them under <button type="button" onClick={() => setBottomTab("sources")} className="text-primary hover:underline">Sources</button> — I'll analyze them automatically.</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(contentTypes.length > 0 ? contentTypes : [
                          { id: "article", label: "Article", category: "site" },
                          { id: "linkedin-post", label: "LinkedIn", category: "social" },
                          { id: "instagram-post", label: "Instagram", category: "social" },
                          { id: "x-post", label: "X Post", category: "social" },
                          { id: "newsletter", label: "Newsletter", category: "email" },
                          { id: "tiktok-post", label: "TikTok", category: "social" },
                        ] as ContentTypeDefinition[]).map((ct) => (
                          <button
                            key={ct.id}
                            type="button"
                            onClick={() => { setOnboardingContentType(ct); setOnboardingStep(0); setOnboardingAnswers({}); setOnboardingShowUpload(false); setOnboardingUploadedFiles([]); }}
                            className="flex flex-col items-center gap-1.5 rounded-xl border p-3 hover:bg-muted/50 transition-colors text-center"
                          >
                            <span className="text-muted-foreground">{CATEGORY_ICONS[ct.category] ?? OUTPUT_ICONS[ct.id] ?? <FileText className="h-4 w-4" />}</span>
                            <span className="text-xs font-medium">{ct.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  msg.role === "user" ? (
                    /* User: right-aligned bubble */
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
                    /* AI: left-aligned, no bubble */
                    <div key={i} className="flex gap-3 group">
                      <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted mt-0.5">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-hr:my-3 prose-blockquote:my-2 prose-a:text-primary">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
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
          )}


          {/* ── Sources Tab ───────────────────────── */}
          {bottomTab === "sources" && (
            <div>
              {/* + Add Source as first row (only when sources exist) */}
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

              {/* Empty state: big drop zone (only when no sources yet) */}
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
                    Add Source
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Content Tab ───────────────────────── */}
          {bottomTab === "content" && (
            <div className="space-y-3">
              {outputs.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center">
                  <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">No content yet.</p>
                  <p className="text-xs text-muted-foreground">Click &quot;Create&quot; to generate your first piece.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {outputs.map((item) => {
                    const status = STATUS_BADGE[item.status] ?? { label: item.status, variant: "secondary" as const };
                    const isProducing = item.status === "producing";
                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors group">
                        <Link href={`/content/${item.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-muted-foreground shrink-0">
                            {OUTPUT_ICONS[item.type] ?? <FileText className="h-4 w-4" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{item.type.replace("_", " ")}</p>
                          </div>
                        </Link>
                        {isProducing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                        <Badge variant={status.variant} className="text-xs shrink-0">{status.label}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/content/${item.id}`}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteContent(item.id)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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

      {/* ── Fixed Chat Input (only in Chat tab) ──────────── */}
      {bottomTab === ("chat" as string) && (
        <div className="fixed bottom-0 left-64 right-0 z-20 p-4 bg-background/95 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border shadow-sm px-4 py-3 bg-background">
              <div className="flex gap-3 items-center">
                <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
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
            <div className="h-2" /> {/* spacing so content isn't hidden behind fixed input */}
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
