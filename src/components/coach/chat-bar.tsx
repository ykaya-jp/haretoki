"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { sendCoachMessage } from "@/server/actions/coach";
import { ChatBubble } from "@/components/coach/chat-bubble";
import { useRouter } from "next/navigation";

interface InFlight {
  userText: string;
  assistantText: string;
  streaming: boolean;
}

async function streamReply(
  message: string,
  onChunk: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/coach/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames separated by a blank line.
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const dataLines = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart());
      if (dataLines.length === 0) continue;
      const dataStr = dataLines.join("\n");
      if (dataStr === "[DONE]") return;
      try {
        const parsed = JSON.parse(dataStr) as { text?: string };
        if (parsed.text) onChunk(parsed.text);
      } catch {
        // ignore malformed frame
      }
    }
  }
}

export function ChatBar() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Synchronous guard: React state updates are queued, so `busy` can be stale
  // between back-to-back Enter presses. A ref flips immediately.
  const sendingRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Abort any in-flight SSE stream on unmount to stop burning Anthropic tokens
  // after the user navigates away.
  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = isPending || inFlight !== null;

  const handleSend = async () => {
    if (!message.trim() || busy) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    const msg = message.trim();
    setMessage("");
    // Keep keyboard up + caret in the input so the user can chain messages
    // without re-focusing manually (especially important on mobile).
    inputRef.current?.focus();

    // Optimistic: show user bubble + empty assistant bubble (typing indicator).
    setInFlight({ userText: msg, assistantText: "", streaming: true });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamReply(
        msg,
        (chunk) => {
          setInFlight((prev) =>
            prev
              ? { ...prev, assistantText: prev.assistantText + chunk }
              : prev,
          );
        },
        controller.signal,
      );

      setInFlight((prev) => (prev ? { ...prev, streaming: false } : prev));
      startTransition(() => {
        router.refresh();
        // Hold optimistic pair briefly so the refreshed history can paint in.
        setTimeout(() => setInFlight(null), 80);
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Fallback to non-streaming server action so user still gets an answer.
      try {
        const result = await sendCoachMessage(msg);
        setInFlight({
          userText: msg,
          assistantText: result.answer,
          streaming: false,
        });
        startTransition(() => {
          router.refresh();
          setTimeout(() => setInFlight(null), 80);
        });
      } catch {
        // Both streaming AND non-streaming fallback failed — restore the
        // user's message so they don't have to retype it.
        setInFlight(null);
        setMessage(msg);
      }
    } finally {
      sendingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {inFlight && (
        <div className="space-y-3 pb-4">
          <ChatBubble role="user" content={inFlight.userText} />
          <ChatBubble role="assistant" content={inFlight.assistantText} />
        </div>
      )}
      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="なんでも気軽に聞いてください"
            aria-label="コーチへのメッセージ"
            enterKeyHint="send"
            autoComplete="off"
            className="flex-1 rounded-2xl bg-muted px-5 py-3 text-base outline-none focus:ring-2 focus:ring-primary/30"
            disabled={busy}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={busy || !message.trim()}
            aria-label={busy ? "送信しています" : "送信する"}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-200 active:scale-[0.93] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
