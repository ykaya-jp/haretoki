"use client";

import { useState, useTransition } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  updateVisitReminderTiming,
  type ReminderTimingFlags,
} from "@/server/actions/notification-preferences";
import type { VisitReminderPhase } from "@/lib/visit-reminders";

/**
 * Track B-3 per-timing toggles UI. Sits inside the Notifications card
 * directly below the frequency segmented control + push permission strip
 * so the three reminder surfaces (when / receive-or-not / per-timing
 * fine-tune) all live in one mental zone.
 *
 * Labels are lifted from `docs/ai/notifications/visit-reminder.md`
 * §"Timing" so the UI says the same thing the user will see in the push
 * payload itself — no second vocabulary to learn. Drift hook on the doc
 * keeps these in sync if either side moves.
 *
 * Optimistic update pattern: flip locally → server-action commits →
 * toast on success or revert on failure. The server action is upsert-
 * shaped so the row is created on first toggle (existing users have
 * never opened settings before B-3 shipped).
 */
const TIMINGS: ReadonlyArray<{
  /** UI <key> + server-action discriminant. */
  phase: VisitReminderPhase;
  /** Maps the phase to its column on the local React state object. */
  field: keyof ReminderTimingFlags;
  /** B-0 doc label (§"Timing" table column 1). */
  label: string;
  /** B-0 doc label (§"Timing" table column 3 — UX intent line). */
  helper: string;
}> = [
  {
    phase: "day_before",
    field: "dayBefore",
    label: "前日朝のリマインド",
    helper: "持ち物と当日見たいことを、夜のうちに整える",
  },
  {
    phase: "morning_of",
    field: "morningOf",
    label: "出発前のリマインド",
    helper: "当日 1 時間前に、見ておきたいポイントを思い出す",
  },
  {
    phase: "way_home",
    field: "wayHome",
    label: "帰り道のお誘い",
    helper: "印象が新しいうちに、おふたりの感想を残す",
  },
];

interface Props {
  initialTimings: ReminderTimingFlags;
}

export function ReminderTimingSettings({ initialTimings }: Props) {
  const [timings, setTimings] = useState<ReminderTimingFlags>(initialTimings);
  const [pendingPhase, setPendingPhase] =
    useState<VisitReminderPhase | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(phase: VisitReminderPhase, field: keyof ReminderTimingFlags) {
    if (pendingPhase) return;
    const previous = timings[field];
    const next = !previous;

    // Optimistic flip + per-row pending so the rest of the list stays
    // tappable. Reverts on error so the UI never lies about the saved
    // state — this matters because the same user might glance back at
    // the screen 5 sec later expecting the toggle to reflect reality.
    setTimings((prev) => ({ ...prev, [field]: next }));
    setPendingPhase(phase);

    startTransition(async () => {
      try {
        const result = await updateVisitReminderTiming({ phase, enabled: next });
        if (!result.ok) throw new Error(result.error ?? "保存に失敗しました");
        toast.success(
          next ? "リマインダーを受け取ります" : "このリマインダーを止めました",
        );
      } catch (err) {
        setTimings((prev) => ({ ...prev, [field]: previous }));
        const message =
          err instanceof Error ? err.message : "保存に失敗しました";
        toast.error(message);
      } finally {
        setPendingPhase(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <Bell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          リマインダーの送り方
        </p>
      </div>
      <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
        {TIMINGS.map(({ phase, field, label, helper }) => {
          const enabled = timings[field];
          const isPending = pendingPhase === phase;
          return (
            <li key={phase}>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={label}
                disabled={isPending}
                onClick={() => handleToggle(phase, field)}
                className={cn(
                  "flex min-h-11 w-full items-start gap-3 px-3 py-3 text-left transition-colors active:scale-[0.99]",
                  isPending && "opacity-60",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
                    enabled
                      ? "border-amber-400/60 bg-amber-500/80"
                      : "border-border bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-card shadow-sm transition-transform",
                      enabled && "translate-x-4",
                    )}
                  >
                    {enabled ? (
                      <Check className="h-2.5 w-2.5 text-amber-700" aria-hidden="true" />
                    ) : null}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm leading-tight text-foreground">
                    {label}
                  </span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">
                    {helper}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        通知が届く端末は「受け取る端末」一覧で確認できます。
      </p>
    </div>
  );
}
