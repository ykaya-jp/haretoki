"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, SlidersHorizontal, Check, X } from "lucide-react";
import { getMatrixData, type MatrixData } from "@/server/actions/matrix";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

const HIDDEN_DIMS_KEY = "haretoki:matrix:hidden-dims";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

function formatYen(amount: number | null): string {
  if (amount === null) return "—";
  const man = Math.round(amount / 10000);
  return `${man}万円`;
}

function scoreColor(score: number | null, isWinner: boolean): string {
  if (score === null) return "text-muted-foreground/40";
  if (isWinner) return "text-[var(--gold-warm)] font-medium";
  if (score >= 4.0) return "text-foreground";
  if (score >= 3.0) return "text-foreground/80";
  return "text-muted-foreground";
}

/** Winner cell: stronger gold tint + subtle top hairline. Non-winner: subtle tonal. */
function scoreBackground(score: number | null, isWinner: boolean): string {
  if (isWinner) return "bg-[color-mix(in_oklab,var(--gold-warm)_10%,transparent)]";
  if (score === null) return "bg-transparent";
  if (score >= 4.5) return "bg-green-50/50";
  if (score >= 4.0) return "bg-green-50/25";
  if (score < 3.0) return "bg-red-50/25";
  return "bg-transparent";
}

/**
 * Hydrate hiddenDims from localStorage via a lazy useState initializer rather
 * than an effect. `useEffect`+`setState` pattern trips React 19's
 * `set-state-in-effect` rule (cascading renders). `typeof window` guards SSR;
 * the matrix shows a loading skeleton until `getMatrixData()` resolves, so
 * there's no hydration-visible difference.
 */
function readPersistedHiddenDims(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_DIMS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return new Set(parsed as string[]);
    }
  } catch {
    // corrupted/privacy mode — fall through
  }
  return new Set();
}

export function DecisionMatrix() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hiddenDims, setHiddenDims] = useState<Set<string>>(readPersistedHiddenDims);
  const [filterOpen, setFilterOpen] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    getMatrixData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const toggleDim = (id: string) => {
    setHiddenDims((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(HIDDEN_DIMS_KEY, JSON.stringify([...next]));
      } catch {
        // quota or privacy mode — silent, preference will reset next session
      }
      return next;
    });
  };

  const resetDims = () => {
    setHiddenDims(new Set());
    try {
      localStorage.removeItem(HIDDEN_DIMS_KEY);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.venues.length === 0) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          比べるには候補が必要です
        </p>
        <Link
          href="/explore"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200"
        >
          式場を見てみる
        </Link>
      </div>
    );
  }

  if (data.venues.length === 1) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          もう1件候補に入れると、比べられます
        </p>
        <Link
          href="/explore"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200"
        >
          他の式場も見てみる
        </Link>
      </div>
    );
  }

  const { venues, dimensions: allDimensions, winners } = data;
  const dimensions = allDimensions.filter((d) => !hiddenDims.has(d.id));
  const hiddenCount = allDimensions.length - dimensions.length;

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.9, ease: LUXURY_EASE }}
      className="space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            並べて、見比べる
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-[19px] font-extralight tracking-[0.01em] text-foreground">
            決定マトリクス
          </h3>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            {hiddenCount > 0
              ? `${allDimensions.length - hiddenCount} / ${allDimensions.length} 観点を表示中`
              : "ゴールドの背景が、各観点の 1 位です"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          aria-expanded={filterOpen}
          aria-label="表示する観点を絞る"
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition active:scale-[0.98]",
            hiddenCount > 0 || filterOpen
              ? "bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
              : "bg-background/60 text-foreground",
          )}
          style={{
            borderColor:
              hiddenCount > 0 || filterOpen
                ? "color-mix(in oklab, var(--gold-warm) 55%, transparent)"
                : "var(--border)",
          }}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.6} />
          <span>絞る</span>
          {hiddenCount > 0 && (
            <span className="tabular-nums">
              ·{dimensions.length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {filterOpen && (
          <motion.div
            key="filter-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl border border-border/70 bg-card/70 p-4 backdrop-blur-sm"
              role="group"
              aria-label="表示する観点"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  表示する観点
                </p>
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={resetDims}
                    className="text-[11.5px] text-muted-foreground underline-offset-4 hover:underline"
                  >
                    すべて表示に戻す
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {allDimensions.map((dim) => {
                  const isActive = !hiddenDims.has(dim.id);
                  return (
                    <button
                      key={dim.id}
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      onClick={() => toggleDim(dim.id)}
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition active:scale-[0.98]",
                        isActive
                          ? "bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
                          : "bg-background text-muted-foreground line-through decoration-1",
                      )}
                      style={{
                        borderColor: isActive
                          ? "color-mix(in oklab, var(--gold-warm) 40%, transparent)"
                          : "var(--border)",
                      }}
                    >
                      {isActive ? (
                        <Check className="h-3 w-3" strokeWidth={2} />
                      ) : (
                        <X className="h-3 w-3" strokeWidth={2} />
                      )}
                      <span>{dim.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground/80">
                選択はこの端末のみ記憶されます。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable table with right-edge fade to signal horizontal scroll.
          Note: The "別の式場を検討する / 決め直す" affordance for post-decision
          state belongs in candidates-view.tsx (where the decision screen is
          rendered at ~line 307-324), not in this matrix component. */}
      <div className="relative">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-3 text-left text-xs font-medium text-muted-foreground w-[100px]">
                項目
              </th>
              {venues.map((v) => (
                <th key={v.id} className="px-2 py-3 text-center min-w-[110px]">
                  <div className="flex flex-col items-center gap-1.5">
                    {v.photoUrl ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-full">
                        <Image src={v.photoUrl} alt="" fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted" />
                    )}
                    <Link
                      href={`/venues/${v.id}`}
                      prefetch={true}
                      className="block text-xs font-medium font-serif leading-tight truncate max-w-[100px] hover:underline"
                    >
                      {v.name}
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Total score row */}
            <tr>
              <td className="sticky left-0 z-10 bg-card px-3 py-3 text-xs font-medium">
                総合
              </td>
              {venues.map((v) => {
                const isWinner = winners.total === v.id;
                return (
                  <td
                    key={v.id}
                    aria-label={isWinner ? "総合 1 位" : undefined}
                    className={cn(
                      "relative px-2 py-3 text-center text-sm tabular-nums transition-colors",
                      scoreBackground(v.totalScore, isWinner),
                      scoreColor(v.totalScore, isWinner),
                      isWinner &&
                        "before:absolute before:left-2 before:right-2 before:top-0 before:h-[2px] before:bg-[var(--gold-warm)] before:content-['']",
                    )}
                  >
                    {v.totalScore !== null ? v.totalScore.toFixed(1) : "—"}
                  </td>
                );
              })}
            </tr>
            {/* Dimension rows */}
            {dimensions.map((dim) => (
              <tr key={dim.id}>
                <td className="sticky left-0 z-10 bg-card px-3 py-3 text-xs text-muted-foreground">
                  {dim.label}
                </td>
                {venues.map((v) => {
                  const score = v.scoresByDimension[dim.id];
                  const isWinner = winners[dim.id] === v.id;
                  return (
                    <td
                      key={v.id}
                      aria-label={isWinner ? `${dim.label} 1 位` : undefined}
                      className={cn(
                        "relative px-2 py-3 text-center text-sm tabular-nums transition-colors",
                        scoreBackground(score, isWinner),
                        scoreColor(score, isWinner),
                      )}
                    >
                      {isWinner && (
                        <span
                          aria-hidden="true"
                          className="absolute right-1.5 top-1.5 block h-1.5 w-1.5 rounded-full bg-[var(--gold-warm)]"
                        />
                      )}
                      {score !== null ? score.toFixed(1) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Cost row */}
            <tr>
              <td className="sticky left-0 z-10 bg-card px-3 py-3 text-xs text-muted-foreground">
                費用
              </td>
              {venues.map((v) => {
                const cost = v.latestEstimateTotal ?? v.costMax ?? v.costMin;
                const isWinner = winners.cost_value === v.id;
                return (
                  <td
                    key={v.id}
                    className={cn(
                      "relative px-2 py-3 text-center text-sm tabular-nums transition-colors",
                      isWinner &&
                        "bg-[color-mix(in_oklab,var(--gold-warm)_10%,transparent)] text-[var(--gold-warm)] font-medium before:absolute before:left-2 before:right-2 before:top-0 before:h-[2px] before:bg-[var(--gold-warm)] before:content-['']",
                    )}
                    aria-label={isWinner ? `${formatYen(cost)} 費用 1 位` : undefined}
                  >
                    {formatYen(cost)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        </div>
        {/* Right-edge fade to hint horizontal scroll */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-background to-transparent"
        />
      </div>

      {/* Winners summary — "観点ごとのベスト" */}
      <div
        className="relative overflow-hidden rounded-2xl p-5"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 10%, var(--background)) 0%, color-mix(in oklab, var(--primary) 5%, var(--background)) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
        }}
      >
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]">
          観点ごとのベスト
        </p>

        {winners.total && (
          <div
            className="mt-3 rounded-xl border border-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)] bg-background/60 p-3"
          >
            <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">総合</p>
            <p className="mt-0.5 font-[family-name:var(--font-display)] text-[17px] font-light text-foreground">
              ◎ {venues.find((v) => v.id === winners.total)?.name}
            </p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-y-2.5 gap-x-4">
          {dimensions.map((dim) => {
            const winnerId = winners[dim.id];
            const winnerName = venues.find((v) => v.id === winnerId)?.name;
            if (!winnerName) return null;
            return (
              <div key={dim.id} className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {dim.label}
                </span>
                <span className="font-[family-name:var(--font-display)] text-[13.5px] font-light text-foreground truncate">
                  {winnerName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
