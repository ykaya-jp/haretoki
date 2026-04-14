"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { sendCoachMessage } from "@/server/actions/coach";
import { ChatBubble } from "@/components/coach/chat-bubble";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface InFlight {
  userText: string;
  assistantText: string;
  streaming: boolean;
}

interface ChatBarProps {
  /** Current session id — passed through to stream API for context. */
  sessionId?: string;
  /** Callback when a new session is created by the stream route. */
  onNewSession?: (id: string) => void;
}

async function streamReply(
  message: string,
  sessionId: string | undefined,
  onChunk: (text: string) => void,
  onSessionId: (id: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/coach/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let textChunkCount = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

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
      if (dataStr === "[DONE]") {
        if (textChunkCount === 0) {
          // Stream closed cleanly but carried zero text chunks — treat as
          // failure so the caller's catch branch can fall back to the
          // non-streaming sendCoachMessage path.
          throw new Error("stream returned no text chunks");
        }
        return;
      }
      try {
        const parsed = JSON.parse(dataStr) as { text?: string; sessionId?: string };
        if (parsed.sessionId) onSessionId(parsed.sessionId);
        if (parsed.text) {
          textChunkCount++;
          onChunk(parsed.text);
        }
      } catch {
        // ignore malformed frame
      }
    }
  }

  // Reader done without seeing [DONE] — still consider empty text as failure.
  if (textChunkCount === 0) {
    throw new Error("stream ended without text chunks");
  }
}

export function ChatBar({ sessionId, onNewSession }: ChatBarProps) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const [hasPrefill, setHasPrefill] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const promptParam = searchParams.get("prompt");

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!promptParam) return;
    setMessage(promptParam);
    setHasPrefill(true);
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      const el = inputRef.current;
      if (el) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }, 0);
    router.replace(pathname, { scroll: false });
    return () => window.clearTimeout(t);
  }, [promptParam, pathname, router]);

  const busy = isPending || inFlight !== null;

  const handleSend = async () => {
    if (!message.trim() || busy) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    const msg = message.trim();
    setMessage("");
    setHasPrefill(false);
    inputRef.current?.focus();

    setInFlight({ userText: msg, assistantText: "", streaming: true });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamReply(
        msg,
        sessionId,
        (chunk) => {
          setInFlight((prev) =>
            prev ? { ...prev, assistantText: prev.assistantText + chunk } : prev,
          );
        },
        (newSessionId) => {
          onNewSession?.(newSessionId);
        },
        controller.signal,
      );

      setInFlight((prev) => (prev ? { ...prev, streaming: false } : prev));
      startTransition(() => {
        router.refresh();
        setTimeout(() => setInFlight(null), 80);
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Fallback to non-streaming server action
      try {
        const result = await sendCoachMessage(msg, sessionId);
        // If a new session was created during fallback, propagate id
        if (result.sessionId && result.sessionId !== sessionId) {
          onNewSession?.(result.sessionId);
        }
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
      <div
        className="fixed left-0 right-0 border-t border-border bg-card/95 py-3 backdrop-blur-sm"
        style={{
          bottom: "calc(56px + env(safe-area-inset-bottom))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        {hasPrefill && (
          <div className="mx-auto mb-2 flex max-w-5xl items-center gap-1.5 text-[11px] text-[var(--gold-warm)]">
            <Sparkles aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} />
            <span>質問が入っています。編集するか、そのまま送信できます。</span>
          </div>
        )}
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (hasPrefill) setHasPrefill(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="なんでも気軽に聞いてください"
            aria-label="コーチへのメッセージ"
            enterKeyHint="send"
            autoComplete="off"
            /* min-w-0 lets flex shrink the input below its intrinsic width
             * so long placeholder text / composed IME buffer can't push the
             * adjacent send button past the right edge on mobile Safari. */
            className="min-w-0 flex-1 rounded-2xl bg-muted px-5 py-3 text-base outline-none focus:ring-2 focus:ring-primary/30"
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
