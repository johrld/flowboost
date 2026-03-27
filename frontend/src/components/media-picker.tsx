"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Upload, Sparkles, Search, ImageIcon, Film, FileText, Music } from "lucide-react";
import { useProject } from "@/lib/project-context";
import type { MediaAsset, MediaType } from "@/lib/types";
import * as api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: MediaAsset) => void;
  /** Filter by media type */
  typeFilter?: "image" | "video" | "audio" | "document";
  /** Pre-selected asset */
  selectedId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────

const TYPE_TABS: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: null },
  { value: "image", label: "Images", icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { value: "video", label: "Videos", icon: <Film className="h-3.5 w-3.5" /> },
  { value: "document", label: "Documents", icon: <FileText className="h-3.5 w-3.5" /> },
];

function typeIcon(type: MediaType) {
  switch (type) {
    case "image":
      return <ImageIcon className="h-8 w-8 text-muted-foreground" />;
    case "video":
      return <Film className="h-8 w-8 text-muted-foreground" />;
    case "audio":
      return <Music className="h-8 w-8 text-muted-foreground" />;
    case "document":
      return <FileText className="h-8 w-8 text-muted-foreground" />;
    default:
      return <FileText className="h-8 w-8 text-muted-foreground" />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ─────────────────────────────────────────────────────

export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  typeFilter,
  selectedId,
}: MediaPickerProps) {
  const { customerId, projectId } = useProject();

  // State
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<string>(typeFilter ?? "all");
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [altText, setAltText] = useState("");
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load assets ──────────────────────────────────────────────────

  const loadAssets = useCallback(async () => {
    if (!customerId || !projectId) return;
    setLoading(true);
    try {
      const typeParam = activeType !== "all" ? activeType : typeFilter;
      const result = await api.getMedia(customerId, projectId, {
        type: typeParam,
        search: search || undefined,
      });
      setAssets(result.assets);
    } catch {
      // API error -- grid bleibt leer
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId, activeType, search, typeFilter]);

  useEffect(() => {
    if (open) {
      loadAssets();
    }
  }, [open, loadAssets]);

  // Sync selected asset when selectedId changes
  useEffect(() => {
    if (selectedId && assets.length > 0) {
      const found = assets.find((a) => a.id === selectedId);
      if (found) {
        setSelected(found);
        setAltText(found.altText ?? "");
      }
    }
  }, [selectedId, assets]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelected(null);
      setAltText("");
      if (!typeFilter) setActiveType("all");
    }
  }, [open, typeFilter]);

  // ── Upload handler ───────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customerId || !projectId) return;
    setUploading(true);
    try {
      const result = await api.uploadMedia(customerId, projectId, file);
      setAssets((prev) => [result.asset, ...prev]);
      setSelected(result.asset);
      setAltText(result.asset.altText ?? "");
    } catch {
      // Upload fehlgeschlagen
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Select handler ───────────────────────────────────────────────

  const handleConfirm = () => {
    if (!selected) return;
    onSelect({ ...selected, altText: altText || selected.altText });
    onOpenChange(false);
  };

  // ── Render ───────────────────────────────────────────────────────

  const showGenerateButton = typeFilter === "image" || (!typeFilter && activeType === "image");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col p-0" showCloseButton>
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle>Media Library</SheetTitle>
        </SheetHeader>

        {/* Search + Actions */}
        <div className="px-4 pt-3 pb-2 space-y-3 border-b">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Upload
            </Button>
            {showGenerateButton && (
              <Button variant="outline" size="sm" className="h-9">
                <Sparkles className="h-4 w-4 mr-1.5" />
                Generate
              </Button>
            )}
          </div>

          {/* Type Tabs */}
          {!typeFilter && (
            <Tabs value={activeType} onValueChange={setActiveType}>
              <TabsList className="w-full">
                {TYPE_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex-1 text-xs">
                    {tab.icon && <span className="mr-1">{tab.icon}</span>}
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* Asset Grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No media found</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {assets.map((asset) => {
                const isSelected = selected?.id === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      setSelected(asset);
                      setAltText(asset.altText ?? "");
                    }}
                    className={`relative aspect-video rounded-md border overflow-hidden transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected ? "ring-2 ring-primary border-primary" : ""
                    }`}
                  >
                    {asset.type === "image" ? (
                      <img
                        src={api.getMediaThumbnailUrl(customerId, projectId, asset.id)}
                        alt={asset.altText ?? asset.fileName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback auf File-URL wenn kein Thumbnail existiert
                          const img = e.currentTarget;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = "1";
                            img.src = api.getMediaFileUrl(customerId, projectId, asset.id);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 gap-1">
                        {typeIcon(asset.type)}
                        <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">
                          {asset.fileName}
                        </span>
                      </div>
                    )}
                    {/* Source Badge */}
                    {asset.source === "generated" && (
                      <Badge
                        variant="secondary"
                        className="absolute top-1 right-1 text-[9px] px-1 py-0 h-4"
                      >
                        AI
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Selected Asset + Confirm */}
        {selected && (
          <div className="border-t px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              {/* Kleine Preview */}
              <div className="w-16 h-12 rounded border overflow-hidden shrink-0">
                {selected.type === "image" ? (
                  <img
                    src={api.getMediaThumbnailUrl(customerId, projectId, selected.id)}
                    alt={selected.altText ?? selected.fileName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/50">
                    {typeIcon(selected.type)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{selected.title ?? selected.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.mimeType} &middot; {formatFileSize(selected.fileSize)}
                  {selected.width && selected.height && (
                    <> &middot; {selected.width}x{selected.height}</>
                  )}
                </p>
              </div>
            </div>

            {/* Alt-Text Input (nur bei Bildern) */}
            {selected.type === "image" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Alt-Text
                </label>
                <Input
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Image description..."
                  className="h-8 text-sm"
                />
              </div>
            )}

            <Button onClick={handleConfirm} className="w-full">
              Select
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
