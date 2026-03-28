"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, Check, Plus, Trash2, GripVertical, Mail, ExternalLink } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface NewsletterEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
  projectName?: string;
  authorName?: string;
  authorRole?: string;
  authorImage?: string;
}

interface Section {
  heading: string;
  body: string;
}

function SortableSection({
  id,
  index,
  section,
  onUpdate,
  onRemove,
  readOnly,
}: {
  id: string;
  index: number;
  section: Section;
  onUpdate: (field: "heading" | "body", val: string) => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-background p-4 space-y-2">
      <div className="flex items-center gap-2">
        {!readOnly && (
          <button type="button" className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0 touch-none" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="text-xs text-muted-foreground shrink-0">Section {index + 1}</span>
        <Input
          value={section.heading}
          onChange={(e) => onUpdate("heading", e.target.value)}
          placeholder="Section heading"
          className="text-sm font-medium h-8"
          disabled={readOnly}
        />
        {!readOnly && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <Textarea
        value={section.body}
        onChange={(e) => onUpdate("body", e.target.value)}
        placeholder="Section content..."
        rows={4}
        disabled={readOnly}
        className="resize-none text-sm"
      />
    </div>
  );
}

export function NewsletterEditor({ values, onChange, readOnly, projectName = "Your Brand" }: NewsletterEditorProps) {
  const [copied, setCopied] = useState(false);

  const subject = (values.subject ?? "") as string;
  const preview = (values.preview ?? values.previewText ?? "") as string;
  const sections = (values.sections ?? []) as Section[];
  const cta = (values.cta ?? null) as { text?: string; buttonLabel?: string; url?: string } | null;
  const body = (values.body ?? "") as string;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sectionIds = sections.map((_, i) => `section-${i}`);

  const updateField = (field: string, val: unknown) => onChange({ ...values, [field]: val });

  const updateSection = (idx: number, field: "heading" | "body", val: string) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [field]: val };
    updateField("sections", updated);
  };

  const addSection = () => {
    updateField("sections", [...sections, { heading: "", body: "" }]);
  };

  const removeSection = (idx: number) => {
    updateField("sections", sections.filter((_, i) => i !== idx));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sectionIds.indexOf(active.id as string);
    const newIdx = sectionIds.indexOf(over.id as string);
    updateField("sections", arrayMove(sections, oldIdx, newIdx));
  };

  const copyToClipboard = async () => {
    const parts = [`Subject: ${subject}`, `Preview: ${preview}`, ""];
    for (const s of sections) {
      parts.push(`## ${s.heading}`, s.body, "");
    }
    if (body) parts.push(body);
    if (cta?.text) parts.push(`\n---\n${cta.text}`, cta.buttonLabel ? `[${cta.buttonLabel}](${cta.url ?? "#"})` : "");
    await navigator.clipboard.writeText(parts.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalWords = sections.reduce((sum, s) => sum + s.body.split(/\s+/).filter(Boolean).length, 0)
    + (body ? body.split(/\s+/).filter(Boolean).length : 0);

  return (
    <div className="space-y-6">
      {/* Subject Line */}
      <div className="space-y-1.5">
        <Label className="text-xs">Subject Line</Label>
        <Input
          value={subject}
          onChange={(e) => updateField("subject", e.target.value)}
          placeholder="Your newsletter subject..."
          disabled={readOnly}
          className="text-base font-semibold"
        />
        <p className={`text-xs ${subject.length > 60 ? "text-amber-500" : "text-muted-foreground"}`}>
          {subject.length}/60 characters {subject.length > 60 ? "(may be cut off on mobile)" : ""}
        </p>
      </div>

      {/* Preview Text */}
      <div className="space-y-1.5">
        <Label className="text-xs">Preview Text</Label>
        <Input
          value={preview}
          onChange={(e) => { updateField("preview", e.target.value); updateField("previewText", e.target.value); }}
          placeholder="Text shown after subject in inbox..."
          disabled={readOnly}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">{preview.length}/120 characters</p>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Sections ({sections.length}) · {totalWords} words</Label>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={addSection} className="h-7 text-xs">
              <Plus className="mr-1 h-3 w-3" />Add Section
            </Button>
          )}
        </div>

        {sections.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {sections.map((section, i) => (
                  <SortableSection
                    key={sectionIds[i]}
                    id={sectionIds[i]}
                    index={i}
                    section={section}
                    onUpdate={(field, val) => updateSection(i, field, val)}
                    onRemove={() => removeSection(i)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : body ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Body</Label>
            <Textarea
              value={body}
              onChange={(e) => updateField("body", e.target.value)}
              rows={8}
              disabled={readOnly}
              className="resize-none text-sm"
            />
          </div>
        ) : null}
      </div>

      {/* CTA */}
      {!cta && !readOnly && (
        <Button variant="outline" size="sm" onClick={() => updateField("cta", { text: "", buttonLabel: "", url: "" })} className="w-full">
          <Plus className="mr-1.5 h-3.5 w-3.5" />Add Call to Action
        </Button>
      )}
      {cta && (
        <div className="space-y-2 rounded-lg border p-4">
          <Label className="text-xs">Call to Action</Label>
          <Input
            value={cta.text ?? ""}
            onChange={(e) => updateField("cta", { ...cta, text: e.target.value })}
            placeholder="CTA text..."
            disabled={readOnly}
            className="text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={cta.buttonLabel ?? ""}
              onChange={(e) => updateField("cta", { ...cta, buttonLabel: e.target.value })}
              placeholder="Button label"
              disabled={readOnly}
              className="text-sm h-8"
            />
            <Input
              value={cta.url ?? ""}
              onChange={(e) => updateField("cta", { ...cta, url: e.target.value })}
              placeholder="https://..."
              disabled={readOnly}
              className="text-sm h-8"
            />
          </div>
        </div>
      )}

      {/* Email Preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Preview</p>
        <div className="rounded-lg border bg-white shadow-sm max-w-[500px] overflow-hidden">
          {/* Inbox preview line */}
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{projectName}</span>
                  <span className="text-xs text-gray-500">now</span>
                </div>
                <p className="text-sm text-gray-900 font-medium truncate">{subject || "No subject"}</p>
                <p className="text-xs text-gray-500 truncate">{preview || "..."}</p>
              </div>
            </div>
          </div>

          {/* Email body */}
          <div className="p-6 space-y-4">
            {sections.map((s, i) => (
              <div key={i}>
                {s.heading && <h3 className="text-base font-semibold text-gray-900 mb-1">{s.heading}</h3>}
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.body.slice(0, 200)}{s.body.length > 200 ? "..." : ""}</p>
              </div>
            ))}
            {body && !sections.length && (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{body.slice(0, 300)}</p>
            )}
            {cta?.buttonLabel && (
              <div className="pt-2">
                <div className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0A66C2] text-white text-sm font-medium rounded-md">
                  {cta.buttonLabel}
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </div>
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
