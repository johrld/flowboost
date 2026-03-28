"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/lib/project-context";
import { createTopic, startStrategy } from "@/lib/api";
import type { Topic } from "@/lib/types";
import {
  FileText,
  BookOpen,
  Layout,
  MessageSquare,
  Wand2,
  Lightbulb,
  Sparkles,
  Loader2,
  ArrowLeft,
} from "lucide-react";

type ContentFormat = "article" | "guide" | "landing_page" | "social_post";
type WizardStep = "format" | "source" | "manual";

interface FormatOption {
  value: ContentFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: "article",
    label: "Article",
    description: "Blog post or news article with SEO optimization",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    value: "social_post",
    label: "Social Post",
    description: "Short-form content for social media",
    icon: <MessageSquare className="h-5 w-5" />,
  },
  {
    value: "guide",
    label: "Guide",
    description: "In-depth tutorial or how-to guide",
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    value: "landing_page",
    label: "Landing Page",
    description: "Conversion-focused page with clear CTA",
    icon: <Layout className="h-5 w-5" />,
  },
];

interface NewContentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTopicCreated?: (topic: Topic) => void;
  onStrategyStarted?: () => void;
}

export function NewContentWizard({
  open,
  onOpenChange,
  onTopicCreated,
  onStrategyStarted,
}: NewContentWizardProps) {
  const router = useRouter();
  const { customerId, projectId, categories } = useProject();

  const [step, setStep] = useState<WizardStep>("format");
  const [format, setFormat] = useState<ContentFormat>("article");

  // Manual form fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);

  const reset = () => {
    setStep("format");
    setFormat("article");
    setTitle("");
    setCategory("");
    setNotes("");
    setSubmitting(false);
    setResearchLoading(false);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleSelectFormat = (f: ContentFormat) => {
    setFormat(f);
    setStep("source");
  };

  const handleAIDiscovery = async () => {
    if (!customerId || !projectId) return;
    setResearchLoading(true);
    try {
      await startStrategy(customerId, projectId);
      handleOpenChange(false);
      onStrategyStarted?.();
      router.push("/monitor");
    } catch (err) {
      console.error("Failed to start research:", err);
      setResearchLoading(false);
    }
  };

  const handleSubmitTopic = async () => {
    if (!title.trim() || !customerId || !projectId) return;
    setSubmitting(true);
    try {
      const topic = await createTopic(customerId, projectId, {
        title: title.trim(),
        category: category.trim() || undefined,
        userNotes: notes.trim() || undefined,
        direction: format || undefined,
      });

      handleOpenChange(false);
      onTopicCreated?.(topic);
    } catch (err) {
      console.error("Failed to create topic:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitle = {
    format: "New Content",
    source: `New ${FORMAT_OPTIONS.find((f) => f.value === format)?.label ?? "Content"}`,
    manual: "Your Idea",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{stepTitle[step]}</DialogTitle>
        </DialogHeader>

        {/* Step 1: Format Selection */}
        {step === "format" && (
          <div className="grid gap-2 py-2">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelectFormat(opt.value)}
                className="flex items-start gap-4 rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="rounded-full bg-primary/10 p-2.5 shrink-0 text-primary">
                  {opt.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {opt.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Source Selection */}
        {step === "source" && (
          <div className="space-y-3 py-2">
            <div className="grid gap-3">
              <button
                onClick={handleAIDiscovery}
                disabled={researchLoading}
                className="flex items-start gap-4 rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
                  <Wand2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">AI Discovery</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Let the AI research your market and find content
                    opportunities automatically
                  </p>
                </div>
              </button>

              <button
                onClick={() => setStep("manual")}
                className="flex items-start gap-4 rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="rounded-full bg-amber-500/10 p-2.5 shrink-0">
                  <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">Own Idea</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Submit your own topic idea — AI will research keywords and
                    competitors for you
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-start pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("format")}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Manual Form */}
        {step === "manual" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wizard-title">Title</Label>
              <Input
                id="wizard-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) handleSubmitTopic();
                }}
                placeholder="e.g. How to start meditating as a beginner"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wizard-category">Category (optional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="wizard-category">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">No preference</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.labels.de ?? cat.labels.en ?? cat.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wizard-notes">Notes (optional)</Label>
              <Textarea
                id="wizard-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any context, angle, or audience you have in mind..."
                rows={3}
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => setStep("source")}
                disabled={submitting}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                onClick={handleSubmitTopic}
                disabled={submitting || !title.trim()}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Submit & Analyze
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
