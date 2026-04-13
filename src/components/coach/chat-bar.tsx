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
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 border-t border-border bg-card px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="質問を入力..."
          className="flex-1 rounded-full bg-muted px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          disabled={isPending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending || !message.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
