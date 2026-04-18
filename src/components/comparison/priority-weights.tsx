"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Trophy, Medal } from "lucide-react";
import { getMatrixData, type MatrixData } from "@/server/actions/matrix";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

interface WeightedVenue {
  id: string;
  name: string;
  photoUrl: string | null;
  weightedScore: number;
  rawTotal: number | null;
}

export function PriorityWeights({ onDecide }: { onDecide?: (venueId: string) => void }) {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    getMatrixData().then((d) => {
      setData(d);
      // Initialize weights at 50%
      const initial: Record<string, number> = {};
      for (const dim of d.dimensions) {
        initial[dim.id] = 50;
      }
      setWeights(initial);
    }).finally(() => setLoading(false));
  }, []);

  const ranked = useMemo<WeightedVenue[]>(() => {
    if (!data) return [];
    return data.venues
      .map((v) => {
        let totalWeighted = 0;
        let totalWeight = 0;
        for (const dim of data.dimensions) {
          const score = v.scoresByDimension[dim.id];
          const weight = weights[dim.id] ?? 0;
          if (score !== null && weight > 0) {
            totalWeighted += score * weight;
            totalWeight += weight;
          }
        }
        const weightedScore = totalWeight > 0 ? (totalWeighted / totalWeight) : 0;
        return {
          id: v.id,
          name: v.name,
          photoUrl: v.photoUrl,
          weightedScore,
          rawTotal: v.totalScore,
        };
      })
      .sort((a, b) => b.weightedScore - a.weightedScore);
  }, [data, weights]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.venues.length < 2) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          重み付けには候補が2件以上必要です
        </p>
        <Link
          href="/explore"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          式場を見てみる
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.9, ease: LUXURY_EASE }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-light tracking-wide">
          あなたにとって、何が大事？
        </h3>
        <p className="text-xs text-muted-foreground">
          優先度を動かすと、順位がリアルタイムで変わります。
        </p>
      </div>

      {/* Weight sliders */}
      <div className="space-y-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        {data.dimensions.map((dim) => (
          <div key={dim.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm">{dim.label}</label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {weights[dim.id] ?? 0}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={weights[dim.id] ?? 0}
              onChange={(e) =>
                setWeights((w) => ({ ...w, [dim.id]: parseInt(e.target.value) }))
              }
              className="w-full accent-primary"
            />
          </div>
        ))}
      </div>

      {/* Ranked results */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          この優先度での順位
        </p>
        {ranked.map((v, i) => (
          <motion.div
            key={v.id}
            layout={prefersReduced ? false : true}
            transition={
              prefersReduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 140, damping: 22 }
            }
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4 transition-all duration-200",
              i === 0 ? "border-[var(--gold-warm)] bg-[var(--gold-subtle)]" : "border-border bg-card",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-sm font-medium tabular-nums">
              {i === 0 ? (
                <Medal className="h-4 w-4 text-[var(--gold-warm)]" aria-label="1位" />
              ) : i === 1 ? (
                <Medal className="h-4 w-4 text-muted-foreground" aria-label="2位" />
              ) : i === 2 ? (
                <Medal className="h-4 w-4 text-tone-gold" aria-label="3位" />
              ) : (
                i + 1
              )}
            </div>
            {v.photoUrl && (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                <Image src={v.photoUrl} alt="" fill sizes="48px" className="object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-[family-name:var(--font-display)] text-sm font-light tracking-[-0.005em] truncate">{v.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                重み付きスコア {v.weightedScore.toFixed(2)}
              </p>
            </div>
            {i === 0 && onDecide && (
              <button
                type="button"
                onClick={() => onDecide(v.id)}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-all duration-200 active:scale-95"
              >
                <Trophy className="h-4 w-4" />
                決める
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
