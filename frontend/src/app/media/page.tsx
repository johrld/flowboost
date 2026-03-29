"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useProject } from "@/lib/project-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Upload,
  Trash2,
  Tag,
  Search,
  ImageIcon,
  Film,
  FileText,
  Music,
  X,
  Loader2,
  Check,
  Plus,
} from "lucide-react";
import type { MediaAsset, MediaType, MediaSource } from "@/lib/types";
import * as api from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────

function typeIcon(type: MediaType, className = "h-8 w-8 text-muted-foreground") {
  switch (type) {
    case "image":
      return <ImageIcon className={className} />;
    case "video":
      return <Film className={className} />;
    case "audio":
      return <Music className={className} />;
    case "document":
      return <FileText className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Page ──────────────────────────────────────────────────────────

export default function MediaPage() {
  const { customerId, projectId, loading: projectLoading } = useProject();

  // Data
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Detail panel
  const [detailAsset, setDetailAsset] = useState<MediaAsset | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAltText, setEditAltText] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [usageTitles, setUsageTitles] = useState<Record<string, string>>({});

  // Upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk-Tag Dialog
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");

  // ── Data loading ───────────────────────────────────────────────

  // Ref for search to avoid re-creating loadData on every keystroke
  const searchRef = useRef(search);
  searchRef.current = search;

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const [mediaResult, tagsResult] = await Promise.all([
        api.getMedia(customerId, projectId, {
          type: filterType !== "all" ? filterType : undefined,
          source: filterSource !== "all" ? filterSource : undefined,
          tags: filterTag !== "all" ? filterTag : undefined,
          search: searchRef.current || undefined,
        }),
        api.getMediaTags(customerId, projectId),
      ]);
      setAssets(mediaResult.assets);
      setAllTags(tagsResult.tags);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    }
  }, [customerId, projectId, filterType, filterSource, filterTag]);

  useEffect(() => {
    if (!customerId || !projectId) return;
    setLoading(true);
    setError(null);
    loadData().finally(() => setLoading(false));
  }, [customerId, projectId, loadData]);

  // Debounced search — reload after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Upload handler ─────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !customerId || !projectId) return;
    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map((file) =>
        api.uploadMedia(customerId, projectId, file),
      );
      const results = await Promise.all(uploadPromises);
      const newAssets = results.map((r) => r.asset);
      setAssets((prev) => [...newAssets, ...prev]);
    } catch {
      // Upload fehlgeschlagen
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Selection handlers ─────────────────────────────────────────

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Detail panel ───────────────────────────────────────────────

  const openDetail = async (asset: MediaAsset) => {
    setDetailAsset(asset);
    setEditTitle(asset.title ?? "");
    setEditDescription(asset.description ?? "");
    setEditAltText(asset.altText ?? "");
    // Resolve content titles for usedBy references
    if (asset.usedBy.length > 0 && customerId && projectId) {
      const titles: Record<string, string> = {};
      await Promise.all(
        asset.usedBy.map(async (ref) => {
          if (usageTitles[ref.contentId]) {
            titles[ref.contentId] = usageTitles[ref.contentId];
            return;
          }
          try {
            const item = await api.getContentItem(customerId, projectId, ref.contentId);
            titles[ref.contentId] = item.title;
          } catch {
            titles[ref.contentId] = ref.contentId.slice(0, 8) + "...";
          }
        }),
      );
      setUsageTitles((prev) => ({ ...prev, ...titles }));
    }
    setEditTags([...asset.tags]);
    setNewTag("");
    setDetailOpen(true);
  };

  const handleSaveDetail = async () => {
    if (!detailAsset || !customerId || !projectId) return;
    setSaving(true);
    try {
      const updated = await api.updateMediaAsset(customerId, projectId, detailAsset.id, {
        title: editTitle || undefined,
        description: editDescription || undefined,
        altText: editAltText || undefined,
        tags: editTags,
      });
      setDetailAsset(updated);
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      // save failed
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDetail = async () => {
    if (!detailAsset || !customerId || !projectId) return;
    const hasUsages = detailAsset.usedBy.length > 0;
    if (hasUsages && !confirm("This asset is referenced by content items. Delete anyway?")) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteMediaAsset(customerId, projectId, detailAsset.id, hasUsages);
      setAssets((prev) => prev.filter((a) => a.id !== detailAsset.id));
      setDetailOpen(false);
      setDetailAsset(null);
    } catch {
      // delete failed
    } finally {
      setDeleting(false);
    }
  };

  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !editTags.includes(tag)) {
      setEditTags((prev) => [...prev, tag]);
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    setEditTags((prev) => prev.filter((t) => t !== tag));
  };

  // ── Bulk actions ───────────────────────────────────────────────

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !customerId || !projectId) return;
    if (!confirm(`Delete ${selectedIds.size} asset(s)?`)) return;
    try {
      await api.bulkDeleteMedia(customerId, projectId, Array.from(selectedIds));
      setAssets((prev) => prev.filter((a) => !selectedIds.has(a.id)));
      clearSelection();
    } catch {
      // Bulk-Delete fehlgeschlagen
    }
  };

  const handleBulkTag = async () => {
    const tag = bulkTagValue.trim().toLowerCase();
    if (!tag || selectedIds.size === 0 || !customerId || !projectId) return;
    try {
      const result = await api.bulkUpdateMedia(customerId, projectId, {
        assetIds: Array.from(selectedIds),
        addTags: [tag],
      });
      setAssets((prev) =>
        prev.map((a) => {
          if (result.updated.includes(a.id)) {
            const tags = [...(a.tags ?? [])];
            if (!tags.includes(tag)) tags.push(tag);
            return { ...a, tags };
          }
          return a;
        }),
      );
      setBulkTagOpen(false);
      setBulkTagValue("");
      clearSelection();
    } catch {
      // Bulk-Tag fehlgeschlagen
    }
  };

  // ── Loading / Error ────────────────────────────────────────────

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">Make sure the backend is running and reachable</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-muted-foreground text-sm">
            {assets.length} Asset{assets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            onChange={handleUpload}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="generated">Generated</SelectItem>
            <SelectItem value="extracted">Extracted</SelectItem>
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t.tag} value={t.tag}>
                  {t.tag} ({t.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Asset Grid */}
      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
          <ImageIcon className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No media yet</p>
          <p className="text-xs text-muted-foreground mt-1">Upload files or generate images with AI</p>
          <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Upload first file
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {assets.map((asset) => {
            const isSelected = selectedIds.has(asset.id);
            return (
              <div
                key={asset.id}
                className="group relative rounded-lg border overflow-hidden bg-card hover:border-primary/30 transition-colors"
              >
                {/* Checkbox Overlay */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelection(asset.id);
                  }}
                  className={`absolute top-2 left-2 z-10 h-5 w-5 rounded border flex items-center justify-center transition-all ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background/80 border-muted-foreground/30 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </button>

                {/* Thumbnail */}
                <button
                  type="button"
                  onClick={() => openDetail(asset)}
                  className="block w-full aspect-video focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {asset.type === "image" ? (
                    <img
                      src={api.getMediaThumbnailUrl(customerId, projectId, asset.id)}
                      alt={asset.altText ?? asset.fileName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
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
                    </div>
                  )}
                </button>

                {/* Info */}
                <div className="px-2.5 py-2">
                  <p className="text-xs font-medium truncate">
                    {asset.title ?? asset.fileName}
                  </p>
                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {asset.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {asset.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{asset.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Source Badge */}
                {asset.source === "generated" && (
                  <Badge
                    variant="secondary"
                    className="absolute top-2 right-2 text-[9px] px-1 py-0 h-4"
                  >
                    AI
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background shadow-lg px-4 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkTagOpen(true)}
          >
            <Tag className="h-4 w-4 mr-1.5" />
            Tag
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearSelection}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Bulk Tag Mini-Dialog */}
      {bulkTagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border shadow-lg p-6 w-80 space-y-4">
            <h3 className="text-sm font-semibold">Add Tag</h3>
            <Input
              placeholder="Tag name..."
              value={bulkTagValue}
              onChange={(e) => setBulkTagValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBulkTag()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkTagOpen(false);
                  setBulkTagValue("");
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleBulkTag} disabled={!bulkTagValue.trim()}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0" showCloseButton>
          {detailAsset && (
            <>
              <SheetHeader className="px-4 pt-4 pb-0">
                <SheetTitle className="truncate">
                  {detailAsset.title ?? detailAsset.fileName}
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                {/* Preview */}
                <div className="rounded-lg border overflow-hidden bg-muted/30">
                  {detailAsset.type === "image" ? (
                    <img
                      src={api.getMediaFileUrl(customerId, projectId, detailAsset.id)}
                      alt={detailAsset.altText ?? detailAsset.fileName}
                      className="w-full object-contain max-h-[300px]"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      {typeIcon(detailAsset.type, "h-12 w-12 text-muted-foreground")}
                      <span className="text-sm text-muted-foreground">{detailAsset.fileName}</span>
                    </div>
                  )}
                </div>

                {/* Metadata Info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Type: <span className="text-foreground">{detailAsset.mimeType}</span></div>
                  <div>Size: <span className="text-foreground">{formatFileSize(detailAsset.fileSize)}</span></div>
                  {detailAsset.width && detailAsset.height && (
                    <div>Dimensions: <span className="text-foreground">{detailAsset.width}x{detailAsset.height}</span></div>
                  )}
                  <div>Source: <span className="text-foreground capitalize">{detailAsset.source}</span></div>
                </div>

                {/* Editable Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Asset title..."
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description..."
                      className="h-9"
                    />
                  </div>
                  {detailAsset.type === "image" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Alt Text</label>
                      <Input
                        value={editAltText}
                        onChange={(e) => setEditAltText(e.target.value)}
                        placeholder="Image description for screen readers..."
                        className="h-9"
                      />
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Tags</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTag()}
                      placeholder="Add new tag..."
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={addTag}
                      disabled={!newTag.trim()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Used By */}
                {detailAsset.usedBy.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Used in ({detailAsset.usedBy.length})
                    </label>
                    <div className="space-y-1.5">
                      {detailAsset.usedBy.map((ref, idx) => (
                        <div
                          key={`${ref.contentId}-${idx}`}
                          className="flex items-center gap-2 text-xs rounded border px-2.5 py-1.5"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <a
                            href={`/content/${ref.contentId}`}
                            className="truncate flex-1 text-primary hover:underline"
                          >
                            {usageTitles[ref.contentId] ?? ref.contentId.slice(0, 8) + "..."}
                          </a>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {ref.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generation Info */}
                {detailAsset.generationPrompt && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Generation Prompt
                    </label>
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      {detailAsset.generationPrompt}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="border-t px-4 py-3 flex items-center gap-2">
                <Button onClick={handleSaveDetail} disabled={saving} className="flex-1">
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDeleteDetail}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
