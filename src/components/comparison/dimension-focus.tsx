"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getMatrixData, type MatrixData } from "@/server/actions/matrix";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

export function DimensionFocus() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDim, setSelectedDim] = useState<string>("atmosphere");

  useEffect(() => {
    getMatrixData().then(setData).finally(() => setLoading(false));
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
          観点別に比べるにはお気に入りが必要です
        </p>
        <Link
          href="/explore"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          式場を見てみる
        </Link>
      </div>
    );
  }

  const { venues, dimensions } = data;

  // Rank venues by selected dimension
  const ranked = [...venues].sort((a, b) => {
    const sa = a.scoresByDimension[selectedDim] ?? -1;
    const sb = b.scoresByDimension[selectedDim] ?? -1;
    return sb - sa;
  });

  const selectedLabel =
    dimensions.find((d) => d.id === selectedDim)?.label ?? "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: LUXURY_EASE }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <h3 className="font-serif text-lg font-light tracking-wide">
          観点で比べる
        </h3>
        <p className="text-xs text-muted-foreground">
          ひとつの観点にしぼって、全ての候補を並べます。
        </p>
      </div>

      {/* Dimension selector */}
      <div className="flex flex-wrap gap-2">
        {dimensions.map((dim) => (
          <button
            key={dim.id}
            type="button"
            onClick={() => setSelectedDim(dim.id)}
            className={cn(
              "min-h-[44px] rounded-full border px-5 text-sm transition-all duration-200",
              selectedDim === dim.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground active:scale-95",
            )}
          >
            {dim.label}
          </button>
        ))}
      </div>

      {/* Ranked list for selected dimension */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDim}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.6, ease: LUXURY_EASE }}
          className="space-y-3"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {selectedLabel}の順位
          </p>
          {ranked.map((v, i) => {
            const score = v.scoresByDimension[selectedDim];
            const isTop = i === 0 && score !== null;
            return (
              <motion.div
                key={v.id}
                layout
                transition={{ type: "spring", stiffness: 140, damping: 22 }}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4 transition-all duration-200",
                  isTop
                    ? "border-[var(--gold-warm)] bg-[var(--gold-subtle)]"
                    : "border-border bg-card",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-lg">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </div>
                {v.photoUrl ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <Image src={v.photoUrl} alt="" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/venues/${v.id}`}
                    className="block font-serif text-base font-medium truncate hover:underline"
                  >
                    {v.name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {score !== null
                      ? `${selectedLabel}: ${score.toFixed(1)} / 5.0`
                      : "まだ評価がありません"}
                  </p>
                </div>
                <div
                  className={cn(
                    "text-2xl font-light tabular-nums",
                    isTop
                      ? "text-[var(--gold-warm)]"
                      : score === null
                        ? "text-muted-foreground/40"
                        : "text-foreground",
                  )}
                >
                  {score !== null ? score.toFixed(1) : "—"}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
