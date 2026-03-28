"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Sparkles } from "lucide-react";
import { marked } from "marked";
import type { ChatMessage } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6100";

interface ContentChatProps {
  customerId: string;
  projectId: string;
  contentId: string;
  /** Called when agent returns field updates */
  onApplyUpdates?: (updates: Record<string, unknown>) => void;
}

export function ContentChat({ customerId, projectId, contentId, onApplyUpdates }: ContentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history
  const loadHistory = useCallback(async () => {
    setChatLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/customers/${customerId}/projects/${projectId}/content/${contentId}/chat`,
      );
      if (res.ok) {
        const data = await res.json() as ChatMessage[];
        setMessages(data);
      }
    } catch { /* ignore */ }
    setChatLoading(false);
  }, [customerId, projectId, contentId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg, ts: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await fetch(
        `${API_URL}/customers/${customerId}/projects/${projectId}/content/${contentId}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg }),
        },
      );

      if (res.ok) {
        const data = await res.json() as ChatMessage;
        setMessages((prev) => [...prev, data]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again.", ts: new Date().toISOString() },
      ]);
    }
    setLoading(false);
  };

  // Extract JSON updates from assistant message
  const extractUpdates = (text: string): Record<string, unknown> | null => {
    const match = text.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[1]) as { updates?: Record<string, unknown> };
      return parsed.updates ?? null;
    } catch {
      return null;
    }
  };

  // Strip JSON block from display text
  const displayText = (text: string): string => {
    return text.replace(/```json\s*\n?[\s\S]*?\n?```/g, "").trim();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Sparkles className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ask AI to refine this content
            </p>
            <p className="text-xs text-muted-foreground">
              e.g. "Make the tone more casual" or "Add a stronger CTA"
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const updates = msg.role === "assistant" ? extractUpdates(msg.content) : null;
            return (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{displayText(msg.content)}</p>
                  ) : (
                    <div
                      className="prose prose-sm max-w-none leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm [&_hr]:my-2"
                      dangerouslySetInnerHTML={{ __html: marked.parse(displayText(msg.content)) as string }}
                    />
                  )}
                  {updates && onApplyUpdates && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs gap-1.5 bg-background"
                      onClick={() => onApplyUpdates(updates)}
                    >
                      <Sparkles className="h-3 w-3" />
                      Apply Changes
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask AI to refine..."
            rows={1}
            className="resize-none text-sm min-h-[36px]"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="shrink-0 h-9 w-9"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
