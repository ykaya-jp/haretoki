"use client";

import { useEffect, useRef } from "react";
import { ChatBubble } from "@/components/coach/chat-bubble";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatHistoryProps {
  messages: ChatMessage[];
}

/**
 * Renders the coach chat history with auto-scroll-to-bottom on new messages.
 * The parent /coach page is a Server Component, so the scroll effect lives
 * in this client child where it has access to React lifecycle.
 *
 * W16-3 (performance-audit B-06): smooth scroll left CLS at 0.15 — every
 * SSE chunk that grew the latest assistant bubble re-triggered the 350ms
 * smooth animation, and chunks landing back-to-back fought each other
 * mid-flight. Instant scroll keeps the layout shift below the noise floor
 * and is invisible to the user once the bubble has rendered.
 */
export function ChatHistory({ messages }: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastContent = messages[messages.length - 1]?.content ?? "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages.length, lastContent]);

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
      ))}
      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
