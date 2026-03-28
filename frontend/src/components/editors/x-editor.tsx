"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface XEditorProps {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
  projectName?: string;
  authorName?: string;
  authorRole?: string;
  authorImage?: string;
}

const MAX_CHARS = 280;
const WARN_CHARS = 260;

function CharacterCounter({ count }: { count: number }) {
  const radius = 10;
  const stroke = 2;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const progress = Math.min(count / MAX_CHARS, 1);
  const strokeDashoffset = circumference - progress * circumference;

  const isOver = count > MAX_CHARS;
  const isWarn = count >= WARN_CHARS && count <= MAX_CHARS;

  let strokeColor = "#1DA1F2";
  if (isWarn) strokeColor = "#FFD400";
  if (isOver) strokeColor = "#F4212E";

  let textColor = "text-muted-foreground";
  if (isWarn) textColor = "text-yellow-500";
  if (isOver) textColor = "text-red-500";

  return (
    <div className="flex items-center gap-2">
      <svg width={radius * 2} height={radius * 2} className="rotate-[-90deg]">
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted-foreground/20"
        />
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-150"
        />
      </svg>
      <span className={`text-xs tabular-nums ${textColor}`}>
        {count}/{MAX_CHARS}
      </span>
    </div>
  );
}

export function XEditor({
  values,
  onChange,
  readOnly = false,
  projectName,
  authorName,
  authorImage,
}: XEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const text = (values.text as string) ?? "";
  const charCount = text.length;

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ ...values, text: e.target.value });
    },
    [values, onChange]
  );

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  const displayName = authorName ?? projectName ?? "Account";

  return (
    <div className="space-y-4">
      {/* Text Area */}
      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder="What's happening?"
          readOnly={readOnly}
          className="min-h-[6rem] max-h-[8rem] resize-none overflow-y-auto text-[15px]"
        />
        <div className="flex justify-end">
          <CharacterCounter count={charCount} />
        </div>
      </div>

      {/* Tweet Preview */}
      <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-950">
        <div className="flex gap-3">
          {/* Avatar */}
          <img
            src={authorImage ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1DA1F2&color=fff&size=80`}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
          />

          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold text-foreground truncate">
                {displayName}
              </span>
              <span className="text-muted-foreground truncate">
                @{displayName.toLowerCase().replace(/\s+/g, "")}
              </span>
              <span className="text-muted-foreground">&middot;</span>
              <span className="text-muted-foreground">1h</span>
            </div>

            {/* Tweet Body */}
            <div className="mt-1 text-[15px] text-foreground whitespace-pre-wrap break-words">
              {text || (
                <span className="text-muted-foreground italic">
                  Your post will appear here...
                </span>
              )}
            </div>

            {/* Action Row */}
            <div className="mt-3 flex max-w-[300px] justify-between text-muted-foreground">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs hover:text-[#1DA1F2] transition-colors"
                tabIndex={-1}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="currentColor"
                >
                  <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.25-.862 4.394-2.427 5.86l-4.722 4.42a.75.75 0 0 1-1.024 0l-4.722-4.42C3.612 14.394 2.75 12.25 2.75 10H1.751ZM9.756 4C6.496 4 3.751 6.69 3.751 10c0 1.77.681 3.45 1.918 4.61L10.128 19l4.459-4.39A6.13 6.13 0 0 0 16.5 10.13C16.5 6.83 13.81 4 10.117 4H9.756Z" />
                </svg>
                <span>3</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs hover:text-green-500 transition-colors"
                tabIndex={-1}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="currentColor"
                >
                  <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88ZM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2Z" />
                </svg>
                <span>12</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs hover:text-pink-500 transition-colors"
                tabIndex={-1}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="currentColor"
                >
                  <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.56-1.13-1.666-1.84-2.908-1.91Zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67Z" />
                </svg>
                <span>47</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs hover:text-[#1DA1F2] transition-colors"
                tabIndex={-1}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="currentColor"
                >
                  <path d="M8.75 21V3h2v18h-2ZM18 21V8.5h2V21h-2ZM4 21v-5.5h2V21H4ZM13 21V9.5h2V21h-2Z" />
                </svg>
                <span>1.2K</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Copy Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!text}
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
