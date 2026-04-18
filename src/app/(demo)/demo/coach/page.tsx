"use client";

import Link from "next/link";
import { Sparkles, Send, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoData } from "@/components/demo/demo-data-provider";

// /demo/coach — mock chat with 3 pre-written Q&A turns.
// Input is visually present but disabled; hover tooltip prompts signup.
export default function DemoCoachPage() {
  const { coachTranscript } = useDemoData();

  return (
    <div className="space-y-6 pb-24">
      <header className="space-y-1 pt-2">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--gold-warm)]">
          <Sparkles className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          AIコーチ
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extralight tracking-[-0.01em]">
          コーチと話す
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          ふたりの好みや不安を聞きながら、AIが式場選びを一緒に考えます。以下は会話のサンプルです。
        </p>
      </header>

      {/* Transcript */}
      <section aria-label="会話サンプル" className="space-y-3">
        {coachTranscript.map((turn, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              turn.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                turn.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/60 bg-card text-foreground",
              )}
            >
              {turn.role === "assistant" && (
                <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-[var(--gold-warm)]">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  コーチ
                </p>
              )}
              <p className="whitespace-pre-wrap">{turn.content}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Disabled input — fixed near bottom nav */}
      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t border-border/40 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-3 sm:px-8">
          <label className="relative flex-1">
            <span className="sr-only">メッセージを入力</span>
            <input
              type="text"
              placeholder="体験モードでは送信できません"
              disabled
              aria-disabled="true"
              title="体験モードではチャットは送れません。登録後にお使いください。"
              className="h-11 w-full cursor-not-allowed rounded-full border border-border bg-muted px-4 pr-10 text-sm text-muted-foreground placeholder:text-muted-foreground/70"
            />
            <Lock
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
          </label>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="体験モードではチャットは送れません。登録後にお使いください。"
            className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="mx-auto max-w-5xl px-5 pb-3 text-center sm:px-8">
          <Link
            href="/signup"
            prefetch={true}
            className="text-xs text-[var(--gold-warm)] underline-offset-2 hover:underline"
          >
            コーチと実際に話すには、無料ではじめる →
          </Link>
        </div>
      </div>
    </div>
  );
}
