"use client";

/**
 * DecisionSummaryCard — per-venue "この式場を選ぶなら" disclosure.
 *
 * Lives directly under VenueCard in the shortlist. Default: a single
 * headline line so the list stays scannable. Tap → expands to price
 * delta + strengths + compromises + rationale.
 *
 * Visual: gold-subtle bg + 3px gold left border (AI insight token family).
 *
 * Rendered only by the parent when shortlist.length >= 2; this component
 * still defensively no-ops when its summary is null so moving the render
 * gate doesn't break the UI.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { DecisionSummary } from "@/lib/decision-summary";

interface Props {
  summary: DecisionSummary | null;
  /** Defaults to the venue's display name — shown in aria label / expand hint. */
  venueName: string;
}

export function DecisionSummaryCard({ summary, venueName }: Props) {
  const [open, setOpen] = useState(false);

  if (!summary) return null;

  const toggleId = `decision-summary-${summary.venueId}`;

  return (
    <div
      className="mt-2 overflow-hidden rounded-2xl border-l-[3px] border-y border-r border-border/40"
      style={{
        borderLeftColor: "var(--gold-warm)",
        background: "var(--gold-subtle)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={toggleId}
        aria-label={`${venueName}を選んだ場合のサマリー`}
        className="flex w-full min-h-11 items-start gap-2.5 px-4 py-3 text-left transition-colors active:bg-black/5"
      >
        <Sparkles
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold-warm)]"
          strokeWidth={1.6}
        />
        <div className="flex-1">
          <p className="text-eyebrow text-[var(--gold-warm)]">
            この式場を選ぶなら
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-display)] text-[14px] font-light leading-snug tracking-[0.01em] text-foreground">
            {summary.headline}
          </p>
        </div>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1 shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={1.6} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={toggleId}
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4 pt-1 text-[12.5px] leading-relaxed text-foreground/90">
              {summary.price && summary.price.direction !== "tied" && (
                <div className="flex items-start gap-2">
                  {summary.price.direction === "cheaper" ? (
                    <TrendingDown
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--gold-warm)]"
                      strokeWidth={1.8}
                    />
                  ) : (
                    <TrendingUp
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      strokeWidth={1.8}
                    />
                  )}
                  <p className="tabular-nums">
                    {summary.price.label}
                    <span className="text-muted-foreground">
                      （{summary.price.comparedWith} 比）
                    </span>
                  </p>
                </div>
              )}

              {summary.strengths.length > 0 && (
                <div>
                  <p className="text-eyebrow text-[var(--gold-warm)]">他より優れる点</p>
                  <ul className="mt-1 space-y-0.5">
                    {summary.strengths.map((s) => (
                      <li key={s.dimension} className="flex items-center gap-1.5">
                        <span className="inline-block h-1 w-1 rounded-full bg-[var(--gold-warm)]" />
                        <span>
                          {s.label}
                          <span className="ml-1 text-muted-foreground tabular-nums">
                            （+{s.diff.toFixed(1)}）
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.compromises.length > 0 && (
                <div>
                  <p className="text-eyebrow text-muted-foreground">譲る点</p>
                  <ul className="mt-1 space-y-0.5">
                    {summary.compromises.map((c) => (
                      <li key={c.dimension} className="flex items-center gap-1.5">
                        <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/60" />
                        <span>
                          {c.label}
                          <span className="ml-1 text-muted-foreground tabular-nums">
                            （{c.diff.toFixed(1)}）
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="border-t border-border/30 pt-2 text-muted-foreground">
                {summary.rationale}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
