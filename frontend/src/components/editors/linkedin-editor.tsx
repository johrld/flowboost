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
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const text = (values.text as string) ?? "";
  const hashtags = (values.hashtags as string[]) ?? [];

  // Live preview text (Unicode-formatted, updated on every keystroke)
  const [previewText, setPreviewText] = useState("");

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

  // Sync TipTap content when values.text changes externally (e.g. loading a version)
  const lastExternalText = useRef(text);
  if (editor && text !== lastExternalText.current && text !== editor.getText()) {
    lastExternalText.current = text;
    const html = text ? `<p>${text.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` : "<p></p>";
    editor.commands.setContent(html);
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
    <div className="space-y-4">
      {/* ── Side-by-Side: Editor | Preview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Editor */}
        <div className="space-y-4">
          {/* Toolbar */}
          {editor && !readOnly && (
            <div className="flex items-center gap-0.5 border rounded-md bg-muted/30 px-2 py-1.5">
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
            </div>
          )}

          {/* Editor Area */}
          <div className="border rounded-md bg-background">
            <EditorContent
              editor={editor}
              className="prose prose-sm max-w-none px-4 py-3 min-h-[250px] max-h-[500px] overflow-y-auto focus-within:ring-1 focus-within:ring-ring rounded-md [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[230px] [&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
            />
          </div>

          {/* Char counter */}
          <div className="flex justify-end">
            <span className={`text-xs tabular-nums ${isOverLimit ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              {charCount.toLocaleString()}/{CHAR_LIMIT.toLocaleString()}
            </span>
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

          {/* Bottom Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={copyToClipboard}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied!" : "Copy text"}
            </Button>
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
