"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatBubble({ role, content }: ChatBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: role === "user" ? 16 : -16, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-2", role === "user" ? "justify-end" : "justify-start")}
    >
      {role === "assistant" && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--gold-warm)]" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          role === "user"
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground"
        )}
      >
        {content}
      </div>
    </motion.div>
  );
}
