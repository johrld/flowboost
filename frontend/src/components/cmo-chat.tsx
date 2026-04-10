"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCmoChatHistory, sendCmoChat } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { Loader2, Send } from "lucide-react";
import Markdown from "react-markdown";

interface CmoChatProps {
  customerId: string;
  projectId: string;
}

export function CmoChat({ customerId, projectId }: CmoChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const msgs = await getCmoChatHistory(customerId, projectId);
        if (!cancelled) {
          setMessages(msgs);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [customerId, projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    const optimisticMsg: ChatMessage = { role: "user", content: text, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const result = await sendCmoChat(customerId, projectId, text);
      const assistantMsg: ChatMessage = { role: "assistant", content: result.reply, ts: new Date().toISOString() };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Failed to send message"}`,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm font-medium">CMO</p>
            <p className="text-xs text-muted-foreground">
              Your content strategist. Ask about content gaps, competitors, trends, or get help planning your next piece.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-muted/50 border prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                }`}
              >
                {msg.role === "assistant" ? <Markdown>{msg.content}</Markdown> : msg.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-3 bg-muted/50 border flex items-center gap-1.5">
              <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 p-4 border-t shrink-0">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the CMO..."
          className="min-h-[40px] max-h-[120px] resize-none text-sm"
          rows={1}
          disabled={sending}
        />
        <Button
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={handleSend}
          disabled={!input.trim() || sending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
