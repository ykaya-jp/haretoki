"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  /** Optional timestamp for assistant messages — displayed as HH:MM eyebrow */
  timestamp?: Date;
}

function TypingDots() {
  // Coach-3: tiny dots + language context so a blank bubble doesn't look
  // stuck. Dots use a 2px bounce (y axis) instead of opacity pulse — feels
  // more like "thinking" than a load spinner.
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
          <motion.span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold-warm)]"
            animate={{ y: [0, -2, 0] }}
            transition={{
              duration: 0.7,
              repeat: Infinity,
              ease: [0.16, 1, 0.3, 1],
              delay: i * 0.12,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatBubble({ role, content, timestamp }: ChatBubbleProps) {
  const showTyping = role === "assistant" && content.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: role === "user" ? 16 : -16, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-2.5", role === "user" ? "justify-end" : "justify-start")}
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
    </motion.div>
  );
}
