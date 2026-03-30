"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageIcon, Upload } from "lucide-react";
import { TiptapEditor } from "@/components/tiptap-editor";
import { MediaPicker } from "@/components/media-picker";

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

// ── Editor Component ────────────────────────────────────────────

interface ShopwareEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  contentType: { fields: Array<{ id: string; label: string; type: string; exampleContent?: string }> } | null;
  readOnly?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
}

export function ShopwareEditor({ values, onChange, contentType, readOnly, onImageUpload }: ShopwareEditorProps) {
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

              {block.slots.map((slot) => (
                <div key={slot.id} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{slot.slotName}</Label>

                  {slot.type === "image" ? (
                    // Image slot: preview + browse
                    <div className="space-y-2">
                      {values[slot.id] ? (
                        <img
                          src={String(values[slot.id])}
                          alt=""
                          className="rounded-md border max-h-40 w-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center rounded-md border border-dashed bg-muted/50 h-24">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      {!readOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => setBrowseFieldId(slot.id)}
                        >
                          <ImageIcon className="mr-1 h-3 w-3" />
                          Browse
                        </Button>
                      )}
                    </div>
                  ) : slot.type === "rich-text" || slot.type === "markdown" ? (
                    // Rich text slot: TipTap WYSIWYG
                    <TiptapEditor
                      content={String(values[slot.id] ?? "")}
                      onChange={(md) => onChange({ ...values, [slot.id]: md })}
                      editable={!readOnly}
                      onImageUpload={onImageUpload}
                    />
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
          ))}
        </div>
      ))}

      {/* MediaPicker for image slots */}
      <MediaPicker
        open={!!browseFieldId}
        onOpenChange={(open) => { if (!open) setBrowseFieldId(null); }}
        typeFilter="image"
        onSelect={(asset) => {
          if (browseFieldId) {
            // Use the thumbnail URL from the asset
            onChange({ ...values, [browseFieldId]: asset.id });
            setBrowseFieldId(null);
          }
        }}
      />
    </div>
  );
}
