"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Archive,
  Video,
  Search,
  Package,
  Inbox,
  MessageCircle,
  MoreHorizontal,
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
  addBriefingInput,
  uploadBriefingFile,
  deleteBriefingInput,
  getBriefingInputFileUrl,
  produceBriefingOutput,
  getContent,
  getContentTypes,
  enrichTopic,
  reprocessBriefingInput,
  type ContentTypeDefinition,
} from "@/lib/api";
import type { Topic, BriefingInput, ChatMessage, ContentItem } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";

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

// Fallback output options (used if content types API fails)
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

export default function BriefingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { customerId, projectId } = useProject();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [outputs, setOutputs] = useState<ContentItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("input");
  const [inputText, setInputText] = useState("");
  const [brainstormInput, setBrainstormInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [researchExpanded, setResearchExpanded] = useState(true);
  const [sending, setSending] = useState(false);
  const [addingInput, setAddingInput] = useState(false);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [reanalyzeNote, setReanalyzeNote] = useState("");
  const [showReanalyzeNote, setShowReanalyzeNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Filter content items linked to this briefing
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

  // Auto-poll when any input is processing
  useEffect(() => {
    if (!topic?.inputs?.some((i) => i.processed?.status === "processing")) return;
    const interval = setInterval(() => loadData(), 3000);
    return () => clearInterval(interval);
  }, [topic?.inputs, loadData]);

  // ── Reanalyze handler ──────────────────────────────────
  const handleReanalyze = async (inputId: string, note?: string) => {
    if (!customerId || !projectId) return;
    try {
      await reprocessBriefingInput(customerId, projectId, id, inputId, note);
      setShowReanalyzeNote(false);
      setReanalyzeNote("");
      await loadData();
    } catch (err) {
      console.error("Reanalyze failed:", err);
    }
  };

  // ── Input handlers ──────────────────────────────────────

  const handleAddTextInput = async () => {
    if (!inputText.trim() || !customerId || !projectId || addingInput) return;
    setAddingInput(true);
    try {
      // Auto-detect URL
      const isUrl = /^https?:\/\/.+/.test(inputText.trim());
      await addBriefingInput(customerId, projectId, id, {
        type: isUrl ? "url" : "text",
        content: inputText.trim(),
      });
      setInputText("");
      await loadData();
    } catch (err) {
      console.error("Failed to add input:", err);
    } finally {
      setAddingInput(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !customerId || !projectId) return;
    for (const file of Array.from(files)) {
      try {
        await uploadBriefingFile(customerId, projectId, id, file);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    await loadData();
  };

  const handleDeleteInput = async (inputId: string) => {
    if (!customerId || !projectId) return;
    try {
      await deleteBriefingInput(customerId, projectId, id, inputId);
      await loadData();
    } catch (err) {
      console.error("Failed to delete input:", err);
    }
  };

  // ── Chat handler ────────────────────────────────────────

  const handleSendChat = async () => {
    if (!brainstormInput.trim() || !customerId || !projectId || sending) return;
    setSending(true);
    try {
      await sendTopicChat(customerId, projectId, id, brainstormInput.trim());
      setBrainstormInput("");
      // Reload chat
      const chat = await getTopicChat(customerId, projectId, id);
      setChatMessages(chat);
      // Reload topic (chat might have updated fields)
      const t = await getTopic(customerId, projectId, id);
      setTopic(t);
    } catch (err) {
      console.error("Chat failed:", err);
    } finally {
      setSending(false);
    }
  };

  // ── Produce handler ─────────────────────────────────────

  const handleProduce = async (type: string, platform?: string) => {
    if (!customerId || !projectId) return;
    try {
      await produceBriefingOutput(customerId, projectId, id, { type, platform });
      await loadData();
    } catch (err) {
      console.error("Produce failed:", err);
    }
  };

  // ── Research handler ────────────────────────────────────

  const handleRunResearch = async () => {
    if (!customerId || !projectId) return;
    try {
      await enrichTopic(customerId, projectId, id);
      // Poll for completion
      setTimeout(async () => {
        const t = await getTopic(customerId, projectId, id);
        setTopic(t);
      }, 3000);
    } catch (err) {
      console.error("Research failed:", err);
    }
  };

  // ── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Briefing not found.</p>
        <Link href="/briefings" className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to Briefings
        </Link>
      </div>
    );
  }

  const hasResearch = !!(topic.keywords?.primary || topic.competitorInsights || topic.suggestedAngle);
  const inputs = topic.inputs ?? [];

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/briefings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Briefings
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{topic.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="capitalize">{topic.status.replace("_", " ")}</span>
              {topic.createdAt && ` · Created ${format(new Date(topic.createdAt), "MMM d, yyyy")}`}
              {topic.userNotes && <span> · {topic.userNotes}</span>}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2"><Pencil className="h-3.5 w-3.5" />Rename</DropdownMenuItem>
              <DropdownMenuItem className="gap-2"><Archive className="h-3.5 w-3.5" />Archive</DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs: Input → Brainstorm → Outputs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="input" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              Input
              {inputs.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{inputs.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="brainstorm" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Brainstorm
            </TabsTrigger>
            <TabsTrigger value="outputs" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Outputs
              {outputs.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{outputs.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === "outputs" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Create</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(contentTypes.length > 0 ? contentTypes.map((ct) => {
                  // Map content type to API type + platform
                  let apiType = "article";
                  let platform: string | undefined;
                  if (ct.category === "social") {
                    apiType = "social_post";
                    // Extract platform from id: "linkedin-post" → "linkedin"
                    platform = ct.id.replace(/-post$/, "");
                  } else if (ct.category === "email" || ct.id === "newsletter") {
                    apiType = "newsletter";
                  } else if (ct.id === "guide" || ct.id.includes("guide")) {
                    apiType = "guide";
                  }
                  return (
                    <DropdownMenuItem
                      key={ct.id}
                      className="gap-2"
                      onClick={() => handleProduce(apiType, platform)}
                    >
                      {CATEGORY_ICONS[ct.category] ?? <FileText className="h-3.5 w-3.5" />}
                      {ct.label}
                    </DropdownMenuItem>
                  );
                }) : FALLBACK_OUTPUT_OPTIONS.map((opt) => (
                  <DropdownMenuItem key={opt.platform ?? opt.type} className="gap-2" onClick={() => handleProduce(opt.type, opt.platform)}>
                    {opt.icon}{opt.label}
                  </DropdownMenuItem>
                )))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {activeTab === "brainstorm" && (
            <Button variant={hasResearch ? "outline" : "default"} onClick={handleRunResearch}>
              <Sparkles className="mr-2 h-4 w-4" />
              {hasResearch ? "Re-run Research" : "Run Research"}
            </Button>
          )}
        </div>

        {/* ── Input Tab ───────────────────────────────────── */}
        <TabsContent value="input" className="mt-6">
          {/* Combo input */}
          <div
            className={`rounded-lg border mb-4 transition-colors ${isDragging ? "border-primary bg-primary/5" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste text, transcripts, URLs — or drop files here..."
              rows={3}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm placeholder:text-muted-foreground focus:outline-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && inputText.trim()) { e.preventDefault(); handleAddTextInput(); } }}
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Attach file
              </button>
              <Button size="sm" disabled={!inputText.trim() || addingInput} onClick={handleAddTextInput}>
                {addingInput ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>

          {/* Input list */}
          {inputs.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No inputs yet. Add text, files, or URLs above.</p>
            </div>
          ) : (
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
                    className={`flex items-center gap-3 rounded-lg p-3 transition-colors group ${hasSummary ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/30"}`}
                    onClick={() => hasSummary && setSelectedInputId(input.id)}
                  >
                    <span className="text-muted-foreground shrink-0">{INPUT_ICONS[input.type] ?? <FileText className="h-4 w-4" />}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{input.fileName ?? INPUT_LABELS[input.type] ?? input.type}</span>
                        {/* Status badges */}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Analyzing
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
                      {/* Summary preview */}
                      {hasSummary && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {input.processed?.summary ?? input.processed?.description}
                        </p>
                      )}
                      {/* Error message */}
                      {isFailed && (
                        <p className="text-xs text-destructive/70 mt-0.5 truncate">{input.processed?.error}</p>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {(notProcessed || isFailed) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleReanalyze(input.id); }}
                          className="text-xs text-primary hover:underline px-2 py-1"
                        >
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

          {/* Summary Detail Dialog */}
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
                      {/* Re-analyze */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={() => { handleReanalyze(input.id); setSelectedInputId(null); }}>
                          Re-analyze
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowReanalyzeNote(!showReanalyzeNote)}>
                          Re-analyze with note
                        </Button>
                      </div>
                      {showReanalyzeNote && (
                        <div className="flex gap-2">
                          <Input
                            value={reanalyzeNote}
                            onChange={(e) => setReanalyzeNote(e.target.value)}
                            placeholder="Focus on..."
                            className="text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && reanalyzeNote.trim()) {
                                handleReanalyze(input.id, reanalyzeNote);
                                setSelectedInputId(null);
                              }
                            }}
                          />
                          <Button size="sm" onClick={() => { if (reanalyzeNote.trim()) { handleReanalyze(input.id, reanalyzeNote); setSelectedInputId(null); } }}>Go</Button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Brainstorm Tab ──────────────────────────────── */}
        <TabsContent value="brainstorm" className="mt-6">
          <div className="flex flex-col" style={{ height: "calc(100vh - 320px)" }}>

            {/* Research Card (pinned, collapsible) */}
            {hasResearch && (
              <div className="rounded-lg border bg-muted/30 mb-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setResearchExpanded(!researchExpanded)}
                  className="flex items-center justify-between w-full p-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">Research</span>
                    {topic.keywords?.primary && <Badge variant="secondary" className="text-xs font-normal">{topic.keywords.primary}</Badge>}
                    <span className="text-xs text-muted-foreground capitalize">· {topic.searchIntent}</span>
                  </div>
                  {researchExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {researchExpanded && (
                  <div className="px-3 pb-3 space-y-2 text-sm border-t pt-3">
                    {topic.keywords && (
                      <div className="flex flex-wrap gap-1.5">
                        {topic.keywords.secondary?.map((kw) => (
                          <Badge key={kw} variant="secondary" className="text-xs font-normal">{kw}</Badge>
                        ))}
                        {topic.keywords.longTail?.map((kw) => (
                          <Badge key={kw} variant="outline" className="text-xs font-normal">{kw}</Badge>
                        ))}
                      </div>
                    )}
                    {topic.competitorInsights && <p className="text-xs text-muted-foreground">{topic.competitorInsights}</p>}
                    {topic.suggestedAngle && <p className="text-xs font-medium">{topic.suggestedAngle}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Chat area */}
            <div className="flex-1 flex flex-col rounded-lg border min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">Brainstorm with AI about this briefing.</p>
                    <p className="text-xs text-muted-foreground">Discuss angles, audience, tone — or run Research.</p>
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
              </div>

              <div className="border-t p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={brainstormInput}
                    onChange={(e) => setBrainstormInput(e.target.value)}
                    placeholder="Ask about angles, audience, tone..."
                    className="border-0 shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && brainstormInput.trim()) handleSendChat();
                    }}
                    disabled={sending}
                  />
                  <Button size="icon" disabled={!brainstormInput.trim() || sending} onClick={handleSendChat} className="shrink-0">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Outputs Tab ──────────────────────────────────── */}
        <TabsContent value="outputs" className="mt-6">
          {outputs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No content yet. Click &quot;Create&quot; to generate your first piece.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {outputs.map((item) => {
                const status = STATUS_BADGE[item.status] ?? { label: item.status, variant: "secondary" as const };
                return (
                  <Link
                    key={item.id}
                    href={`/content/${item.id}`}
                    className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="rounded-full bg-muted p-2 shrink-0">
                      {OUTPUT_ICONS[item.type] ?? <FileText className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{item.type.replace("_", " ")}</p>
                    </div>
                    <Badge variant={status.variant} className="text-xs shrink-0">{status.label}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
