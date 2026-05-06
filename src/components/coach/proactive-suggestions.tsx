"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Compass,
  GitCompareArrows,
  Heart,
  ListChecks,
  Loader2,
  Receipt,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { sendCoachMessage } from "@/server/actions/coach";
import type { ProactiveSuggestion } from "@/server/actions/coach-suggestions";

const ICON_MAP: Record<ProactiveSuggestion["iconKey"], LucideIcon> = {
  heart: Heart,
  calendar: Calendar,
  receipt: Receipt,
  compare: GitCompareArrows,
  countdown: Timer,
  list: ListChecks,
  compass: Compass,
};

/**
 * Layer B4 — proactive coach suggestions surfaced above CoachQuickStart
 * when the user has at least 1 venue. Each card pre-fills its prompt
 * via `?prompt=` (so the user can edit) — same pattern CoachQuickStart's
 * primary cards use, intentionally consistent so the affordance is
 * familiar.
 *
 * Tap behaviour:
 *   - Tap title  → preFill (router.replace with ?prompt=...)
 *   - Tap "送る" → sendSecondary (one-shot send + nav to /coach?session=)
 *
 * The component is a no-op when the suggestions array is empty (server
 * already returned []), so callers don't need an empty-state branch.
 */
export function ProactiveSuggestions({
  suggestions,
}: {
  suggestions: ProactiveSuggestion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sendingRef = useRef(false);

  if (suggestions.length === 0) return null;

  const preFill = (prompt: string) => {
    const params = new URLSearchParams({ prompt });
    router.replace(`/coach?${params.toString()}`, { scroll: false });
  };

  const sendNow = (suggestion: ProactiveSuggestion) => {
    if (isPending || sendingRef.current) return;
    sendingRef.current = true;
    setActiveId(suggestion.id);
    startTransition(async () => {
      try {
        const result = await sendCoachMessage(suggestion.prompt);
        if (result.sessionId) {
          router.replace(`/coach?session=${result.sessionId}`, { scroll: true });
          router.refresh();
        } else {
          router.refresh();
        }
      } finally {
        sendingRef.current = false;
      }
    });
  };

  return (
    <section
      aria-label="今あなたに合いそうな相談"
      className="space-y-4 rounded-2xl border border-[color-mix(in_oklab,var(--gold-warm)_22%,transparent)] bg-[color-mix(in_oklab,var(--gold-subtle)_55%,var(--card))] p-5"
    >
      <div className="flex items-center gap-2">
        <Sparkles
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <p className="text-eyebrow text-[var(--gold-warm)]">
          今あなたに合いそうな相談
        </p>
      </div>

      <ul className="space-y-2.5">
        {suggestions.map((s) => {
          const Icon = ICON_MAP[s.iconKey] ?? Sparkles;
          const loading = isPending && activeId === s.id;
          return (
            <li key={s.id}>
              <div className="group flex items-stretch gap-3 rounded-2xl bg-card/80 p-3.5 transition-shadow hover:shadow-sm">
                <button
                  type="button"
                  onClick={() => preFill(s.prompt)}
                  className="flex flex-1 items-start gap-3 text-left"
                  aria-label={`${s.title} — 入力欄に質問文を入れます`}
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background:
                        "color-mix(in oklab, var(--gold-warm) 14%, var(--background))",
                    }}
                  >
                    <Icon
                      className="h-4 w-4 text-[var(--gold-warm)]"
                      strokeWidth={1.6}
                    />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate font-[family-name:var(--font-display)] text-fluid-base font-light text-foreground">
                      {s.title}
                    </span>
                    <span className="block truncate text-fluid-xs leading-relaxed text-muted-foreground">
                      {s.subtitle}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => sendNow(s)}
                  disabled={isPending}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1 self-center rounded-full border border-border bg-background px-3 text-fluid-xs font-medium text-foreground/80 transition-all active:scale-95 disabled:opacity-60"
                  aria-label={`${s.title} を AI コーチに送信`}
                >
                  {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-[var(--gold-warm)]" />
                  )}
                  送る
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
