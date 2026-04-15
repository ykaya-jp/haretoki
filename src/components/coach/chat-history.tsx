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
 */
export function ChatHistory({ messages }: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
      ))}
      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
