"use client";

import { useState, useRef } from "react";
import { Bot, ArrowRight, Check, Upload, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContentTypeDefinition } from "@/lib/api";

interface OnboardingQuestion {
  id: string;
  question: string;
  type: "text" | "choice" | "multi-choice";
  placeholder?: string;
  options?: string[];
  optional?: boolean;
}

interface ChatOnboardingProps {
  contentType: ContentTypeDefinition;
  step: number;
  answers: Record<string, string>;
  onStepChange: (step: number) => void;
  onAnswersChange: (answers: Record<string, string>) => void;
  showUpload: boolean;
  onShowUploadChange: (show: boolean) => void;
  uploadedFiles: string[];
  onUploadedFilesChange: (files: string[]) => void;
  onComplete: (answers: Record<string, string>, summary: string) => void;
  onCancel: () => void;
  onFileUpload?: (files: FileList) => Promise<void>;
}

export function ChatOnboarding({
  contentType, step, answers, onStepChange, onAnswersChange,
  showUpload, onShowUploadChange, uploadedFiles, onUploadedFilesChange,
  onComplete, onCancel, onFileUpload,
}: ChatOnboardingProps) {
  const questions = contentType.agent?.onboarding ?? [];
  const [textValue, setTextValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // No onboarding questions → show simple topic input
  if (questions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted mt-0.5">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1">
            <p className="text-sm mb-3">Ready to create a {contentType.label}. What&apos;s the topic?</p>
            <div className="flex gap-2">
              <Input
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && textValue.trim()) onComplete({ topic: textValue.trim() }, `Create a ${contentType.label} about "${textValue.trim()}". Use all available sources and chat context.`); }}
                placeholder={`Topic for your ${contentType.label}...`}
                autoFocus
                className="flex-1"
              />
              <Button size="sm" onClick={() => onComplete({}, `Create a ${contentType.label}. Use all available sources and chat context.`)}>Skip</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[step];
  const isLastStep = step >= questions.length;

  const handleAnswer = (value: string) => {
    if (currentQuestion.id === "sources" && value.includes("add them now")) {
      onShowUploadChange(true);
      onAnswersChange({ ...answers, [currentQuestion.id]: value });
      return;
    }
    onAnswersChange({ ...answers, [currentQuestion.id]: value });
    setTextValue("");
    onStepChange(step + 1);
  };

  const handleSkip = () => {
    onStepChange(step + 1);
  };

  const handleFinishUpload = () => {
    onShowUploadChange(false);
    if (uploadedFiles.length > 0) {
      onAnswersChange({ ...answers, sources: `${uploadedFiles.length} file${uploadedFiles.length !== 1 ? "s" : ""} uploaded` });
    }
    onStepChange(step + 1);
  };

  const handleComplete = () => {
    const parts = [`Create a ${contentType.label}`];
    if (answers.topic) parts.push(`about "${answers.topic}"`);
    const otherAnswers = Object.entries(answers)
      .filter(([k]) => k !== "topic" && k !== "sources")
      .map(([k, v]) => `${k}: ${v}`);
    if (otherAnswers.length > 0) parts.push(`(${otherAnswers.join(", ")})`);
    parts.push(". Use all available sources and chat context.");
    onComplete(answers, parts.join(" "));
  };

  const completedSteps = questions.slice(0, step);

  return (
    <div className="space-y-4">
      {/* Previous Q&A */}
      {completedSteps.map((q) => (
        <div key={q.id}>
          <div className="flex gap-3 mb-2">
            <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted mt-0.5">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm pt-1">{q.question}</p>
          </div>
          {answers[q.id] && (
            <div className="flex justify-end mb-2">
              <div className="bg-muted rounded-2xl rounded-br-sm px-4 py-2">
                <p className="text-sm">{answers[q.id]}</p>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Current question or confirmation */}
      {!isLastStep ? (
        <div>
          <div className="flex gap-3 mb-3">
            <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted mt-0.5">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm pt-1">{currentQuestion.question}</p>
          </div>

          {/* Text input */}
          {currentQuestion.type === "text" && (
            <div className="ml-10 flex gap-2">
              <Input
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && textValue.trim()) handleAnswer(textValue.trim()); }}
                placeholder={currentQuestion.placeholder ?? "Type your answer..."}
                autoFocus
                className="flex-1"
              />
              <Button size="sm" onClick={() => textValue.trim() && handleAnswer(textValue.trim())} disabled={!textValue.trim()}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Choice pills */}
          {(currentQuestion.type === "choice" || currentQuestion.type === "multi-choice") && currentQuestion.options && !showUpload && (
            <div className="ml-10 flex flex-wrap gap-2">
              {currentQuestion.options.map((opt) => (
                <button key={opt} type="button" onClick={() => handleAnswer(opt)}
                  className="px-3 py-1.5 text-sm rounded-full border hover:bg-muted transition-colors">
                  {opt}
                </button>
              ))}
              {currentQuestion.optional && (
                <button type="button" onClick={handleSkip}
                  className="px-3 py-1.5 text-sm rounded-full text-muted-foreground hover:text-foreground transition-colors">
                  Skip
                </button>
              )}
            </div>
          )}

          {/* Upload area */}
          {showUpload && (
            <div className="ml-10 space-y-3">
              <input ref={fileRef} type="file" className="hidden" multiple
                onChange={async (e) => {
                  if (e.target.files && onFileUpload) {
                    const names = Array.from(e.target.files).map((f) => f.name);
                    await onFileUpload(e.target.files);
                    onUploadedFilesChange([...uploadedFiles, ...names]);
                  }
                  e.target.value = "";
                }}
              />

              {/* Uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-1">
                  {uploadedFiles.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{name}</span>
                      <span className="text-xs text-emerald-500 shrink-0">Added</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border-2 border-dashed p-6 text-center">
                <Upload className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Drop files here or click to upload</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="mr-1.5 h-3.5 w-3.5" />Add More
                  </Button>
                  <Button size="sm" onClick={handleFinishUpload}>
                    {uploadedFiles.length > 0 ? "Continue" : "Skip"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Confirmation */
        <div>
          <div className="flex gap-3 mb-4">
            <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted mt-0.5">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm mb-3">Here&apos;s your brief:</p>
              <div className="rounded-xl bg-muted/50 p-4 space-y-1.5 text-sm">
                <p className="font-medium">{contentType.label}</p>
                {Object.entries(answers).map(([key, val]) => (
                  <p key={key} className="text-muted-foreground">
                    <span className="capitalize">{key}</span>: {val}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="ml-10 space-y-2">
            <div className="flex gap-2">
              <Button size="sm" onClick={handleComplete}>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Start Chat
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
