"use client";

import { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * "届く通知の例" preview modal.
 *
 * Surfaces a static look-alike of the OS notification banner so a
 * couple can decide whether to grant push permission *before* the
 * browser asks. Permission denied at the system level is sticky on
 * iOS / Android — couples who deny once need to dig into Settings to
 * re-enable, which they almost never do. Showing the content first
 * is the highest-leverage opt-in nudge we have.
 *
 * The cards are static / hard-coded so this surface stays free of
 * server-action dependencies and renders instantly. Real push
 * delivery (VAPID + web-push) ships in the same Phase that wires the
 * permission prompt; this preview is the comprehension step that
 * precedes the prompt.
 *
 * Visual language tries to read as "OS notification" rather than
 * "Haretoki UI element": neutral-ish white card, rounded corners,
 * subtle shadow, eyebrow time stamp on the top-right. We deliberately
 * do NOT chrome the cards in gold — that would frame them as
 * marketing rather than as a faithful preview.
 *
 * Examples cover the four push types currently planned:
 *   1. Visit reminder (前日19時 + 当日朝) — already shipping via
 *      src/server/cron/visit-reminder-handler.ts
 *   2. Partner activity — partner just rated / favourited a venue
 *   3. Weekly insight — coach round-up of the past week
 *   4. Decision nudge — fires when a couple has 2+ favourites and
 *      hasn't made a decision in 14+ days
 *
 * a11y: real `<dialog>` semantics via `role="dialog"` +
 * `aria-modal="true"`; Esc dismisses; backdrop is a `<button>` so
 * keyboard users can reach the close affordance from anywhere on the
 * modal. Pattern mirrors partner-welcome-modal.tsx.
 */

interface PreviewCard {
  title: string;
  body: string;
  // Editorial pseudo-timestamp shown top-right. Not real; reads as
  // "this is what your notification feed would look like at 19:00 on
  // a typical evening".
  when: string;
}

const PREVIEW_CARDS: readonly PreviewCard[] = [
  {
    title: "明日 14:00 から見学",
    body: "ABC ガーデン。服装や持ち物をホームでまとめておきましょう。",
    when: "昨日 19:00",
  },
  {
    title: "パートナーが評価を入れました",
    body: "ABC ガーデン に「料理 ★4.5」。並べて見比べてみましょう。",
    when: "今日 12:30",
  },
  {
    title: "今週のふたりの歩み",
    body: "見学が 1 件、候補が 3 件。週末に整理してみませんか。",
    when: "日曜 18:00",
  },
  {
    title: "そろそろ決めどき?",
    body: "候補 5 件のうち 2 件が拮抗しています。比較表を見直しましょう。",
    when: "今日 09:00",
  },
];

interface NotificationPreviewModalProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPreviewModal({
  open,
  onClose,
}: NotificationPreviewModalProps) {
  useEffect(() => {
    if (open) track("notification_preview_opened");
  }, [open]);

  // Lock background scroll while the modal is open. Restoring on
  // unmount / close keeps the page rhythm intact for users who
  // scrolled mid-page.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  return (
    // role="dialog" + aria-modal="true" + onKeyDown form is the
    // canonical modal pattern — same recipe as
    // partner-welcome-modal.tsx, see that file for the linter
    // rationale.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-preview-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[env(safe-area-inset-bottom)] sm:items-center"
    >
      <button
        type="button"
        aria-label="プレビューを閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        tabIndex={-1}
      />

      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-xl"
      >
        {/* Top-right dismiss — 36px hit target matches the standard
            modal pattern across the app. */}
        <button
          type="button"
          aria-label="プレビューを閉じる"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/80 text-muted-foreground backdrop-blur-sm transition-colors active:bg-muted"
        >
          <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.6} />
        </button>

        <div className="space-y-5 px-5 pb-6 pt-7">
          <header className="space-y-1.5">
            <p className="text-eyebrow text-[var(--gold-warm)]">
              Notification Preview
            </p>
            <h2
              id="notification-preview-title"
              className="font-[family-name:var(--font-display)] text-[20px] font-light leading-snug tracking-tight text-foreground"
            >
              届く通知の例
            </h2>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              実際の OS 通知に近い見た目で、4 種類のお知らせ例をご覧いただけます。
            </p>
          </header>

          {/* Notification look-alike stack. The slight overlap +
              translate creates the "stacked notifications" feel of
              an iOS lock screen without copying the OS chrome
              verbatim. */}
          <ul aria-label="通知の例" className="space-y-2">
            {PREVIEW_CARDS.map((card, i) => (
              <li
                key={card.title}
                className={cn(
                  "rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm",
                  // Subtle 0/1/2/3 staircase tint on the bg so stacked
                  // cards read as separate items even at a glance —
                  // mirrors how iOS dims older notifications.
                  i === 0 && "bg-card",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--gold-warm)_18%,var(--card))]"
                  >
                    <Bell
                      className="h-3.5 w-3.5 text-[var(--gold-warm)]"
                      strokeWidth={1.8}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-medium leading-tight text-foreground">
                        {card.title}
                      </p>
                      <span className="shrink-0 tabular-nums text-[10.5px] text-muted-foreground/80">
                        {card.when}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                      {card.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-[11.5px] leading-relaxed text-muted-foreground/80">
            ※ 上の例はサンプルです。実際には設定した頻度（おまかせ / 控えめ / オフ）と、
            ふたりの活動に合わせて届きます。
          </p>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-foreground/90 px-6 text-sm font-medium text-background transition-colors active:scale-[0.98]"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
