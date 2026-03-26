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
  ArrowUp,
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
  produceFlowOutput,
  getContent,
  getContentTypes,
  reprocessFlowInput,
  type ContentTypeDefinition,
} from "@/lib/api";
import type { Topic, FlowInput, ChatMessage, ContentItem } from "@/lib/types";
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
  const [bottomTab, setBottomTab] = useState<"chat" | "sources" | "content">("sources");
  const [isDragging, setIsDragging] = useState(false);
  const [addingInput, setAddingInput] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [showAddSource, setShowAddSource] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [reanalyzeNote, setReanalyzeNote] = useState("");
  const [showReanalyzeNote, setShowReanalyzeNote] = useState(false);

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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Handlers ──────────────────────────────────────────────

  const handleSendChat = async () => {
    if (!chatInput.trim() || !customerId || !projectId || sending) return;
    setSending(true);
    try {
      await sendTopicChat(customerId, projectId, id, chatInput.trim());
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

  const handleAddSource = async () => {
    if (!sourceText.trim() || !customerId || !projectId || addingInput) return;
    setAddingInput(true);
    try {
      const isUrl = /^https?:\/\/.+/.test(sourceText.trim());
      await addFlowInput(customerId, projectId, id, {
        type: isUrl ? "url" : "text",
        content: sourceText.trim(),
      });
      setSourceText("");
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
    <div className="h-screen overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6">

        {/* ── Flow Title ────────────────────────────────── */}
        <div className="flex items-start justify-between pt-8 pb-6">
          <h1 className="text-2xl font-semibold">{topic.title}</h1>
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

        {/* ── Chat Input (like ChatGPT) ─────────────────── */}
        <div className="rounded-2xl border shadow-sm px-4 py-3 mb-8">
          <div className="flex gap-3 items-center">
            <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => { handleFileUpload(e.target.files); e.target.value = ""; }}
            />
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
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

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
                      ? "bg-foreground text-background border-foreground"
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
            <div className="space-y-4">
              {chatMessages.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center">
                  <MessageCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet. Start a conversation above.</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(msg.ts), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* ── Sources Tab ───────────────────────── */}
          {bottomTab === "sources" && (
            <div className="space-y-3">
              {inputs.length > 0 && (
                <div className="space-y-1">
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
                        className={`flex items-center gap-3 rounded-lg p-3 group transition-colors ${hasSummary ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/30"}`}
                        onClick={() => hasSummary && setSelectedInputId(input.id)}
                      >
                        <span className="text-muted-foreground shrink-0">{INPUT_ICONS[input.type] ?? <FileText className="h-4 w-4" />}</span>
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
                          {hasSummary && <Search className="h-3.5 w-3.5 text-muted-foreground" />}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteInput(input.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Source Area */}
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
                <p className="text-sm font-medium mb-1">Add more context</p>
                <p className="text-xs text-muted-foreground mb-4">Drop files here or add sources to help the AI understand your content.</p>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowAddSource(true)}>
                  Add Source
                </Button>
              </div>
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
                    const isProducing = item.status === "planned" || item.status === "producing";
                    return (
                      <Link
                        key={item.id}
                        href={`/content/${item.id}`}
                        className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-muted-foreground shrink-0">
                          {OUTPUT_ICONS[item.type] ?? <FileText className="h-4 w-4" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.type.replace("_", " ")}</p>
                        </div>
                        {isProducing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                        <Badge variant={status.variant} className="text-xs shrink-0">{status.label}</Badge>
                      </Link>
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
      <Dialog open={showTextInput} onOpenChange={(open) => { setShowTextInput(open); if (!open) setSourceText(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Text or URL</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Paste a URL, or type text to add as a source for this flow.</p>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste URL or type notes here..."
            rows={6}
            autoFocus
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[120px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowTextInput(false); setShowAddSource(true); }}>Back</Button>
            <Button size="sm" onClick={() => { handleAddSource(); setShowTextInput(false); }} disabled={!sourceText.trim() || addingInput}>
              {addingInput && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Source Detail Dialog ─────────────────────────── */}
      <Dialog open={!!selectedInputId} onOpenChange={(open) => { if (!open) { setSelectedInputId(null); setShowReanalyzeNote(false); setReanalyzeNote(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          {(() => {
            const input = inputs.find((i) => i.id === selectedInputId);
            if (!input?.processed) return null;
            const p = input.processed;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {INPUT_ICONS[input.type]}
                    {input.fileName ?? INPUT_LABELS[input.type] ?? input.type}
                  </DialogTitle>
                  {input.type === "url" && (
                    <a href={input.content} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      {input.content} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </DialogHeader>
                <div className="space-y-4">
                  {p.summary && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Summary</h4>
                      <p className="text-sm leading-relaxed">{p.summary}</p>
                    </div>
                  )}
                  {p.description && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Description</h4>
                      <p className="text-sm leading-relaxed">{p.description}</p>
                    </div>
                  )}
                  {p.keyPoints && p.keyPoints.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Key Points</h4>
                      <ul className="text-sm space-y-1">
                        {p.keyPoints.map((point, i) => (
                          <li key={i} className="flex gap-2"><span className="text-muted-foreground shrink-0">-</span><span>{point}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {p.transcript && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Transcript</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.transcript.slice(0, 2000)}</p>
                    </div>
                  )}
                  {p.extractedText && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Extracted Text</h4>
                      <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{p.extractedText.slice(0, 1000)}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => { handleReanalyze(input.id); }}>Refine</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowReanalyzeNote(!showReanalyzeNote)}>Refine with note</Button>
                  </div>
                  {showReanalyzeNote && (
                    <div className="flex gap-2">
                      <Input
                        value={reanalyzeNote}
                        onChange={(e) => setReanalyzeNote(e.target.value)}
                        placeholder="Focus on..."
                        className="text-sm"
                        onKeyDown={(e) => { if (e.key === "Enter" && reanalyzeNote.trim()) handleReanalyze(input.id, reanalyzeNote); }}
                      />
                      <Button size="sm" onClick={() => reanalyzeNote.trim() && handleReanalyze(input.id, reanalyzeNote)}>Go</Button>
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
