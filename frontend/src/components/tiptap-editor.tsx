"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import BaseImage from "@tiptap/extension-image";
import { marked } from "marked";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Circle,
  Square,
  Droplets,
  Type,
  ImageIcon,
} from "lucide-react";

// ── Custom Image extension with styling attributes ──────────────

const ROUND_VALUES = [null, "sm", "md", "lg"] as const;
const SHADOW_VALUES = [null, "sm", "md", "lg"] as const;

function cycle<T>(values: readonly T[], current: T): T {
  const idx = values.indexOf(current);
  return values[(idx + 1) % values.length];
}

const Image = BaseImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-align": {
        default: "center",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-align") ?? "center",
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs["data-align"]) return {};
          return { "data-align": attrs["data-align"] };
        },
      },
      "data-rounded": {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-rounded") || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs["data-rounded"]) return {};
          return { "data-rounded": attrs["data-rounded"] };
        },
      },
      "data-border": {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-border") || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs["data-border"]) return {};
          return { "data-border": attrs["data-border"] };
        },
      },
      "data-shadow": {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-shadow") || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs["data-shadow"]) return {};
          return { "data-shadow": attrs["data-shadow"] };
        },
      },
      "data-caption": {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-caption") || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs["data-caption"]) return {};
          return { "data-caption": attrs["data-caption"] };
        },
      },
    };
  },

  renderMarkdown(node) {
    const src = node.attrs?.src ?? "";
    const alt = node.attrs?.alt ?? "";
    const title = node.attrs?.title ?? "";
    const width = node.attrs?.width;
    const height = node.attrs?.height;
    const align = node.attrs?.["data-align"];
    const rounded = node.attrs?.["data-rounded"];
    const border = node.attrs?.["data-border"];
    const shadow = node.attrs?.["data-shadow"];
    const caption = node.attrs?.["data-caption"];

    const hasStyle = (align && align !== "center") || rounded || border || shadow || caption;

    // Build <img> tag
    const imgParts = [`<img src="${src}" alt="${alt}"`];
    if (width) imgParts.push(`width="${width}"`);
    if (height) imgParts.push(`height="${height}"`);
    if (title) imgParts.push(`title="${title}"`);

    // If styled, wrap in <figure> with data attributes
    if (hasStyle) {
      const figAttrs: string[] = ['class="image-figure"'];
      if (align) figAttrs.push(`data-align="${align}"`);
      if (rounded) figAttrs.push(`data-rounded="${rounded}"`);
      if (border) figAttrs.push(`data-border="${border}"`);
      if (shadow) figAttrs.push(`data-shadow="${shadow}"`);
      // Also put data attrs on img for editor parseHTML
      if (align) imgParts.push(`data-align="${align}"`);
      if (rounded) imgParts.push(`data-rounded="${rounded}"`);
      if (border) imgParts.push(`data-border="${border}"`);
      if (shadow) imgParts.push(`data-shadow="${shadow}"`);
      if (caption) imgParts.push(`data-caption="${caption}"`);
      imgParts.push("/>");

      let html = `<figure ${figAttrs.join(" ")}>\n${imgParts.join(" ")}`;
      if (caption) html += `\n<figcaption>${caption}</figcaption>`;
      html += "\n</figure>";
      return html;
    }

    // If resized (but no styling), output plain <img> with dimensions
    if (width || height) {
      imgParts.push("/>");
      return imgParts.join(" ");
    }

    // Default: standard markdown
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },
});

// ── Editor Props Interface ──────────────────────────────────────

interface TiptapEditorProps {
  content: string;
  onChange?: (markdown: string) => void;
  editable?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
}

// ── Main Editor Component ───────────────────────────────────────

export function TiptapEditor({
  content,
  onChange,
  editable = true,
  onImageUpload,
}: TiptapEditorProps) {
  const initialHtml = useMemo(() => marked.parse(content) as string, [content]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Stable ref for upload callback (avoid editor recreation on callback change)
  const uploadRef = useRef(onImageUpload);
  uploadRef.current = onImageUpload;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Markdown,
      Image.configure({
        inline: false,
        allowBase64: false,
        resize: {
          enabled: true,
          directions: ["bottom-right"],
          minWidth: 100,
          minHeight: 100,
          alwaysPreserveAspectRatio: true,
        },
      }),
    ],
    content: initialHtml,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getMarkdown());
    },
    editorProps: {
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !uploadRef.current) return false;
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const file = files[0];
        if (!file.type.startsWith("image/")) return false;

        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });

        uploadRef.current(file).then((url) => {
          const node = view.state.schema.nodes.image.create({ src: url, alt: "" });
          const insertPos = coords?.pos ?? view.state.selection.from;
          const tr = view.state.tr.insert(insertPos, node);
          view.dispatch(tr);
        });
        return true;
      },
      handlePaste: (view, event) => {
        if (!uploadRef.current) return false;
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return false;
            uploadRef.current(file).then((url) => {
              const node = view.state.schema.nodes.image.create({ src: url, alt: "" });
              const tr = view.state.tr.insert(view.state.selection.from, node);
              view.dispatch(tr);
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  // Sync custom data attrs from ProseMirror doc → DOM (nodeview doesn't propagate them)
  useSyncImageAttrs(editor);

  // Image toolbar state — track which image container is selected
  const [selectedContainer, setSelectedContainer] = useState<HTMLElement | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);

  const updateToolbarPosition = useCallback((container: HTMLElement) => {
    if (!wrapperRef.current) return;
    const containerRect = container.getBoundingClientRect();
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    setToolbarPos({
      top: containerRect.top - wrapperRect.top - 44, // toolbar height + gap
      left: containerRect.left - wrapperRect.left + containerRect.width / 2,
    });
  }, []);

  // Detect clicks on images in the editor
  useEffect(() => {
    if (!editor || !editable) return;
    const editorDom = editor.view.dom;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const container = target.closest("[data-resize-container]") as HTMLElement | null;

      if (container && editorDom.contains(container)) {
        setSelectedContainer(container);
        updateToolbarPosition(container);
      } else if (!(e.target as HTMLElement).closest(".image-toolbar")) {
        setSelectedContainer(null);
        setToolbarPos(null);
      }
    };

    const handleScroll = () => {
      if (selectedContainer) {
        updateToolbarPosition(selectedContainer);
      }
    };

    document.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [editor, editable, selectedContainer, updateToolbarPosition]);

  const updateImageAttr = useCallback((key: string, value: string | null) => {
    if (!editor || !selectedContainer) return;
    const img = selectedContainer.querySelector("img");
    if (!img) return;
    const src = img.getAttribute("src");

    // Find the image node in the ProseMirror doc by matching src
    let imagePos: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (imagePos !== null) return false;
      if (node.type.name === "image" && node.attrs.src === src) {
        imagePos = pos;
        return false;
      }
    });

    if (imagePos === null) return;
    const node = editor.state.doc.nodeAt(imagePos);
    if (!node) return;
    const tr = editor.state.tr.setNodeMarkup(imagePos, undefined, { ...node.attrs, [key]: value });
    editor.view.dispatch(tr);
  }, [editor, selectedContainer]);

  if (!editor) return null;

  return (
    <div ref={wrapperRef} className="rounded-md border relative">
      {editable && (
        <div className="flex flex-wrap gap-1 border-b bg-muted/30 p-1.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarSep />

          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarSep />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Ordered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal Rule"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarSep />

          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>

        </div>
      )}

      <div
        className="cursor-text"
        onClick={() => { if (editor && !editor.isFocused) editor.commands.focus("end"); }}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none dark:prose-invert p-4 min-h-[500px] focus-within:outline-none [&_.tiptap]:outline-none"
        />
      </div>

      {/* Floating image toolbar */}
      {editable && selectedContainer && toolbarPos && (
        <ImageToolbar
          container={selectedContainer}
          pos={toolbarPos}
          onUpdate={updateImageAttr}
        />
      )}
    </div>
  );
}

// ── Image Floating Toolbar ──────────────────────────────────────

function ImageToolbar({
  container,
  pos,
  onUpdate,
}: {
  container: HTMLElement;
  pos: { top: number; left: number };
  onUpdate: (key: string, value: string | null) => void;
}) {
  const [captionInput, setCaptionInput] = useState("");
  const [showCaptionInput, setShowCaptionInput] = useState(false);

  const img = container.querySelector("img");
  if (!img) return null;

  const align = img.getAttribute("data-align") ?? "center";
  const rounded = img.getAttribute("data-rounded") ?? null;
  const border = img.getAttribute("data-border") ?? null;
  const shadow = img.getAttribute("data-shadow") ?? null;
  const caption = img.getAttribute("data-caption") ?? null;

  return (
    <div
      className="image-toolbar absolute z-50 flex flex-col items-center"
      style={{
        top: Math.max(0, pos.top),
        left: pos.left,
        transform: "translateX(-50%)",
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border bg-background/95 backdrop-blur px-1 py-1 shadow-lg">
        {/* Alignment */}
        <SmButton
          onClick={() => onUpdate("data-align", "left")}
          active={align === "left"}
          title="Align left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </SmButton>
        <SmButton
          onClick={() => onUpdate("data-align", "center")}
          active={align === "center"}
          title="Center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </SmButton>
        <SmButton
          onClick={() => onUpdate("data-align", "right")}
          active={align === "right"}
          title="Align right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </SmButton>

        <div className="mx-0.5 h-5 w-px bg-border/50" />

        {/* Rounded corners */}
        <SmButton
          onClick={() => onUpdate("data-rounded", cycle(ROUND_VALUES, rounded))}
          active={!!rounded}
          title={rounded ? `Rounded: ${rounded}` : "Rounded corners"}
        >
          <Circle className="h-3.5 w-3.5" />
          {rounded && <span className="text-[9px] ml-0.5 font-medium opacity-70">{rounded.toUpperCase()}</span>}
        </SmButton>

        {/* Border */}
        <SmButton
          onClick={() => onUpdate("data-border", border ? null : "thin")}
          active={!!border}
          title={border ? "Remove border" : "Add border"}
        >
          <Square className="h-3.5 w-3.5" />
        </SmButton>

        {/* Shadow */}
        <SmButton
          onClick={() => onUpdate("data-shadow", cycle(SHADOW_VALUES, shadow))}
          active={!!shadow}
          title={shadow ? `Shadow: ${shadow}` : "Add shadow"}
        >
          <Droplets className="h-3.5 w-3.5" />
          {shadow && <span className="text-[9px] ml-0.5 font-medium opacity-70">{shadow.toUpperCase()}</span>}
        </SmButton>

        <div className="mx-0.5 h-5 w-px bg-border/50" />

        {/* Caption */}
        <SmButton
          onClick={() => {
            if (caption) {
              onUpdate("data-caption", null);
              setShowCaptionInput(false);
            } else {
              setShowCaptionInput((v) => !v);
              setCaptionInput("");
            }
          }}
          active={!!caption}
          title={caption ? `Caption: "${caption}" — click to remove` : "Add caption"}
        >
          <Type className="h-3.5 w-3.5" />
        </SmButton>
      </div>

      {/* Caption input row */}
      {showCaptionInput && !caption && (
        <div className="mt-1 flex gap-1 rounded-lg border bg-background/95 backdrop-blur px-2 py-1.5 shadow-lg">
          <input
            autoFocus
            value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && captionInput.trim()) {
                onUpdate("data-caption", captionInput.trim());
                setShowCaptionInput(false);
              }
              if (e.key === "Escape") setShowCaptionInput(false);
            }}
            placeholder="Caption text…"
            className="flex-1 bg-transparent text-xs outline-none min-w-[150px]"
          />
          <button
            className="text-xs text-muted-foreground hover:text-foreground px-1"
            onClick={() => {
              if (captionInput.trim()) {
                onUpdate("data-caption", captionInput.trim());
                setShowCaptionInput(false);
              }
            }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sync custom data attributes from ProseMirror doc → DOM ──────
// The ResizableNodeView doesn't propagate custom data-* attrs to the
// <img> element, so we do it manually after every transaction.

const CUSTOM_ATTRS = ["data-align", "data-rounded", "data-border", "data-shadow", "data-caption"] as const;

function useSyncImageAttrs(editor: ReturnType<typeof useEditor> | null) {
  const sync = useCallback(() => {
    if (!editor) return;
    const { view } = editor;

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "image") return;
      // Get the nodeview's DOM element for this node
      const dom = view.nodeDOM(pos);
      if (!dom || !(dom instanceof HTMLElement)) return;
      const img = dom.querySelector("img") ?? (dom.tagName === "IMG" ? dom : null);
      if (!img) return;

      // Apply each custom attr from ProseMirror doc to DOM
      for (const attr of CUSTOM_ATTRS) {
        const val = node.attrs[attr];
        if (val) img.setAttribute(attr, val);
        else img.removeAttribute(attr);
      }

      // Mirror caption to the resize container for CSS ::after
      const container = img.closest("[data-resize-container]") as HTMLElement | null;
      if (container) {
        const caption = node.attrs["data-caption"];
        if (caption) container.setAttribute("data-caption", caption);
        else container.removeAttribute("data-caption");
      }
    });
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    // Run synchronously so DOM attrs are set before React re-renders
    editor.on("transaction", sync);
    sync();
    return () => { editor.off("transaction", sync); };
  }, [editor, sync]);
}

// ── Shared Toolbar Components ────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}

function SmButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className={`inline-flex items-center justify-center rounded-md h-7 min-w-7 px-1 text-sm transition-colors ${
        active
          ? "bg-secondary text-secondary-foreground"
          : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <div className="mx-0.5 h-6 w-px self-center bg-border" />;
}
