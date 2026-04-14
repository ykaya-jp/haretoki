"use client";

// TODO: this component is orphaned as of P1-C; candidates-view uses
// matrix/focus/weights directly. Kept around in case the side-by-side
// 2-venue board is brought back, but the import in candidates-view.tsx is
// currently unused. Remove (or re-wire) before next major refactor.

import { useState, useEffect } from "react";
import Image from "next/image";
import { getComparisonData } from "@/server/actions/comparison";
import { CircularProgressScore } from "@/components/comparison/circular-score";
import { DimensionBar } from "@/components/comparison/dimension-bar";
import { AIInsightCard } from "@/components/ai/insight-card";
import { TIER1_DIMENSIONS } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChecklistComparison } from "@/components/comparison/checklist-comparison";

interface ComparisonBoardProps {
  venueOptions: Array<{ id: string; name: string }>;
  onDecide?: (venueId: string) => void;
}

export function ComparisonBoard({ venueOptions, onDecide }: ComparisonBoardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    venueOptions.slice(0, 2).map((v) => v.id)
  );
  const [data, setData] = useState<Awaited<ReturnType<typeof getComparisonData>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [diffOnly, setDiffOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (selectedIds.length < 2) {
      Promise.resolve().then(() => {
        if (!cancelled) setData(null);
      });
      return () => { cancelled = true; };
    }
    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    getComparisonData(selectedIds)
      .then((result) => { if (!cancelled) setData(result); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedIds]);

  const handleSelect = (index: number, venueId: string) => {
    const next = [...selectedIds];
    next[index] = venueId;
    setSelectedIds(next);
  };

  if (venueOptions.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        比較するには2件以上の式場を候補に追加してください
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Venue selectors */}
      <div className="flex items-center gap-3">
        {[0, 1].map((idx) => (
          <select
            key={idx}
            value={selectedIds[idx] ?? ""}
            onChange={(e) => handleSelect(idx, e.target.value)}
            className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            {venueOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && !loading && (
        <>
          {/* Quick Look */}
          <div className="grid grid-cols-2 gap-5">
            {data.venues.map((venue) => (
              <div key={venue.id} className="flex flex-col items-center gap-3 rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
                {venue.photoUrls[0] ? (
                  <Image src={venue.photoUrls[0]} alt={venue.name} width={64} height={64} className="rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">写真</div>
                )}
                <CircularProgressScore score={venue.totalScore} size={64} />
                <p className="text-center font-serif text-sm font-medium">{venue.name}</p>
                <div className="flex flex-wrap justify-center gap-1">
                  {venue.topStrengths.map((s) => (
                    <span key={s} className="text-xs text-muted-foreground">{s}◎</span>
                  ))}
                </div>
                {venue.latestEstimate && (
                  <span className="tabular-nums text-sm text-[var(--gold-warm)]">
                    &yen;{(venue.latestEstimate.total / 10000).toFixed(0)}万
                  </span>
                )}
                {onDecide && (
                  <Button
                    variant="outline"
                    onClick={() => onDecide(venue.id)}
                    className="mt-2 w-full"
                  >
                    この式場に決める
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Score bars */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-sm font-light tracking-wide">カテゴリ別スコア</h3>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-xs text-muted-foreground">
                差分のみ表示
                <input
                  type="checkbox"
                  checked={diffOnly}
                  onChange={(e) => setDiffOnly(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
              </label>
            </div>
            {TIER1_DIMENSIONS.map((dim) => {
              const scores = data.venues.map((v) => ({
                venueId: v.id,
                venueName: v.name,
                score: v.scores.find((s) => s.dimension === dim)?.score ?? 0,
              }));
              const maxDiff = Math.max(...scores.map((s) => s.score)) - Math.min(...scores.map((s) => s.score));
              if (diffOnly && maxDiff < 0.5) return null;
              return <DimensionBar key={dim} dimension={dim} scores={scores} />;
            })}
          </div>

          {/* AI Insight */}
          {data.insight.text && (
            <AIInsightCard
              type="comparison"
              title="比較分析"
              body={`${data.insight.text} ${data.insight.recommendations.join(" ")}`}
              actions={[{ label: "コーチに詳しく聞く", href: "/coach" }]}
            />
          )}

          {/* Checklist comparison */}
          <ChecklistComparison
            venueIds={data.venues.map(v => v.id)}
            venueNames={data.venues.map(v => v.name)}
          />
        </>
      )}
    </div>
  );
}
