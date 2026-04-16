"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getUnifiedComparisonData,
  type UnifiedComparisonData,
} from "@/server/actions/unified-comparison";
import { getMatrixInsight, type MatrixInsight } from "@/server/actions/matrix-insight";
import { DimensionRow } from "./dimension-row";
import { AIInsightCard } from "@/components/ai/insight-card";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

export function AccordionZoom() {
  const [data, setData] = useState<UnifiedComparisonData | null>(null);
  const [insight, setInsight] = useState<MatrixInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffOnly, setDiffOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [compData, insightData] = await Promise.all([
          getUnifiedComparisonData(),
          getMatrixInsight(),
        ]);
        if (!cancelled) {
          setData(compData);
          setInsight(insightData);
        }
      } catch {
        // silently fail — empty state handles this
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.venues.length < 2) {
    const hasVenuesButNoFavorites = data && data.venues.length < 2;
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center px-6">
        <p className="text-body text-muted-foreground">
          {hasVenuesButNoFavorites
            ? "式場カードの ♡ をタップして候補に追加すると、ここで並べて比べられます。"
            : "比較するには式場を 2 件以上追加してください。"}
        </p>
        <Link
          href="/explore"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground active:scale-[0.98]"
        >
          式場を探す
        </Link>
      </div>
    );
  }

  const venueIds = data.venues.map((v) => v.id);
  const colCount = venueIds.length;
  const gridTemplate = `100px repeat(${colCount}, 1fr)`;

  return (
    <div className="flex flex-col gap-3 pb-6">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 pt-1">
        <button
          type="button"
          onClick={() => setDiffOnly((v) => !v)}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-medium min-h-8",
            "border transition-[background-color,color,border-color] duration-200",
            "active:scale-[0.97]",
            diffOnly
              ? "bg-[var(--gold-warm)] text-white border-[var(--gold-warm)]"
              : "bg-transparent text-muted-foreground border-border",
          ].join(" ")}
        >
          差分のみ
        </button>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card mx-3">
        {/* Sticky venue headers */}
        <div
          className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border"
        >
          <div
            className="grid items-center gap-2 px-3 py-2"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {/* Empty label column */}
            <div />
            {data.venues.map((venue) => (
              <Link
                key={venue.id}
                href={`/venues/${venue.id}`}
                className="flex flex-col items-center gap-1 min-w-0"
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border">
                  {venue.photoUrl ? (
                    <Image
                      src={venue.photoUrl}
                      alt={venue.name}
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
                <p
                  className="text-[10px] font-[family-name:var(--font-noto-serif-jp)] text-foreground/80 leading-tight text-center truncate w-full"
                  title={venue.name}
                >
                  {venue.name}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Total score row */}
        <div className="bg-[rgba(201,168,76,0.06)] border-b border-border">
          <div
            className="grid items-center gap-2 px-3 py-2 min-h-11"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span className="text-[11px] font-medium text-foreground/80">総合</span>
            {venueIds.map((venueId) => {
              const score = data.totalScore[venueId] ?? null;
              return (
                <div
                  key={venueId}
                  className="flex items-center justify-center"
                >
                  {score !== null ? (
                    <span className="font-[family-name:var(--font-geist)] tabular-nums text-sm font-medium text-[var(--gold-warm)]">
                      {score.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-sm">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dimension rows */}
        {data.dimensions.map((dimension, i) => (
          <DimensionRow
            key={dimension.id}
            dimension={dimension}
            venueIds={venueIds}
            diffOnly={diffOnly}
            defaultExpanded={i === 0}
            isWinner={
              dimension.winnerId !== null &&
              venueIds.includes(dimension.winnerId)
            }
          />
        ))}

        {/* その他 row for unmapped items */}
        {data.unmappedItems.length > 0 && (
          <DimensionRow
            key="unmapped"
            dimension={{
              id: "unmapped",
              label: "その他",
              scores: Object.fromEntries(venueIds.map((id) => [id, null])),
              winnerId: null,
              checklistItems: data.unmappedItems,
              totalItems: data.unmappedItems.length,
              answeredItems: data.unmappedItems.filter((item) =>
                venueIds.some((vid) => item.answers[vid]?.status !== null),
              ).length,
            }}
            venueIds={venueIds}
            diffOnly={diffOnly}
            defaultExpanded={false}
            isWinner={false}
          />
        )}
      </div>

      {/* AI Insight card */}
      <AnimatePresence>
        {insight && (
          <motion.div
            key="insight"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: LUXURY_EASE, delay: 0.3 }}
            className="mx-3"
          >
            <AIInsightCard
              type="comparison"
              title="AIコーチからのひとこと"
              body={insight.summary}
              actions={insight.nextActions.map((action) => ({
                label: action,
                href: "/coach",
              }))}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
