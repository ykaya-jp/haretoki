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

interface Review {
  id: string;
  source: string;
  sourceUrl: string;
  aiSummary: string | null;
  sentiment: Record<string, number> | null;
  rating: number | null;
  categorySummary: Record<string, string> | null;
  isNegative: boolean;
}

interface ReviewSectionProps {
  venueId: string;
  reviews: Review[];
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
  estimate_increase: "見積もり上昇",
  negative_points: "ネガティブポイント",
};

export function ReviewSection({ venueId, reviews }: ReviewSectionProps) {
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
        toast.success("口コミを分析しました");
        setUrl("");
        setShowForm(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "分析に失敗しました");
      }
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base">口コミ分析</h2>
        <div className="flex items-center gap-2">
          {reviews.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNegativeFirst(!showNegativeFirst)}
              className={cn(
                "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors active:scale-[0.98]",
                showNegativeFirst
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              ネガティブ優先
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
            <label className="text-sm font-medium">ソース</label>
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
            AIで分析する
          </Button>
        </div>
      )}

      {reviews.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">
          口コミのURLを追加すると、AIが内容を分析します
        </p>
      )}

      {sortedReviews.map((review) => (
        <div key={review.id} className="space-y-3">
          <AIInsightCard
            type="comparison"
            title={`${SOURCE_OPTIONS.find(s => s.value === review.source)?.label ?? review.source} の分析`}
            body={review.aiSummary!}
            actions={[{ label: "元の口コミを見る", href: review.sourceUrl }]}
          />

          {/* Category summary chips */}
          {review.categorySummary && Object.keys(review.categorySummary).length > 0 && (
            <div className="space-y-2 rounded-xl bg-muted/30 p-3">
              {Object.entries(review.categorySummary).map(([key, summary]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    key === "negative_points" || key === "estimate_increase"
                      ? "bg-red-100 text-red-700"
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
      ))}
    </section>
  );
}
