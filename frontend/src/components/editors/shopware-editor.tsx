"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageIcon, Upload, Package } from "lucide-react";
import { TiptapEditor } from "@/components/tiptap-editor";
import { MediaPicker } from "@/components/media-picker";
import { getMediaFileUrl } from "@/lib/api";

// ── Slot Layout Parser ──────────────────────────────────────────

interface SlotField {
  id: string;
  label: string;
  type: string;
  slotName: string;
  exampleContent?: string;
}

interface Block {
  blockType: string;
  slots: SlotField[];
}

interface Section {
  index: number;
  blocks: Block[];
}

function parseSlotLayout(fields: Array<{ id: string; label: string; type: string; exampleContent?: string }>): Section[] {
  const sectionMap = new Map<number, Map<string, SlotField[]>>();

  for (const field of fields) {
    const match = field.id.match(/^s(\d+)-(.+)-([^-]+)$/);
    if (!match) continue;

    const sectionIdx = parseInt(match[1], 10);
    const blockType = match[2];
    const slotName = match[3];

    if (!sectionMap.has(sectionIdx)) sectionMap.set(sectionIdx, new Map());
    const blocks = sectionMap.get(sectionIdx)!;
    if (!blocks.has(blockType)) blocks.set(blockType, []);
    blocks.get(blockType)!.push({ ...field, slotName });
  }

  const sections: Section[] = [];
  for (const [index, blockMap] of [...sectionMap.entries()].sort((a, b) => a[0] - b[0])) {
    const blocks: Block[] = [];
    for (const [blockType, slots] of blockMap) {
      blocks.push({ blockType, slots });
    }
    sections.push({ index, blocks });
  }

  return sections;
}

function getBlockLabel(blockType: string): string {
  if (blockType.includes("three-column")) return "Three Columns";
  if (blockType.includes("two-column")) return "Two Columns";
  if (blockType.includes("image-text")) return "Image + Text";
  if (blockType.includes("product-slider")) return "Products";
  if (blockType.includes("image")) return "Image";
  return "Content";
}

function getBlockGridClass(blockType: string): string {
  if (blockType.includes("three-column")) return "grid grid-cols-3 gap-4";
  if (blockType.includes("two-column") || blockType.includes("image-text")) return "grid grid-cols-2 gap-4";
  return "space-y-3";
}

const slotOrder: Record<string, number> = { left: 0, "center-left": 1, center: 2, "center-right": 3, right: 4 };

function sortSlots(slots: SlotField[]): SlotField[] {
  return [...slots].sort((a, b) => (slotOrder[a.slotName] ?? 9) - (slotOrder[b.slotName] ?? 9));
}

// ── Editor Component ────────────────────────────────────────────

interface ShopwareEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  contentType: { fields: Array<{ id: string; label: string; type: string; exampleContent?: string }> } | null;
  readOnly?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
  customerId?: string;
  projectId?: string;
}

export function ShopwareEditor({ values, onChange, contentType, readOnly, onImageUpload, customerId, projectId }: ShopwareEditorProps) {
  const [browseFieldId, setBrowseFieldId] = useState<string | null>(null);

  const sections = useMemo(
    () => parseSlotLayout(contentType?.fields ?? []),
    [contentType?.fields],
  );

  if (!contentType || sections.length === 0) {
    return <p className="text-sm text-muted-foreground">No slots found in this content type.</p>;
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <div key={section.index} className="space-y-4">
          {section.blocks.map((block) => (
            <div key={`${section.index}-${block.blockType}`} className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Section {section.index} — {getBlockLabel(block.blockType)}
              </p>

              <div className={getBlockGridClass(block.blockType)}>
              {sortSlots(block.slots).map((slot, idx) => (
                <div key={`${slot.id}-${idx}`} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{slot.slotName}</Label>

                  {slot.type === "image" ? (
                    // Image slot: click to browse, drag to upload
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => !readOnly && setBrowseFieldId(slot.id)}
                      onDragOver={(e) => { if (!readOnly) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        if (readOnly || !onImageUpload) return;
                        const file = e.dataTransfer.files[0];
                        if (file?.type.startsWith("image/")) {
                          const url = await onImageUpload(file);
                          onChange({ ...values, [slot.id]: url });
                        }
                      }}
                      className="w-full rounded-md border border-dashed bg-muted/50 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors disabled:cursor-default"
                    >
                      {values[slot.id] ? (
                        <img
                          src={String(values[slot.id])}
                          alt=""
                          className="w-full aspect-video object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-24 gap-1">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Click or drop image</span>
                        </div>
                      )}
                    </button>
                  ) : slot.type === "rich-text" || slot.type === "markdown" ? (
                    // Rich text slot: TipTap WYSIWYG
                    <TiptapEditor
                      content={String(values[slot.id] ?? "")}
                      onChange={(md) => onChange({ ...values, [slot.id]: md })}
                      editable={!readOnly}
                      onImageUpload={onImageUpload}
                    />
                  ) : slot.type === "json" && (slot.id.includes("product") || slot.slotName.includes("product")) ? (
                    // Product slot: hint to add sources
                    <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center">
                      <Package className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">
                        Product selection — add products as sources in your flow, then AI will choose relevant ones for this slot.
                      </p>
                    </div>
                  ) : (
                    // Other slots: plain textarea
                    <textarea
                      value={String(values[slot.id] ?? "")}
                      onChange={(e) => onChange({ ...values, [slot.id]: e.target.value })}
                      readOnly={readOnly}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={slot.exampleContent ? `Example: ${slot.exampleContent.slice(0, 100)}...` : slot.slotName}
                    />
                  )}
                </div>
              ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* MediaPicker for image slots */}
      <MediaPicker
        open={!!browseFieldId}
        onOpenChange={(open) => { if (!open) setBrowseFieldId(null); }}
        typeFilter="image"
        onSelect={(asset) => {
          if (browseFieldId && customerId && projectId) {
            const url = getMediaFileUrl(customerId, projectId, asset.id);
            onChange({ ...values, [browseFieldId]: url });
            setBrowseFieldId(null);
          }
        }}
      />
    </div>
  );
}
