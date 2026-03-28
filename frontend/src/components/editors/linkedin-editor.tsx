"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Check,
  X,
  Hash,
  Globe,
  Monitor,
  Smartphone,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  ImageIcon,
  Upload,
  Trash2,
} from "lucide-react";
import { tiptapToLinkedIn } from "@/lib/linkedin-formatter";

const CHAR_LIMIT = 3000;
const HASHTAG_LIMIT = 5;
// Rough threshold: if text is longer than ~3 lines worth, show "...more"
// CSS line-clamp handles the visual truncation, this just controls whether to show the divider
const MORE_THRESHOLD = 160;

interface LinkedInEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
  projectName?: string;
  authorName?: string;
  authorRole?: string;
  authorImage?: string;
}

export function LinkedInEditor({
  values,
  onChange,
  readOnly = false,
  projectName = "Your Company",
  authorName,
  authorRole,
  authorImage,
}: LinkedInEditorProps) {
  const [hashtagInput, setHashtagInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const text = (values.text as string) ?? "";
  const hashtags = (values.hashtags as string[]) ?? [];
  const images = (values.images as string[]) ?? [];

  // Drop handler for images dragged from sidebar media library
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const currentImages = (valuesRef.current.images as string[]) ?? [];
    // Check for image URL from sidebar
    const url = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
    if (url && (url.startsWith("http") || url.startsWith("/")) && currentImages.length < 20) {
      if (!currentImages.includes(url)) {
        onChange({ ...valuesRef.current, images: [...currentImages, url] });
      }
      return;
    }
    // Check for dropped files
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    const newUrls = files.slice(0, 20 - currentImages.length).map((f) => URL.createObjectURL(f));
    if (newUrls.length > 0) {
      onChange({ ...valuesRef.current, images: [...currentImages, ...newUrls] });
    }
  }, [onChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDraggingOver(false);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImage = (url: string) => {
    onChange({ ...valuesRef.current, images: [...images, url] });
  };
  const removeImage = (index: number) => {
    onChange({ ...valuesRef.current, images: images.filter((_, i) => i !== index) });
  };

  // Live preview text (Unicode-formatted, updated on every keystroke)
  // Initialize from text value so preview works immediately on load
  const [previewText, setPreviewText] = useState(text);

  // TipTap editor
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
      }),
    ],
    content: text ? `<p>${text.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` : "<p></p>",
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      const plainText = ed.getText();
      onChange({ ...valuesRef.current, text: plainText });
      // Update Unicode preview immediately
      setPreviewText(tiptapToLinkedIn(ed.getJSON()).trim());
    },
  });

  // Sync TipTap content when values.text changes externally (e.g. loading a version, after save)
  const lastExternalText = useRef(text);
  if (editor && text !== lastExternalText.current) {
    lastExternalText.current = text;
    if (text !== editor.getText()) {
      const html = text ? `<p>${text.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` : "<p></p>";
      editor.commands.setContent(html);
    }
    // Always update preview when text changes
    setPreviewText(tiptapToLinkedIn(editor.getJSON()).trim());
  }

  const getLinkedInText = useCallback(() => {
    if (!editor) return text;
    return tiptapToLinkedIn(editor.getJSON()).trim();
  }, [editor, text]);

  const charCount = text.length;
  const isOverLimit = charCount > CHAR_LIMIT;
  const needsMore = previewText.length > MORE_THRESHOLD;


  const addHashtag = useCallback(
    (raw: string) => {
      const tag = raw.replace(/^#+/, "").trim();
      if (!tag || hashtags.length >= HASHTAG_LIMIT) return;
      if (hashtags.some((h) => h.toLowerCase() === tag.toLowerCase())) return;
      onChange({ ...values, hashtags: [...hashtags, tag] });
      setHashtagInput("");
    },
    [values, hashtags, onChange],
  );

  const removeHashtag = useCallback(
    (index: number) => {
      onChange({ ...values, hashtags: hashtags.filter((_, i) => i !== index) });
    },
    [values, hashtags, onChange],
  );

  const copyToClipboard = useCallback(async () => {
    const formatted = getLinkedInText();
    const hashtagStr = hashtags.map((h) => `#${h}`).join(" ");
    const full = formatted + (hashtagStr ? `\n\n${hashtagStr}` : "");
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [getLinkedInText, hashtags]);

  const displayName = authorName ?? projectName;
  const displayRole = authorRole ?? "Content Creator";
  const avatarUrl = authorImage ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0A66C2&color=fff&size=96`;

  return (
    <div
      className={`space-y-4 transition-colors ${isDraggingOver ? "ring-2 ring-primary ring-dashed rounded-lg bg-primary/5" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* ── Side-by-Side: Editor | Preview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Editor */}
        <div className="space-y-4">
          {/* Combined Editor Box: Toolbar + Text Area */}
          <div className="border rounded-md bg-background overflow-hidden">
            {/* Toolbar inside the box */}
            {editor && !readOnly && (
              <div className="flex items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
                <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
                  <Bold className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
                  <Italic className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
                  <Strikethrough className="h-4 w-4" />
                </ToolbarBtn>
                <div className="w-px h-5 bg-border mx-1" />
                <ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
                  <List className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
                  <ListOrdered className="h-4 w-4" />
                </ToolbarBtn>
                <div className="w-px h-5 bg-border mx-1" />
                <ToolbarBtn active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo">
                  <Undo2 className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo">
                  <Redo2 className="h-4 w-4" />
                </ToolbarBtn>
                {/* Copy text in toolbar */}
                <div className="flex-1" />
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
                  title="Copy with LinkedIn formatting"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}

            {/* Text Editor */}
            <EditorContent
              editor={editor}
              className="prose prose-sm max-w-none px-4 py-3 min-h-[150px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[130px] [&_.ProseMirror_p]:my-1.5"
            />
          </div>

          {/* Char counter */}
          <div className="flex justify-end">
            <span className={`text-xs tabular-nums ${isOverLimit ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              {charCount.toLocaleString()}/{CHAR_LIMIT.toLocaleString()}
            </span>
          </div>

          {/* Images — Drop Zone + Mini Gallery */}
          <div className="space-y-2">
            {images.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Post Images</p>
                  <span className="text-xs text-muted-foreground">{images.length}/20</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {images.map((url, i) => (
                    <div key={i} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {!readOnly && (
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Add more slot */}
                  {!readOnly && images.length < 20 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-md border-2 border-dashed border-muted-foreground/25 flex items-center justify-center hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors"
                    >
                      <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                    </button>
                  )}
                </div>
              </>
            ) : !readOnly ? (
              /* Empty state — dashed drop zone */
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full rounded-lg border-2 border-dashed py-6 flex flex-col items-center gap-2 transition-colors cursor-pointer ${
                  isDraggingOver
                    ? "border-primary bg-primary/10"
                    : "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/30"
                }`}
              >
                <div className={`flex items-center gap-1.5 ${isDraggingOver ? "text-primary" : "text-muted-foreground/50"}`}>
                  <Upload className="h-4 w-4" />
                  <ImageIcon className="h-4 w-4" />
                </div>
                <p className={`text-xs font-medium ${isDraggingOver ? "text-primary" : "text-muted-foreground/70"}`}>
                  {isDraggingOver ? "Drop image here" : "Add images to your post"}
                </p>
                <p className="text-[10px] text-muted-foreground/50">
                  {isDraggingOver ? "" : "Upload, drag from Media library, or click to browse"}
                </p>
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                for (const file of files) {
                  addImage(URL.createObjectURL(file));
                }
                e.target.value = "";
              }}
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Hashtags</p>
              <span className="text-xs text-muted-foreground">{hashtags.length}/{HASHTAG_LIMIT}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag, i) => (
                <Badge key={tag} variant="secondary" className="text-xs gap-1 text-[#0A66C2]">
                  #{tag}
                  {!readOnly && (
                    <button onClick={() => removeHashtag(i)} className="ml-0.5 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {!readOnly && hashtags.length < HASHTAG_LIMIT && (
              <div className="relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addHashtag(hashtagInput); }
                    if (e.key === "Backspace" && hashtagInput === "" && hashtags.length > 0) removeHashtag(hashtags.length - 1);
                  }}
                  onBlur={() => { if (hashtagInput.trim()) addHashtag(hashtagInput); }}
                  placeholder="Add hashtag"
                  className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}
          </div>

        </div>

        {/* RIGHT: Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Post Preview</p>
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <button
                onClick={() => setPreviewMode("mobile")}
                className={`p-1 rounded ${previewMode === "mobile" ? "bg-muted" : ""}`}
                title="Mobile"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPreviewMode("desktop")}
                className={`p-1 rounded ${previewMode === "desktop" ? "bg-muted" : ""}`}
                title="Desktop"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div
            className="rounded-lg border bg-white shadow-sm overflow-hidden mx-auto"
            style={{
              maxWidth: previewMode === "desktop" ? 555 : 380,
              fontFamily: '-apple-system, system-ui, "Segoe UI", Roboto, "Noto Sans", Ubuntu, "Helvetica Neue", Helvetica, Arial, sans-serif',
              WebkitFontSmoothing: "antialiased",
              letterSpacing: "normal",
            }}
          >
            {/* Header */}
            <div className="flex items-start gap-2 px-4 pt-3 pb-1.5">
              <img src={avatarUrl} alt="" className="size-[48px] shrink-0 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.33, color: "rgba(0,0,0,0.9)" }}>{displayName}</p>
                <p style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.33, color: "rgba(0,0,0,0.6)" }} className="truncate">{displayRole}</p>
                <p className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.33, color: "rgba(0,0,0,0.6)" }}>
                  12h &middot; <Globe className="size-3" />
                </p>
              </div>
            </div>

            {/* Body with "...more" */}
            <div className="px-4 pb-3">
              {/* Above the fold: 3 lines */}
              <p
                className="whitespace-pre-wrap break-words overflow-hidden"
                style={{
                  fontSize: 14,
                  lineHeight: "20px",
                  color: "rgba(0,0,0,0.9)",
                  ...(needsMore ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const } : {}),
                }}
              >
                {previewText || (
                  <span>
                    Start writing and your post will appear here..{"\n\n"}
                    You can add images, links, <span className="text-[#0A66C2]">#hashtags</span> and emojis
                  </span>
                )}
              </p>

              {/* "...more" divider — ALWAYS visible */}
              <div className="flex items-center gap-2 my-0.5">
                <div className="flex-1 border-t border-dashed border-gray-300" />
                <span style={{ fontSize: 12, color: "rgba(0,0,0,0.6)" }} className="shrink-0 leading-none">...more</span>
              </div>

              {/* Below the fold */}
              {!previewText ? (
                <p style={{ fontSize: 14, lineHeight: "20px", color: "rgba(0,0,0,0.9)" }}>
                  This line will appear below the more...
                </p>
              ) : needsMore ? (
                <p className="whitespace-pre-wrap break-words" style={{ fontSize: 14, lineHeight: "20px", color: "rgba(0,0,0,0.9)" }}>
                  {previewText}
                </p>
              ) : null}

              {/* Hashtags */}
              {hashtags.length > 0 && (
                <p className="mt-1.5" style={{ fontSize: 14, lineHeight: "20px", color: "#0A66C2" }}>
                  {hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              )}
            </div>

            {/* Image Grid — LinkedIn layout */}
            {images.length > 0 && (
              <LinkedInImageGrid images={images} />
            )}

            {/* Engagement */}
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-1">
              <div className="flex items-center gap-1">
                <img src="/avatars/linkedin-thumbup.svg" alt="" className="size-4" />
                <span style={{ fontSize: 12, color: "rgba(0,0,0,0.6)" }}>57</span>
              </div>
              <span style={{ fontSize: 12, color: "rgba(0,0,0,0.6)" }}>24 comments &middot; 6 reposts</span>
            </div>

            {/* Actions */}
            <div className="flex border-t border-gray-100">
              {["Like", "Comment", "Repost", "Send"].map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-gray-50 transition-colors"
                  style={{ fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,0.6)" }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** LinkedIn image grid — mimics LinkedIn's actual multi-image layout */
function LinkedInImageGrid({ images }: { images: string[] }) {
  const count = images.length;
  if (count === 0) return null;

  // 1 image: full width
  if (count === 1) {
    return (
      <div className="border-t border-b border-gray-100">
        <img src={images[0]} alt="" className="w-full max-h-[400px] object-cover" />
      </div>
    );
  }

  // 2 images: side by side
  if (count === 2) {
    return (
      <div className="border-t border-b border-gray-100 grid grid-cols-2 gap-0.5">
        {images.map((url, i) => (
          <img key={i} src={url} alt="" className="w-full aspect-square object-cover" />
        ))}
      </div>
    );
  }

  // 3+ images: large left, stacked right, "+N more" overlay
  const showMore = count > 4;
  const visibleRight = images.slice(1, showMore ? 4 : count);

  return (
    <div className="border-t border-b border-gray-100 grid grid-cols-3 gap-0.5" style={{ maxHeight: 400 }}>
      {/* Large image left (2/3 width) */}
      <div className="col-span-2 row-span-2">
        <img src={images[0]} alt="" className="w-full h-full object-cover" style={{ maxHeight: 400 }} />
      </div>
      {/* Stacked images right (1/3 width) */}
      {visibleRight.map((url, i) => (
        <div key={i} className="relative">
          <img src={url} alt="" className="w-full h-full object-cover" style={{ maxHeight: 200 }} />
          {/* "+N more" overlay on last visible image */}
          {showMore && i === visibleRight.length - 1 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-lg font-semibold">+{count - 4}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ToolbarBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
