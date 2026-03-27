"use client";

import { useState } from "react";
import { Bot, ArrowRight, Check } from "lucide-react";
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
  onComplete: (answers: Record<string, string>, summary: string) => void;
  onCancel: () => void;
}

export function ChatOnboarding({ contentType, onComplete, onCancel }: ChatOnboardingProps) {
  const questions = contentType.agent?.onboarding ?? [];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textValue, setTextValue] = useState("");

  if (questions.length === 0) {
    // No onboarding questions → skip straight to creation
    onComplete({}, `Create a ${contentType.label}`);
    return null;
  }

  const currentQuestion = questions[step];
  const isLastStep = step >= questions.length;

  const handleAnswer = (value: string) => {
    const updated = { ...answers, [currentQuestion.id]: value };
    setAnswers(updated);
    setTextValue("");
    setStep(step + 1);
  };

  const handleSkip = () => {
    setStep(step + 1);
  };

  const handleComplete = () => {
    // Build a natural language summary from answers
    const parts = [`Create a ${contentType.label}`];
    if (answers.topic) parts.push(`about "${answers.topic}"`);
    const otherAnswers = Object.entries(answers)
      .filter(([k]) => k !== "topic")
      .map(([k, v]) => `${k}: ${v}`);
    if (otherAnswers.length > 0) parts.push(`(${otherAnswers.join(", ")})`);
    parts.push(". Use all available sources and chat context.");
    onComplete(answers, parts.join(" "));
  };

  // Render completed answers as chat-like messages
  const completedSteps = questions.slice(0, step);

  return (
    <div className="space-y-4">
      {/* Previous Q&A pairs */}
      {completedSteps.map((q, i) => (
        <div key={q.id}>
          {/* AI question */}
          <div className="flex gap-3 mb-2">
            <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted mt-0.5">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm pt-1">{q.question}</p>
          </div>
          {/* User answer */}
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
          {/* AI question */}
          <div className="flex gap-3 mb-3">
            <div className="shrink-0 rounded-full p-1.5 h-7 w-7 flex items-center justify-center bg-muted mt-0.5">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm pt-1">{currentQuestion.question}</p>
          </div>

          {/* Answer input */}
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

          {(currentQuestion.type === "choice" || currentQuestion.type === "multi-choice") && currentQuestion.options && (
            <div className="ml-10 flex flex-wrap gap-2">
              {currentQuestion.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleAnswer(opt)}
                  className="px-3 py-1.5 text-sm rounded-full border hover:bg-muted transition-colors"
                >
                  {opt}
                </button>
              ))}
              {currentQuestion.optional && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-3 py-1.5 text-sm rounded-full text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip
                </button>
              )}
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
              <p className="text-sm mb-3">Here's what I'll create:</p>
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
          <div className="ml-10 flex gap-2">
            <Button size="sm" onClick={handleComplete}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Create Now
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              Keep chatting instead
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
