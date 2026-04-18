"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { NightQuestion } from "@/lib/night-questions";

/**
 * R-5 今夜の一問: Coach 空状態の最上部に毎晩 1 問。
 * タップで `/coach?prompt=…` に遷移し、ChatBar が prompt を拾って会話開始。
 */
export function NightQuestionCard({ question }: { question: NightQuestion }) {
  const href = `/coach?prompt=${encodeURIComponent(question.seed ?? question.text)}`;
  return (
    <Link
      href={href}
      prefetch={true}
      className="group relative block overflow-hidden rounded-2xl border p-5 transition active:scale-[0.99]"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--primary) 5%, var(--background)) 0%, color-mix(in oklab, var(--gold-warm) 5%, var(--background)) 100%)",
        borderColor:
          "color-mix(in oklab, var(--primary) 25%, transparent)",
        borderLeftWidth: "3px",
        borderLeftColor: "var(--primary)",
      }}
    >
      {/* Large decorative quotation mark — editorial flourish */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-4 select-none font-[family-name:var(--font-display)] text-[88px] font-light leading-none text-[color:var(--primary)] opacity-[0.05]"
      >
        “
      </span>
      <div className="flex items-center gap-2">
        <MessageCircle
          aria-hidden="true"
          className="h-4 w-4 text-[color:var(--primary)]"
          strokeWidth={1.6}
        />
        <p className="text-eyebrow text-[color:var(--primary)]">
          今夜の一問
        </p>
      </div>
      <p className="relative mt-3 font-[family-name:var(--font-heading)] text-[17px] font-normal leading-[1.6] tracking-[0.005em] text-foreground">
        {question.text}
      </p>
      <p className="mt-4 text-[11.5px] text-muted-foreground">
        タップして、この問いから話しはじめる →
      </p>
    </Link>
  );
}
