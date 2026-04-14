"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { sendCoachMessage } from "@/server/actions/coach";

const PROMPTS = [
  "予算の相場を知りたい",
  "神前式とチャペルの違いを教えて",
  "ゲスト80人だとどれくらいの会場がいい？",
] as const;

/**
 * Zero-state rescue: shown on /coach when the couple has no venues/insights yet.
 * Tapping a chip sends the prompt through sendCoachMessage and refreshes the page
 * so the conversation is visible immediately without leaving /coach.
 */
export function CoachQuickStart() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const send = (prompt: string, idx: number) => {
    if (isPending) return;
    setActiveIdx(idx);
    startTransition(async () => {
      await sendCoachMessage(prompt);
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" />
        <span className="font-medium">まず相談してみる</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        式場を決める前でも、気になることを聞いてみましょう。AIコーチが答えます。
      </p>
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((prompt, idx) => {
          const loading = isPending && activeIdx === idx;
          return (
            <button
              key={prompt}
              type="button"
              disabled={isPending}
              onClick={() => send(prompt, idx)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs transition-all active:scale-[0.98] hover:shadow-sm disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 text-[var(--gold-warm)]" />
              )}
              <span>{prompt}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
