"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Check, ImageIcon, Sparkles, Upload, X, Heart, MessageCircle, Send, Bookmark } from "lucide-react";

interface InstagramEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
  projectName?: string;
  authorName?: string;
  authorRole?: string;
  authorImage?: string;
}

const MAX_CAPTION = 2200;
const MAX_HASHTAGS = 15;

export function InstagramEditor({ values, onChange, readOnly, projectName = "your_brand", authorName, authorImage }: InstagramEditorProps) {
  const [copied, setCopied] = useState(false);
  const [hashtagInput, setHashtagInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const caption = (values.caption ?? values.text ?? "") as string;
  const hashtags = (values.hashtags ?? []) as string[];
  const imagePrompt = values.image as string | null | undefined;

  const updateCaption = (text: string) => {
    onChange({ ...values, caption: text, text: text });
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (!tag || hashtags.length >= MAX_HASHTAGS) return;
    if (!hashtags.includes(tag)) {
      onChange({ ...values, hashtags: [...hashtags, tag] });
    }
    setHashtagInput("");
  };

  const removeHashtag = (tag: string) => {
    onChange({ ...values, hashtags: hashtags.filter((h) => h !== tag) });
  };

  const copyToClipboard = async () => {
    const hashtagStr = hashtags.map((h) => `#${h}`).join(" ");
    const full = caption + (hashtagStr ? `\n\n${hashtagStr}` : "");
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Image Area */}
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Image</p>
            <p className="text-xs text-muted-foreground mt-1">
              {imagePrompt ? `AI prompt: "${imagePrompt.slice(0, 80)}..."` : "Upload or generate an image"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={readOnly}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />Upload
            </Button>
            <Button variant="outline" size="sm" disabled={readOnly}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />Generate with AI
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-2">
        <Textarea
          value={caption}
          onChange={(e) => updateCaption(e.target.value)}
          placeholder="Write a caption..."
          rows={5}
          disabled={readOnly}
          className="resize-none text-sm"
        />
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Caption</span>
          <span className={caption.length > MAX_CAPTION ? "text-red-500 font-medium" : "text-muted-foreground"}>
            {caption.length}/{MAX_CAPTION}
          </span>
        </div>
      </div>

      {/* Hashtags */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {hashtags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1 text-[#E1306C]">
              #{tag}
              {!readOnly && (
                <button onClick={() => removeHashtag(tag)} className="ml-0.5 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        {!readOnly && hashtags.length < MAX_HASHTAGS && (
          <div className="flex gap-2">
            <Input
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
              placeholder="Add hashtag..."
              className="text-sm h-8"
            />
            <Button variant="outline" size="sm" onClick={addHashtag} className="h-8">Add</Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{hashtags.length}/{MAX_HASHTAGS} hashtags</p>
      </div>

      {/* Instagram Preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Instagram Preview</p>
        <div className="rounded-lg border bg-white shadow-sm max-w-[400px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <img
              src={authorImage ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName ?? projectName)}&background=DD2A7B&color=fff&size=64`}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="text-sm font-semibold text-gray-900">{authorName ?? projectName}</span>
          </div>

          {/* Image placeholder */}
          <div className="aspect-square bg-gray-100 flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-gray-300" />
          </div>

          {/* Actions */}
          <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Heart className="h-5 w-5 text-gray-900" />
              <MessageCircle className="h-5 w-5 text-gray-900" />
              <Send className="h-5 w-5 text-gray-900" />
            </div>
            <Bookmark className="h-5 w-5 text-gray-900" />
          </div>

          {/* Likes */}
          <p className="px-3 text-sm font-semibold text-gray-900">142 likes</p>

          {/* Caption */}
          <div className="px-3 pb-3 pt-0.5">
            <p className="text-sm text-gray-900">
              <span className="font-semibold">{projectName}</span>{" "}
              <span className="whitespace-pre-wrap">{caption.slice(0, 300)}{caption.length > 300 ? "..." : ""}</span>
            </p>
            {hashtags.length > 0 && (
              <p className="text-sm text-[#00376B] mt-1">
                {hashtags.map((h) => `#${h}`).join(" ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Copy Button */}
      <Button variant="outline" className="w-full" onClick={copyToClipboard}>
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {copied ? "Copied!" : "Copy to Clipboard"}
      </Button>
    </div>
  );
}
