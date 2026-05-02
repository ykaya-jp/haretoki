"use client";

import { useEffect, useState } from "react";
import { CloudOff, Loader2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { queueLength } from "@/lib/sync/offline-reconcile";

/**
 * Phase 3 Level 3 wave 3 — offline / queued visibility primitive.
 *
 * Renders a subtle one-line status next to (or below) any save-
 * triggering control. Three states:
 *
 *   - `idle`     : online, queue empty           → render nothing.
 *   - `pending`  : online, queue has N entries   → "保存待機中 (N 件)".
 *                  We are flushing right now, but earlier entries
 *                  are still in localStorage and show until the
 *                  consumer removes them via removeFromQueue.
 *   - `offline`  : offline                       → "オフラインで一時保存しました"
 *                  Couples writing notes on a venue floor with weak
 *                  reception need to know the data is safe.
 *
 * Component-side intentional non-features:
 *   - Does not re-fetch / re-flush on its own. The queue flush
 *     belongs to the form that owns the payload (rating-section,
 *     visit-note-form, …); this surface only shows status.
 *   - No retry button. The form decides "retry on online", "retry
 *     on next save", or "retry manually" — different forms make
 *     different choices and bundling a retry button here would
 *     force a single answer.
 *   - Polls localStorage every 4s while mounted. localStorage has
 *     no native change event for the same window; cross-tab updates
 *     would need `storage` events, which is out of scope for the
 *     "single tab, intermittent connectivity" case this surface
 *     answers. 4 seconds is long enough not to dominate the main
 *     thread, short enough that "I just queued one" reads nearly
 *     immediately.
 *
 * Accessibility: aria-live="polite" so screen-reader couples hear
 * the state changes (offline → online → empty) without it
 * interrupting their current speech.
 */

interface QueuedSavingIndicatorProps {
  /** Sync namespace — must match the namespace passed to
   *  enqueueMutation in the same form (e.g. "visit-note",
   *  "rating-section"). */
  namespace: string;
  /** Visual size. Default "compact" matches the existing in-form
   *  "saved a moment ago" line; "wide" works in panel headers. */
  size?: "compact" | "wide";
  /** Override default class for any extra positioning the consumer
   *  cares about. Optional. */
  className?: string;
}

export function QueuedSavingIndicator({
  namespace,
  size = "compact",
  className = "",
}: QueuedSavingIndicatorProps) {
  const online = useOnlineStatus();
  // Tri-state mirrors the OnboardingPartnerHint pattern: null until
  // the first client tick has read localStorage, then 0..N. Avoids
  // a flash of "保存待機中: 0 件" on hydration when the actual queue
  // is empty.
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      setPending(queueLength(namespace));
    };
    // Defer the first read into the next animation frame so the
    // setState doesn't fire during the synchronous effect tick —
    // same React Compiler-friendly defer recipe as
    // OnboardingPartnerHint and PartnerCanRateHint.
    const raf = requestAnimationFrame(tick);
    const interval = window.setInterval(tick, 4000);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
    };
  }, [namespace]);

  // Pre-hydration / no queue / online → render nothing so the
  // form chrome doesn't reserve space for a status that will never
  // appear in the happy path.
  if (pending === null) return null;
  if (online && pending === 0) return null;

  const baseClass =
    size === "wide"
      ? "flex items-center gap-2 rounded-md border px-3 py-2"
      : "inline-flex items-center gap-1.5";

  // Offline takes precedence over a non-empty queue: if the user
  // is offline, the queue is the *reason* they should not worry,
  // not a separate concern.
  if (!online) {
    return (
      <p
        role="status"
        aria-live="polite"
        className={`${baseClass} text-[12px] text-muted-foreground ${className}`}
      >
        <CloudOff
          className="h-3.5 w-3.5 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        オフラインで一時保存しました
        {pending > 1 ? <span className="tabular-nums">（{pending} 件）</span> : null}
      </p>
    );
  }

  // Online but queue still draining. The `Loader2 spin` matches the
  // existing in-progress affordance the rest of the app uses, so
  // couples read "the app is working on it" without a fresh
  // vocabulary lesson.
  return (
    <p
      role="status"
      aria-live="polite"
      className={`${baseClass} text-[12px] text-muted-foreground ${className}`}
    >
      <Loader2
        className="h-3.5 w-3.5 animate-spin text-[var(--gold-warm)]"
        strokeWidth={1.8}
        aria-hidden="true"
      />
      保存待機中
      <span className="tabular-nums">（{pending} 件）</span>
    </p>
  );
}
