"use client";

import { useState, useMemo, useTransition } from "react";
import { analyzeVenueReviews } from "@/server/actions/reviews";
import { AIInsightCard } from "@/components/ai/insight-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReviewSource } from "@/generated/prisma/client";

interface EstimateIncrease {
  deltaYen?: number;
  deltaPct?: number;
  confidence?: "high" | "medium" | "low";
  note?: string;
}

interface Review {
  id: string;
  source: string;
  sourceUrl: string;
  aiSummary: string | null;
  sentiment: Record<string, number> | null;
  rating: number | null;
  categorySummary: Record<string, string> | null;
  isNegative: boolean;
  estimateIncrease?: EstimateIncrease | null;
}

interface VenueEstimateAggregate {
  deltaYen: number | null;
  deltaPct: number | null;
  sampleCount: number | null;
}

interface ReviewSectionProps {
  venueId: string;
  reviews: Review[];
  venueEstimateAggregate?: VenueEstimateAggregate | null;
}

function formatDeltaYenMan(yen: number): string {
  const man = yen / 10000;
  const sign = yen >= 0 ? "+" : "−";
  // Round to 1 decimal if < 10万, else integer
  const abs = Math.abs(man);
  const body = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  return `${sign}¥${body}万`;
}

function formatDeltaPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pct).toFixed(0)}%`;
}

const SOURCE_OPTIONS: { value: ReviewSource; label: string }[] = [
  { value: "zexy", label: "ゼクシィ" },
  { value: "wedding_park", label: "Wedding Park" },
  { value: "hanayume", label: "ハナユメ" },
  { value: "mynavi", label: "マイナビ" },
  { value: "minna_no_wedding", label: "みんなのウェディング" },
];

const CATEGORY_LABELS: Record<string, string> = {
  service: "接客",
  cuisine: "料理",
  estimate_increase: "追加費用の傾向",
  negative_points: "気になる点",
};

export function ReviewSection({ venueId, reviews, venueEstimateAggregate }: ReviewSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [showNegativeFirst, setShowNegativeFirst] = useState(false);
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<ReviewSource>("zexy");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const sortedReviews = useMemo(() => {
    const filtered = reviews.filter(r => r.aiSummary);
    if (showNegativeFirst) {
      return [...filtered].sort((a, b) => {
        if (a.isNegative && !b.isNegative) return -1;
        if (!a.isNegative && b.isNegative) return 1;
        return 0;
      });
    }
    return filtered;
  }, [reviews, showNegativeFirst]);

  const handleAnalyze = () => {
    if (!url.trim()) return;
    startTransition(async () => {
      const result = await analyzeVenueReviews(venueId, url, source);
      if (result.success) {
        toast.success("口コミをまとめました");
        setUrl("");
        setShowForm(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "まとめられませんでした");
      }
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base">口コミのまとめ</h2>
        <div className="flex items-center gap-2">
          {reviews.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNegativeFirst(!showNegativeFirst)}
              className={cn(
                "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all duration-200 active:scale-[0.98]",
                showNegativeFirst
                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              気になる点を先に
            </button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm(!showForm)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            追加
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">口コミサイト</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as ReviewSource)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">口コミページのURL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>
          <Button onClick={handleAnalyze} disabled={isPending || !url.trim()}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            AIにまとめてもらう
          </Button>
        </div>
      )}

      {reviews.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">
          口コミページのURLを追加すると、AIが要点をまとめます
        </p>
      )}

      {/* Venue-level aggregate estimate-increase badge (avg across reviews) */}
      {venueEstimateAggregate &&
        (venueEstimateAggregate.sampleCount ?? 0) > 0 &&
        (venueEstimateAggregate.deltaYen != null || venueEstimateAggregate.deltaPct != null) && (
          <div className="flex items-center gap-1.5 text-xs tabular-nums text-[var(--gold-warm)]">
            <span className="font-medium">見積もり上昇</span>
            <span>
              平均{" "}
              {venueEstimateAggregate.deltaYen != null
                ? formatDeltaYenMan(venueEstimateAggregate.deltaYen)
                : ""}
              {venueEstimateAggregate.deltaYen != null && venueEstimateAggregate.deltaPct != null
                ? " / "
                : ""}
              {venueEstimateAggregate.deltaPct != null
                ? formatDeltaPct(venueEstimateAggregate.deltaPct)
                : ""}
              （n={venueEstimateAggregate.sampleCount}）
            </span>
          </div>
        )}

      {sortedReviews.map((review) => {
        const hasAggregate =
          venueEstimateAggregate && (venueEstimateAggregate.sampleCount ?? 0) > 0;
        const ei = review.estimateIncrease;
        const showPerReviewBadge =
          !hasAggregate &&
          ei != null &&
          (ei.deltaYen != null || ei.deltaPct != null);
        return (
        <div key={review.id} className="space-y-3">
          <AIInsightCard
            type="comparison"
            title={`${SOURCE_OPTIONS.find(s => s.value === review.source)?.label ?? review.source} のまとめ`}
            body={review.aiSummary!}
            actions={[{ label: "口コミ元を読む", href: review.sourceUrl }]}
          />

          {showPerReviewBadge && (
            <div className="flex items-center gap-1.5 text-xs tabular-nums text-[var(--gold-warm)]">
              <span className="font-medium">見積もり上昇</span>
              <span>
                {ei!.deltaYen != null ? formatDeltaYenMan(ei!.deltaYen) : ""}
                {ei!.deltaYen != null && ei!.deltaPct != null ? " / " : ""}
                {ei!.deltaPct != null ? formatDeltaPct(ei!.deltaPct) : ""}
              </span>
            </div>
          )}

          {/* Category summary chips */}
          {review.categorySummary && Object.keys(review.categorySummary).length > 0 && (
            <div className="space-y-2 rounded-xl bg-muted/30 p-3">
              {Object.entries(review.categorySummary).map(([key, summary]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    key === "negative_points" || key === "estimate_increase"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {CATEGORY_LABELS[key] ?? key}
                  </span>
                  <p className="text-xs leading-relaxed text-muted-foreground">{summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })}
    </section>
  );
}
