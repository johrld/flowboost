"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, X, Play, Music, Plus } from "lucide-react";

interface TikTokEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
  projectName?: string;
  authorName?: string;
  authorRole?: string;
  authorImage?: string;
}

const MAX_CAPTION = 4000;
const MAX_HASHTAGS = 5;

export function TikTokEditor({ values, onChange, readOnly, projectName = "your_brand" }: TikTokEditorProps) {
  const [copied, setCopied] = useState(false);
  const [hashtagInput, setHashtagInput] = useState("");

  const text = (values.text ?? values.caption ?? "") as string;
  const hashtags = (values.hashtags ?? []) as string[];
  const scriptSections = {
    hook: (values.hook ?? "") as string,
    setup: (values.setup ?? "") as string,
    value: (values.value ?? values.body ?? "") as string,
    payoff: (values.payoff ?? "") as string,
  };
  const hasScript = scriptSections.hook || scriptSections.setup || scriptSections.value || scriptSections.payoff;

  const updateField = (field: string, val: string) => {
    onChange({ ...values, [field]: val });
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
    const parts: string[] = [];
    if (hasScript) {
      if (scriptSections.hook) parts.push(`🎬 HOOK:\n${scriptSections.hook}`);
      if (scriptSections.setup) parts.push(`📋 SETUP:\n${scriptSections.setup}`);
      if (scriptSections.value) parts.push(`💡 VALUE:\n${scriptSections.value}`);
      if (scriptSections.payoff) parts.push(`🎯 PAYOFF:\n${scriptSections.payoff}`);
    }
    if (text) parts.push(`\n---\nCaption:\n${text}`);
    if (hashtags.length) parts.push(hashtags.map((h) => `#${h}`).join(" "));
    await navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Video Script */}
      {!hasScript && !readOnly && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange({ ...values, hook: "", setup: "", value: "", payoff: "" })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />Add Video Script
        </Button>
      )}
      {hasScript && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video Script</p>
          {[
            { key: "hook", label: "Hook", hint: "First 3 seconds — grab attention", icon: "🎬" },
            { key: "setup", label: "Setup", hint: "5-10 seconds — context", icon: "📋" },
            { key: "value", label: "Value", hint: "Main content — the insight", icon: "💡" },
            { key: "payoff", label: "Payoff", hint: "Last 5 seconds — CTA", icon: "🎯" },
          ].map(({ key, label, hint, icon }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <span>{icon}</span> {label}
                <span className="text-muted-foreground font-normal">— {hint}</span>
              </Label>
              <Textarea
                value={scriptSections[key as keyof typeof scriptSections]}
                onChange={(e) => updateField(key, e.target.value)}
                rows={key === "value" ? 4 : 2}
                disabled={readOnly}
                className="resize-none text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* Caption */}
      <div className="space-y-2">
        <Label className="text-xs">Caption</Label>
        <Textarea
          value={text}
          onChange={(e) => updateField("text", e.target.value)}
          placeholder="Write your caption..."
          rows={3}
          disabled={readOnly}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <span className={text.length > MAX_CAPTION ? "text-xs text-red-500 font-medium" : "text-xs text-muted-foreground"}>
            {text.length}/{MAX_CAPTION}
          </span>
        </div>
      </div>

      {/* Hashtags */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {hashtags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1">
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

      {/* TikTok Preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">TikTok Preview</p>
        <div className="relative rounded-2xl border bg-black text-white max-w-[280px] aspect-[9/16] overflow-hidden">
          {/* Video placeholder */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
              <Play className="h-8 w-8 text-white/60 ml-1" />
            </div>
          </div>

          {/* Right side actions */}
          <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">❤️</span>
              </div>
              <span className="text-[10px]">4.2K</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">💬</span>
              </div>
              <span className="text-[10px]">128</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">🔖</span>
              </div>
              <span className="text-[10px]">892</span>
            </div>
          </div>

          {/* Bottom caption overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-xs font-semibold mb-1">@{projectName}</p>
            <p className="text-[11px] leading-relaxed line-clamp-3">{text.slice(0, 150)}{text.length > 150 ? "..." : ""}</p>
            {hashtags.length > 0 && (
              <p className="text-[11px] text-white/70 mt-0.5">
                {hashtags.slice(0, 3).map((h) => `#${h}`).join(" ")}
              </p>
            )}
            <div className="flex items-center gap-1 mt-2 text-[10px] text-white/60">
              <Music className="h-3 w-3" />
              <span>Original sound — {projectName}</span>
            </div>
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
