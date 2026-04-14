"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
}

function TypingDots() {
  // Pulsing 3-dot indicator: each dot cycles opacity with a staggered delay.
  const dots = [0, 1, 2];
  return (
    <div
      aria-label="入力中"
      className="flex items-center gap-1 py-0.5"
    >
      {dots.map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold-warm)]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

export function ChatBubble({ role, content }: ChatBubbleProps) {
  const showTyping = role === "assistant" && content.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: role === "user" ? 16 : -16, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-2.5", role === "user" ? "justify-end" : "justify-start")}
    >
      {role === "assistant" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-subtle)] shadow-[0_1px_4px_rgba(201,168,76,0.2)]">
          <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          role === "user"
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm border border-[var(--gold-warm)]/10 bg-[var(--gold-subtle)] text-foreground"
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
    </motion.div>
  );
}
