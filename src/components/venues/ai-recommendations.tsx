"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getOnboardingRecommendations } from "@/server/actions/onboarding";
import { createVenue } from "@/server/actions/venues";
import { Sparkles, Plus, Loader2, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Recommendation {
  name: string;
  location: string;
  reason: string;
  estimatedPrice: number | null;
  ceremonyStyles: string[];
  strengths: string[];
}

export function AIRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const result = await getOnboardingRecommendations();
      if (result) {
        setRecommendations(result.recommendations);
        setAdvice(result.advice);
      }
    } catch {
      // API key not available or error — fail silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 rounded-xl border-l-[3px] border-l-[var(--gold-warm)] bg-[var(--gold-subtle)] p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" />
          <span className="text-xs font-semibold text-[var(--gold-warm)]">AIおすすめ式場</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          あなたの条件に合う式場を探しています...
        </div>
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) return null;

  const handleAdd = (rec: Recommendation) => {
    setAddingId(rec.name);
    startTransition(async () => {
      try {
        const result = await createVenue({
          name: rec.name,
          location: rec.location,
          ceremonyStyles: rec.ceremonyStyles,
        });
        if (result.success) {
          toast.success(`${rec.name}を追加しました`);
          router.refresh();
        }
      } catch {
        toast.error("追加に失敗しました");
      } finally {
        setAddingId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" />
          <span className="text-sm font-medium">AIおすすめ式場</span>
        </div>
        <button
          type="button"
          onClick={fetchRecommendations}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          更新
        </button>
      </div>

      {advice && (
        <p className="text-xs text-muted-foreground">{advice}</p>
      )}

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.name}
            className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <h4 className="font-serif text-sm font-medium tracking-[0.03em]">
                  {rec.name}
                </h4>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {rec.location}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {rec.reason}
                </p>
                {rec.estimatedPrice && (
                  <p className="tabular-nums text-xs text-[var(--gold-warm)]">
                    ¥{(rec.estimatedPrice / 10000).toFixed(0)}万〜
                  </p>
                )}
                {rec.strengths.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rec.strengths.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAdd(rec)}
                disabled={isPending && addingId === rec.name}
                className="shrink-0 gap-1"
              >
                {isPending && addingId === rec.name ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                追加
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
