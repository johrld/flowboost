"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, X } from "lucide-react";
import type { ContentTypeDefinition } from "@/lib/api";

interface GenericEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  contentType: ContentTypeDefinition | null;
  readOnly?: boolean;
}

export function GenericEditor({ values, onChange, contentType, readOnly }: GenericEditorProps) {
  const [copied, setCopied] = useState(false);

  const fields = contentType?.fields ?? [];
  const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);

  const updateField = (fieldId: string, val: unknown) => {
    onChange({ ...values, [fieldId]: val });
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground">No field definitions available. Showing raw JSON.</p>
      )}

      {sorted.map((field) => (
        <FieldRenderer
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(val) => updateField(field.id, val)}
          readOnly={readOnly}
        />
      ))}

      {/* Show any extra fields not in the schema */}
      {Object.keys(values)
        .filter((k) => !fields.some((f) => f.id === k))
        .map((key) => (
          <div key={key} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{key}</Label>
            <Textarea
              value={typeof values[key] === "string" ? values[key] as string : JSON.stringify(values[key], null, 2)}
              onChange={(e) => updateField(key, e.target.value)}
              rows={3}
              disabled={readOnly}
              className="text-sm font-mono resize-none"
            />
          </div>
        ))}

      <Button variant="outline" className="w-full" onClick={copyToClipboard}>
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {copied ? "Copied!" : "Copy JSON to Clipboard"}
      </Button>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: ContentTypeDefinition["fields"][number];
  value: unknown;
  onChange: (val: unknown) => void;
  readOnly?: boolean;
}) {
  const charLimit = field.constraints?.charLimit as number | undefined;
  const strVal = typeof value === "string" ? value : "";

  switch (field.type) {
    case "short-text":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
          <Input
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            className="text-sm"
          />
          {charLimit && (
            <p className={`text-xs ${strVal.length > charLimit ? "text-red-500" : "text-muted-foreground"}`}>
              {strVal.length}/{charLimit}
            </p>
          )}
        </div>
      );

    case "long-text":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
          <Textarea
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            disabled={readOnly}
            className="resize-none text-sm"
          />
          {charLimit && (
            <p className={`text-xs ${strVal.length > charLimit ? "text-red-500" : "text-muted-foreground"}`}>
              {strVal.length}/{charLimit}
            </p>
          )}
        </div>
      );

    case "markdown":
    case "rich-text":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Textarea
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            rows={10}
            disabled={readOnly}
            className="resize-none text-sm font-mono"
          />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Input
            type="number"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={readOnly}
            className="text-sm w-32"
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={readOnly}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label className="text-xs">{field.label}</Label>
        </div>
      );

    case "list":
      return <ListFieldRenderer label={field.label} value={value} onChange={onChange} maxItems={(field.constraints as Record<string, unknown>)?.maxItems as number | undefined} readOnly={readOnly} />;

    case "image":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          {strVal ? (
            <p className="text-xs text-muted-foreground bg-muted rounded p-2">Image prompt: {strVal}</p>
          ) : (
            <p className="text-xs text-muted-foreground">No image</p>
          )}
        </div>
      );

    default:
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label} <span className="text-muted-foreground">({field.type})</span></Label>
          <Textarea
            value={typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2)}
            onChange={(e) => {
              try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
            }}
            rows={4}
            disabled={readOnly}
            className="resize-none text-sm font-mono"
          />
        </div>
      );
  }
}

function ListFieldRenderer({
  label,
  value,
  onChange,
  maxItems,
  readOnly,
}: {
  label: string;
  value: unknown;
  onChange: (val: unknown) => void;
  maxItems?: number;
  readOnly?: boolean;
}) {
  const [input, setInput] = useState("");
  const items = Array.isArray(value) ? (value as string[]) : [];

  const add = () => {
    const item = input.trim();
    if (!item || (maxItems && items.length >= maxItems)) return;
    if (!items.includes(item)) onChange([...items, item]);
    setInput("");
  };

  const remove = (item: string) => onChange(items.filter((i) => i !== item));

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label} {maxItems && <span className="text-muted-foreground">({items.length}/{maxItems})</span>}</Label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="text-xs gap-1">
            {item}
            {!readOnly && (
              <button onClick={() => remove(item)} className="ml-0.5 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!readOnly && (!maxItems || items.length < maxItems) && (
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder={`Add ${label.toLowerCase()}...`}
            className="text-sm h-8"
          />
          <Button variant="outline" size="sm" onClick={add} className="h-8">Add</Button>
        </div>
      )}
    </div>
  );
}
