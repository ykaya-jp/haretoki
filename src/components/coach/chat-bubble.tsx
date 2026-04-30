"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  /** Optional timestamp for assistant messages — displayed as HH:MM eyebrow */
  timestamp?: Date;
}

function TypingDots() {
  // Coach-3: tiny dots + language context so a blank bubble doesn't look
  // stuck. Three dots bouncing 2px on the y axis, staggered 120ms apart.
  // Pure CSS animation — framer-motion was holding the main thread during
  // long Claude streams (W16-3 / performance-audit B-06). Keyframes live
  // in globals.css under .animate-coach-typing-bounce.
  const dots = [0, 1, 2];
  return (
    <div
      aria-label="コーチが考えています"
      className="flex items-center gap-2 py-0.5"
    >
      <span className="text-xs text-muted-foreground">
        コーチが考えています
      </span>
      <div className="flex items-center gap-1">
        {dots.map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold-warm)] animate-coach-typing-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatBubble({ role, content, timestamp }: ChatBubbleProps) {
  const showTyping = role === "assistant" && content.length === 0;

  return (
    <div
      className={cn(
        "flex gap-2.5 animate-coach-bubble-enter",
        role === "user" ? "justify-end" : "justify-start",
      )}
    >
      {role === "assistant" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-subtle)] shadow-[0_1px_4px_color-mix(in_oklab,var(--gold-warm)_22%,transparent)]">
          <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" />
        </div>
      )}
      <div className={cn("flex flex-col gap-1", role === "user" ? "items-end" : "items-start")}>
        {/* Coach-2: meta info eyebrow for assistant messages */}
        {role === "assistant" && (
          <p className="text-eyebrow text-muted-foreground/60 px-1">
            <span>coach</span>
            {timestamp && (
              <>
                <span aria-hidden="true" className="mx-1 opacity-40">·</span>
                <span className="tabular-nums normal-case tracking-normal">
                  {timestamp.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </>
            )}
          </p>
        )}
        <div
          className={cn(
            "max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-wrap",
            role === "user"
              ? "rounded-br-sm bg-primary text-primary-foreground text-sm"
              : "rounded-bl-sm border border-[color-mix(in_oklab,var(--gold-warm)_25%,transparent)] bg-[color-mix(in_oklab,var(--gold-subtle)_38%,var(--card))] font-[family-name:var(--font-display)] text-[15px] font-light text-foreground"
          )}
        // Announce streaming chunks to screen readers, but only on the
        // assistant's text container — NOT the whole bubble — so the
        // typing-dots → text swap doesn't get re-announced.
        {...(role === "assistant" && !showTyping
          ? {
              role: "status" as const,
              "aria-live": "polite" as const,
              "aria-atomic": "false" as const,
            }
          : {})}
      >
        {showTyping ? <TypingDots /> : content}
        </div>
      </div>
    </div>
  );
}
