"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  MessageCircle,
  Mail,
  Video,
  GripVertical,
  X,
  Pencil,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import {
  getContentTypes,
  createContentType,
  updateContentType,
  deleteContentType,
  type ContentTypeDefinition,
} from "@/lib/api";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  site: <FileText className="h-4 w-4" />,
  social: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  media: <Video className="h-4 w-4" />,
};

const SOURCE_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  builtin: { label: "Built-in", variant: "secondary" },
  connector: { label: "Imported", variant: "outline" },
  custom: { label: "Custom", variant: "default" },
};

const FIELD_TYPES = [
  { value: "short-text", label: "Short Text" },
  { value: "long-text", label: "Long Text" },
  { value: "rich-text", label: "Rich Text" },
  { value: "markdown", label: "Markdown" },
  { value: "image", label: "Image" },
  { value: "faq", label: "FAQ" },
  { value: "cta", label: "CTA" },
  { value: "list", label: "List" },
  { value: "json", label: "JSON" },
  { value: "boolean", label: "Boolean" },
];

interface FieldDraft {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

export default function ContentTypesPage() {
  const { customerId, projectId } = useProject();
  const [types, setTypes] = useState<ContentTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingType, setEditingType] = useState<ContentTypeDefinition | null>(null);

  // Editor state
  const [editorLabel, setEditorLabel] = useState("");
  const [editorCategory, setEditorCategory] = useState<string>("site");
  const [editorDescription, setEditorDescription] = useState("");
  const [editorFields, setEditorFields] = useState<FieldDraft[]>([]);
  const [editorAgentRole, setEditorAgentRole] = useState("");
  const [editorAgentGuidelines, setEditorAgentGuidelines] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!customerId || !projectId) return;
    try {
      const t = await getContentTypes(customerId, projectId);
      setTypes(t);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openEditor = (ct?: ContentTypeDefinition) => {
    if (ct) {
      setEditingType(ct);
      setEditorLabel(ct.label);
      setEditorCategory(ct.category);
      setEditorDescription(ct.description ?? "");
      setEditorFields(ct.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
      })));
      setEditorAgentRole(ct.agent?.role ?? "");
      setEditorAgentGuidelines(ct.agent?.guidelines ?? "");
    } else {
      setEditingType(null);
      setEditorLabel("");
      setEditorCategory("site");
      setEditorDescription("");
      setEditorFields([{ id: "", label: "", type: "short-text", required: true }]);
      setEditorAgentRole("");
      setEditorAgentGuidelines("");
    }
    setShowEditor(true);
  };

  const addField = () => {
    setEditorFields([...editorFields, { id: "", label: "", type: "short-text", required: false }]);
  };

  const updateField = (index: number, updates: Partial<FieldDraft>) => {
    const updated = [...editorFields];
    updated[index] = { ...updated[index], ...updates };
    // Auto-generate id from label
    if (updates.label !== undefined) {
      updated[index].id = updates.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    setEditorFields(updated);
  };

  const removeField = (index: number) => {
    setEditorFields(editorFields.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!customerId || !projectId || !editorLabel.trim() || editorFields.length === 0) return;
    setSaving(true);
    try {
      const fields = editorFields
        .filter((f) => f.label.trim())
        .map((f, i) => ({
          id: f.id || f.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          label: f.label,
          type: f.type,
          required: f.required,
          sortOrder: i,
        }));

      const agent = editorAgentRole.trim() || editorAgentGuidelines.trim()
        ? { role: editorAgentRole.trim(), guidelines: editorAgentGuidelines.trim() }
        : undefined;

      if (editingType) {
        await updateContentType(customerId, projectId, editingType.id, {
          label: editorLabel,
          description: editorDescription || undefined,
          category: editorCategory as ContentTypeDefinition["category"],
          fields,
          agent,
        });
      } else {
        await createContentType(customerId, projectId, {
          label: editorLabel,
          description: editorDescription || undefined,
          category: editorCategory,
          fields,
          agent,
        });
      }
      setShowEditor(false);
      await loadData();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!customerId || !projectId) return;
    try {
      await deleteContentType(customerId, projectId, id);
      await loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const builtinTypes = types.filter((t) => t.source === "builtin");
  const importedTypes = types.filter((t) => t.source === "connector");
  const customTypes = types.filter((t) => t.source === "custom");

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Types</h1>
          <p className="text-muted-foreground">Define what content formats your project supports</p>
        </div>
        <Button onClick={() => openEditor()}>
          <Plus className="mr-2 h-4 w-4" />
          New Type
        </Button>
      </div>

      {/* Built-in */}
      {builtinTypes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Built-in</h2>
          <div className="space-y-2">
            {builtinTypes.map((ct) => (
              <div key={ct.id} className="flex items-center gap-3 rounded-lg border p-3 group">
                <span className="text-muted-foreground">{CATEGORY_ICONS[ct.category]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ct.label}</p>
                  <p className="text-xs text-muted-foreground">{ct.fields.length} fields · {ct.category}{ct.agent ? " · Agent configured" : ""}</p>
                </div>
                <Badge variant="secondary" className="text-xs">Built-in</Badge>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => openEditor(ct)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Imported */}
      {importedTypes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Imported from Connector</h2>
          <div className="space-y-2">
            {importedTypes.map((ct) => (
              <div key={ct.id} className="flex items-center gap-3 rounded-lg border p-3 group">
                <span className="text-muted-foreground">{CATEGORY_ICONS[ct.category]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ct.label}</p>
                  <p className="text-xs text-muted-foreground">{ct.fields.length} fields · {ct.category} · {ct.connectorType}</p>
                </div>
                <Badge variant="outline" className="text-xs">Imported</Badge>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => openEditor(ct)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Custom</h2>
        {customTypes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">No custom content types yet.</p>
            <Button variant="outline" size="sm" onClick={() => openEditor()}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create Custom Type
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {customTypes.map((ct) => (
              <div key={ct.id} className="flex items-center gap-3 rounded-lg border p-3 group">
                <span className="text-muted-foreground">{CATEGORY_ICONS[ct.category]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ct.label}</p>
                  <p className="text-xs text-muted-foreground">{ct.fields.length} fields · {ct.category}</p>
                </div>
                <Badge variant="default" className="text-xs">Custom</Badge>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => openEditor(ct)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(ct.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Content Type" : "New Content Type"}</DialogTitle>
            <DialogDescription>Define the fields that make up this content format.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editorLabel} onChange={(e) => setEditorLabel(e.target.value)} placeholder="e.g. Company Newsletter" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editorCategory} onValueChange={setEditorCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={editorDescription} onChange={(e) => setEditorDescription(e.target.value)} placeholder="What is this content type for?" />
            </div>

            <Tabs defaultValue="fields" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="fields" className="flex-1">Fields</TabsTrigger>
                <TabsTrigger value="agent" className="flex-1">Agent</TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <Label>Fields</Label>
                  <Button variant="ghost" size="sm" onClick={addField}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Field
                  </Button>
                </div>

                <div className="space-y-2">
                  {editorFields.map((field, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border p-2">
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                        placeholder="Field name"
                        className="flex-1 h-8 text-sm"
                      />
                      <Select value={field.type} onValueChange={(v) => updateField(i, { type: v })}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((ft) => (
                            <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant={field.required ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs shrink-0"
                        onClick={() => updateField(i, { required: !field.required })}
                      >
                        {field.required ? "Required" : "Optional"}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeField(i)} disabled={editorFields.length <= 1}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="agent" className="space-y-4 mt-3">
                <p className="text-xs text-muted-foreground">
                  Configure how the AI agent behaves when creating this content type.
                </p>
                <div className="space-y-2">
                  <Label>Agent Role</Label>
                  <Input
                    value={editorAgentRole}
                    onChange={(e) => setEditorAgentRole(e.target.value)}
                    placeholder="e.g. You are a senior LinkedIn content strategist..."
                  />
                  <p className="text-xs text-muted-foreground">First line of the agent prompt. Defines identity and expertise.</p>
                </div>
                <div className="space-y-2">
                  <Label>Guidelines (Markdown)</Label>
                  <Textarea
                    value={editorAgentGuidelines}
                    onChange={(e) => setEditorAgentGuidelines(e.target.value)}
                    className="min-h-[250px] font-mono text-sm"
                    placeholder={"## Tone & Voice\n\n- Professional but approachable\n\n## Structure\n\n- Hook in first line\n- ..."}
                  />
                  <p className="text-xs text-muted-foreground">Tone, structure, do/don&apos;ts, examples. Injected into the agent prompt.</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!editorLabel.trim() || editorFields.length === 0 || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingType ? "Save Changes" : "Create Type"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
