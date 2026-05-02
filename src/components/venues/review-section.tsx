"use client";

import { useState, useMemo, useTransition } from "react";
import { analyzeVenueReviews, batchAnalyzeVenueReviews } from "@/server/actions/reviews";
import { AIInsightCard } from "@/components/ai/insight-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, RefreshCw, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReviewSource } from "@/generated/prisma/client";
import { ReviewEstimateEditSheet } from "@/components/venues/review-estimate-edit-sheet";
import { BatchReviewImportSheet } from "@/components/venues/batch-review-import-sheet";

interface EstimateIncrease {
  initial?: number;
  final?: number;
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
  { value: "wedding_park", label: "ウェディングパーク" },
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

type SortMode = "latest" | "highest" | "concerns";

const SORT_CHIPS: { value: SortMode; label: string }[] = [
  { value: "latest", label: "最新" },
  { value: "highest", label: "評価高い" },
  { value: "concerns", label: "気になる点から" },
];

/** Classify a review: negative = isNegative flag, positive = rating>=4, neutral = else */
function classifyReview(review: Review): "positive" | "negative" | "neutral" {
  if (review.isNegative) return "negative";
  if (review.rating !== null && review.rating >= 4) return "positive";
  return "neutral";
}

/** Compact horizontal ratio bar showing positive / neutral / negative distribution. */
function ReviewRatioBar({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;
  const positiveCount = reviews.filter((r) => classifyReview(r) === "positive").length;
  const negativeCount = reviews.filter((r) => classifyReview(r) === "negative").length;
  const neutralCount = reviews.length - positiveCount - negativeCount;
  const total = reviews.length;
  const positivePct = (positiveCount / total) * 100;
  const negativePct = (negativeCount / total) * 100;
  const neutralPct = (neutralCount / total) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {positivePct > 0 && (
          <div
            style={{ width: `${positivePct}%` }}
            className="bg-[color:var(--gold-warm)] transition-all duration-300"
          />
        )}
        {neutralPct > 0 && (
          <div
            style={{ width: `${neutralPct}%` }}
            className="bg-muted-foreground/30 transition-all duration-300"
          />
        )}
        {negativePct > 0 && (
          <div
            style={{ width: `${negativePct}%` }}
            className="bg-destructive transition-all duration-300"
          />
        )}
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        ポジ {positiveCount} · ネガ {negativeCount} · その他 {neutralCount}
      </p>
    </div>
  );
}

export function ReviewSection({ venueId, reviews, venueEstimateAggregate }: ReviewSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<ReviewSource>("zexy");
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshing] = useTransition();
  const router = useRouter();

  const sortedReviews = useMemo(() => {
    const filtered = reviews.filter(r => r.aiSummary);
    if (sortMode === "concerns") {
      return [...filtered].sort((a, b) => {
        if (a.isNegative && !b.isNegative) return -1;
        if (!a.isNegative && b.isNegative) return 1;
        return 0;
      });
    }
    if (sortMode === "highest") {
      return [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    // "latest" — keep original order (server returns newest first)
    return filtered;
  }, [reviews, sortMode]);

  const handleRefreshAll = () => {
    startRefreshing(async () => {
      const result = await batchAnalyzeVenueReviews(venueId, { force: true });
      const { succeeded, skipped, failed } = result;
      if (succeeded > 0 && failed.length === 0) {
        toast.success(`${succeeded} 件の要約を再生成しました`);
      } else if (succeeded > 0 && failed.length > 0) {
        toast.success(`${succeeded} 件を再生成、${failed.length} 件はまたの機会に`);
      } else if (skipped > 0 && succeeded === 0 && failed.length === 0) {
        toast.info("再生成できる口コミがありませんでした");
      } else {
        toast.error("要約の再生成がうまくいきませんでした");
      }
      router.refresh();
    });
  };

  const handleAnalyze = () => {
    if (!url.trim()) return;
    startTransition(async () => {
      const result = await analyzeVenueReviews(venueId, url, source);
      if (result.ok) {
        toast.success("口コミをまとめました");
        setUrl("");
        setShowForm(false);
        router.refresh();
      } else if (result.reason === "timeout") {
        toast.error("時間切れになりました。もう一度お試しください");
      } else if (result.reason === "no-reviews") {
        toast.info("このページでは口コミが見つかりませんでした");
      } else {
        toast.error(result.message ?? "まとめられませんでした");
      }
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
            Reviews
          </p>
          <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-[15px] font-light tracking-[-0.005em]">
            先輩カップルの声
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reviews.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="gap-1 text-muted-foreground"
              aria-label="既に保存されている口コミを AI に渡し、まとめだけを書き直します"
              title="既に保存されている口コミを AI に渡し、まとめだけを書き直します（新しい口コミは取り込みません）"
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "再生成中…" : "AI 要約を再生成"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm(!showForm)}
            className="gap-1"
            aria-label="別のサイト（ゼクシィ・ハナユメ等）の口コミ URL をこの式場に追加します"
            title="別のサイト（ゼクシィ・ハナユメ等）の口コミ URL をこの式場に追加します（既存のまとめは残ります）"
          >
            <Plus className="h-4 w-4" />
            別サイトの口コミを追加
          </Button>
          {/* R1 — 複数 URL を一度に取り込む sheet trigger。単 URL form の
              横にもう 1 つ secondary button を置くだけで wired (sheet 自体
              は内部 state)。mwed 大量取り込みが主用途。 */}
          <BatchReviewImportSheet venueId={venueId} />
        </div>
      </div>

      {/* Ratio bar — compact overview of positive/neutral/negative mix */}
      <ReviewRatioBar reviews={reviews} />

      {/* Sort chips — shown only when there are reviews */}
      {reviews.length > 0 && (
        <div className="flex gap-2" role="group" aria-label="口コミの並び順">
          {SORT_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setSortMode(chip.value)}
              aria-pressed={sortMode === chip.value}
              className={cn(
                "h-9 rounded-full border px-4 text-xs transition-all duration-200 active:scale-[0.98]",
                sortMode === chip.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <label htmlFor="review-source" className="text-sm font-medium">口コミサイト</label>
            <select
              id="review-source"
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
            <label htmlFor="review-url" className="text-sm font-medium">口コミページのURL</label>
            <Input
              id="review-url"
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
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ boxShadow: "0 0 0 0.5px var(--gold-subtle)" }}
          >
            <MessageCircle className="h-6 w-6 text-[var(--gold-warm)]" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-light">先輩カップルの声はこれから</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ゼクシィやハナユメの口コミページの URL を貼ると、
              <br />
              AI がふたり向けに要点をまとめます
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 active:scale-[0.98]"
          >
            口コミの URL を貼る
          </button>
        </div>
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
            body={review.aiSummary ?? ""}
            actions={[{ label: "口コミ元を読む", href: review.sourceUrl }]}
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
            <ReviewEstimateEditSheet
              reviewId={review.id}
              initial={{
                initialYen: ei?.initial,
                finalYen: ei?.final,
                note: ei?.note,
              }}
            />
          </div>

          {/* Category summary chips. The DB column is JSON (unknown
              shape); older AI runs occasionally wrote nested objects in
              place of the flat `{ key: string }` the type claims. We
              silently skip non-string values instead of stringifying
              them — a raw JSON dump like `individual {"title":…}` is
              worse than showing nothing. */}
          {review.categorySummary &&
            Object.keys(review.categorySummary).length > 0 &&
            (() => {
              const rows = Object.entries(review.categorySummary)
                .map(([key, summary]) => {
                  if (typeof summary !== "string") return null;
                  const text = summary.trim();
                  if (!text) return null;
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          key === "negative_points" || key === "estimate_increase"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {CATEGORY_LABELS[key] ?? key}
                      </span>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {text}
                      </p>
                    </div>
                  );
                })
                .filter((el): el is NonNullable<typeof el> => el !== null);
              if (rows.length === 0) return null;
              return (
                <div className="space-y-2 rounded-xl bg-muted/30 p-3">{rows}</div>
              );
            })()}
        </div>
        );
      })}
    </section>
  );
}
