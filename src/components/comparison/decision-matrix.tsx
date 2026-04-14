"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Crown } from "lucide-react";
import { getMatrixData, type MatrixData } from "@/server/actions/matrix";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

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

function scoreBackground(score: number | null, isWinner: boolean): string {
  if (isWinner) return "bg-[var(--gold-subtle)]";
  if (score === null) return "bg-transparent";
  if (score >= 4.5) return "bg-green-50/60";
  if (score >= 4.0) return "bg-green-50/30";
  if (score < 3.0) return "bg-red-50/30";
  return "bg-transparent";
}

export function DecisionMatrix() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    getMatrixData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

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

  const { venues, dimensions, winners } = data;

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.9, ease: LUXURY_EASE }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <h3 className="font-serif text-lg font-light tracking-wide">
          決定マトリクス
        </h3>
        <p className="text-xs text-muted-foreground">
          👑 が各観点の1位です。横にスクロールできます。
        </p>
      </div>

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
                    className={cn(
                      "relative px-2 pb-3 pt-5 text-center text-sm tabular-nums transition-colors",
                      scoreBackground(v.totalScore, isWinner),
                      scoreColor(v.totalScore, isWinner),
                    )}
                  >
                    {isWinner && (
                      <Crown
                        className="absolute -top-3 left-1/2 -translate-x-1/2 h-3 w-3 text-[var(--gold-warm)]"
                        aria-label="1位"
                      />
                    )}
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
                      className={cn(
                        "relative px-2 pb-3 pt-5 text-center text-sm tabular-nums transition-colors",
                        scoreBackground(score, isWinner),
                        scoreColor(score, isWinner),
                      )}
                    >
                      {isWinner && (
                        <Crown className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-3 w-3 text-[var(--gold-warm)]" />
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
                      "relative px-2 pb-3 pt-5 text-center text-sm tabular-nums transition-colors",
                      isWinner && "bg-[var(--gold-subtle)] text-[var(--gold-warm)] font-medium",
                    )}
                    aria-label={isWinner ? `${formatYen(cost)} 1位` : undefined}
                  >
                    {isWinner && (
                      <Crown
                        className="absolute -top-3 left-1/2 -translate-x-1/2 h-3 w-3 text-[var(--gold-warm)]"
                        aria-label="1位"
                      />
                    )}
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

      {/* Winners summary */}
      <div className="rounded-2xl bg-[var(--gold-subtle)] p-5 space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--gold-warm)]">
          各観点の1位
        </p>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
          {winners.total && (
            <div className="col-span-2 flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground min-w-[4rem]">総合</span>
              <span className="font-serif font-medium">
                {venues.find((v) => v.id === winners.total)?.name}
              </span>
            </div>
          )}
          {dimensions.map((dim) => {
            const winnerId = winners[dim.id];
            const winnerName = venues.find((v) => v.id === winnerId)?.name;
            if (!winnerName) return null;
            return (
              <div key={dim.id} className="flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground min-w-[4rem]">
                  {dim.label}
                </span>
                <span className="font-serif text-sm truncate">{winnerName}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
