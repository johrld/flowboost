"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { ImageIcon } from "lucide-react";

// ── Slot Layout Parser ──────────────────────────────────────────

interface SlotField {
  id: string;
  label: string;
  type: string;
  slotName: string;
}

interface Block {
  blockType: string;
  slots: SlotField[];
  columns: number;
}

interface Section {
  index: number;
  blocks: Block[];
}

function parseSlotLayout(fields: Array<{ id: string; label: string; type: string }>): Section[] {
  const sectionMap = new Map<number, Map<string, SlotField[]>>();

  for (const field of fields) {
    // Parse: s{N}-{blockType}-{slotName}
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
      const columns = getBlockColumns(blockType);
      blocks.push({ blockType, slots, columns });
    }
    sections.push({ index, blocks });
  }

  return sections;
}

function getBlockColumns(blockType: string): number {
  if (blockType.includes("three-column")) return 3;
  if (blockType.includes("two-column") || blockType.includes("image-text")) return 2;
  return 1;
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
  contentType: { fields: Array<{ id: string; label: string; type: string }> } | null;
  readOnly?: boolean;
}

export function ShopwareEditor({ values, onChange, contentType, readOnly }: ShopwareEditorProps) {
  const sections = useMemo(
    () => parseSlotLayout(contentType?.fields ?? []),
    [contentType?.fields],
  );

  if (!contentType || sections.length === 0) {
    return <p className="text-sm text-muted-foreground">No slots found in this content type.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      {/* Left: Editor */}
      <div className="overflow-y-auto space-y-6 pr-2">
        {sections.map((section) => (
          <div key={section.index} className="space-y-3">
            {section.blocks.map((block) => (
              <div key={`${section.index}-${block.blockType}`}>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Section {section.index} — {getBlockLabel(block.blockType)}
                </p>
                <div className={`grid gap-3 ${block.columns === 3 ? "grid-cols-3" : block.columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {block.slots.map((slot) => (
                    <div key={slot.id} className="space-y-1">
                      <Label className="text-xs">{slot.slotName}</Label>
                      {slot.type === "image" ? (
                        <div className="flex items-center justify-center rounded-md border border-dashed bg-muted/50 aspect-video">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      ) : (
                        <textarea
                          value={String(values[slot.id] ?? "")}
                          onChange={(e) => onChange({ ...values, [slot.id]: e.target.value })}
                          readOnly={readOnly}
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder={slot.slotName}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Right: Preview */}
      <div className="overflow-y-auto border rounded-lg bg-white p-4 space-y-4">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        {sections.map((section) => (
          <div key={section.index} className="space-y-2">
            {section.blocks.map((block) => (
              <div
                key={`${section.index}-${block.blockType}`}
                className={`grid gap-3 ${block.columns === 3 ? "grid-cols-3" : block.columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {block.slots.map((slot) => (
                  <div key={slot.id} className="min-h-[40px]">
                    {slot.type === "image" ? (
                      <div className="flex items-center justify-center rounded bg-muted aspect-video">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    ) : values[slot.id] ? (
                      <div
                        className="prose prose-sm max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: String(values[slot.id]) }}
                      />
                    ) : (
                      <div className="rounded bg-muted/30 h-full min-h-[40px]" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
