"use client";

import { useState, useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
import { sendCoachMessage } from "@/server/actions/coach";
import { useRouter } from "next/navigation";

export function ChatBar() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSend = () => {
    if (!message.trim() || isPending) return;
    const msg = message;
    setMessage("");

    startTransition(async () => {
      await sendCoachMessage(msg);
      router.refresh();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="なんでも気軽に聞いてください"
          className="flex-1 rounded-2xl bg-muted px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--gold-warm)]/30"
          disabled={isPending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending || !message.trim()}
          aria-label={isPending ? "送信しています" : "送信する"}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold-warm)] text-white shadow-[0_2px_8px_rgba(201,168,76,0.3)] transition-all duration-[400ms] active:scale-[0.93] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
