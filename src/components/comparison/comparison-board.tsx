"use client";

import { useState, useEffect } from "react";
import { getComparisonData } from "@/server/actions/comparison";
import { CircularProgressScore } from "@/components/comparison/circular-score";
import { DimensionBar } from "@/components/comparison/dimension-bar";
import { AIInsightCard } from "@/components/ai/insight-card";
import { TIER1_DIMENSIONS } from "@/lib/constants";
import { Loader2 } from "lucide-react";

interface ComparisonBoardProps {
  venueOptions: Array<{ id: string; name: string }>;
}

export function ComparisonBoard({ venueOptions }: ComparisonBoardProps) {
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
    <div className="space-y-6">
      {/* Venue selectors */}
      <div className="flex items-center gap-2">
        {[0, 1].map((idx) => (
          <select
            key={idx}
            value={selectedIds[idx] ?? ""}
            onChange={(e) => handleSelect(idx, e.target.value)}
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
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
          <div className="grid grid-cols-2 gap-4">
            {data.venues.map((venue) => (
              <div key={venue.id} className="flex flex-col items-center gap-2 rounded-lg bg-card p-4 shadow-sm">
                {venue.photoUrls[0] ? (
                  <img src={venue.photoUrls[0]} alt={venue.name} className="aspect-square w-16 rounded-lg object-cover" />
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
                    ¥{(venue.latestEstimate.total / 10000).toFixed(0)}万
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Score bars */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">カテゴリ別スコア</h3>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                差分のみ表示
                <input
                  type="checkbox"
                  checked={diffOnly}
                  onChange={(e) => setDiffOnly(e.target.checked)}
                  className="rounded"
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
        </>
      )}
    </div>
  );
}
