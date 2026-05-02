"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  updatePartnerActivityToggle,
  type PartnerActivityFlags,
} from "@/server/actions/notification-preferences";
import type { RealtimePushEvent } from "@/lib/push/realtime-copy";

/**
 * P3 L3 W2 — couple-activity push toggles UI. Sits inside the
 * Notifications card next to ReminderTimingSettings so the four
 * surfaces (mode / push permission / reminder timings / partner
 * activity) live in one mental zone.
 *
 * Labels mirror `docs/ai/notifications/realtime-push.md` §"Event 種別"
 * column 1 so the user sees the same noun in this UI as in the push
 * payload they'll later receive.
 *
 * Optimistic-flip + revert-on-error + sonner toast — same pattern as
 * ReminderTimingSettings.
 */
const ACTIVITIES: ReadonlyArray<{
  event: RealtimePushEvent;
  field: keyof PartnerActivityFlags;
  label: string;
  helper: string;
}> = [
  {
    event: "partner_rating_added",
    field: "partnerRating",
    label: "相手の評価が届いたとき",
    helper: "相手が新しく評価を残した瞬間に、 そっとお知らせします",
  },
  {
    event: "partner_note_added",
    field: "partnerNote",
    label: "相手の見学メモが届いたとき",
    helper: "相手が見学メモを残した瞬間に、 そっとお知らせします",
  },
  {
    event: "decision_saved",
    field: "decisionSaved",
    label: "式場が決まったとき",
    helper: "おふたりで決定したことを、 もう片方にもお伝えします",
  },
  {
    event: "wedding_date_set",
    field: "weddingDateSet",
    label: "晴れの日が決まったとき",
    helper: "結婚式の日付が残った瞬間に、 もう片方にもお伝えします",
  },
];

interface Props {
  initialActivity: PartnerActivityFlags;
}

export function PartnerActivitySettings({ initialActivity }: Props) {
  const [activity, setActivity] =
    useState<PartnerActivityFlags>(initialActivity);
  const [pendingEvent, setPendingEvent] =
    useState<RealtimePushEvent | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(
    event: RealtimePushEvent,
    field: keyof PartnerActivityFlags,
  ) {
    if (pendingEvent) return;
    const previous = activity[field];
    const next = !previous;

    setActivity((prev) => ({ ...prev, [field]: next }));
    setPendingEvent(event);

    startTransition(async () => {
      try {
        const result = await updatePartnerActivityToggle({ event, enabled: next });
        if (!result.ok) throw new Error(result.error ?? "保存に失敗しました");
        toast.success(
          next ? "お知らせを受け取ります" : "このお知らせを止めました",
        );
      } catch (err) {
        setActivity((prev) => ({ ...prev, [field]: previous }));
        const message =
          err instanceof Error ? err.message : "保存に失敗しました";
        toast.error(message);
      } finally {
        setPendingEvent(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <Sparkles
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          相手の動きを知らせる
        </p>
      </div>
      <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
        {ACTIVITIES.map(({ event, field, label, helper }) => {
          const enabled = activity[field];
          const isPending = pendingEvent === event;
          return (
            <li key={event}>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={label}
                disabled={isPending}
                onClick={() => handleToggle(event, field)}
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
                      <Check
                        className="h-2.5 w-2.5 text-amber-700"
                        aria-hidden="true"
                      />
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
        同じ動きが短時間に何度も起きても、 通知は 1 時間に 1 回までにまとめます。
      </p>
    </div>
  );
}
