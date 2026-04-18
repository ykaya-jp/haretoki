import { Sparkles } from "lucide-react";

/**
 * E-9 Venue Whisper — 匿名口コミの AI 要約
 *
 * 既存の Review.categorySummary に格納されている
 * positiveHighlights / negativeHighlights から、
 * 「良い点 / 気になる点」を 2 軸で静かに表示。
 */

interface VenueWhisperProps {
  reviews: Array<{
    categorySummary: unknown;
    isNegative: boolean;
  }>;
  reviewEstimateAggregate?: {
    deltaYen: number | null;
    deltaPct: number | null;
    sampleCount: number | null;
  } | null;
}

interface CategorySummary {
  positiveHighlights?: unknown;
  negativeHighlights?: unknown;
  overall?: unknown;
}

function extractStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/** Top N unique strings by frequency, preserving order of first occurrence. */
function topByFrequency(items: string[], n: number): string[] {
  const counts = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  items.forEach((s, idx) => {
    const norm = s.trim();
    counts.set(norm, (counts.get(norm) ?? 0) + 1);
    if (!firstSeen.has(norm)) firstSeen.set(norm, idx);
  });
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0);
    })
    .slice(0, n)
    .map(([s]) => s);
}

export function VenueWhisper({
  reviews,
  reviewEstimateAggregate,
}: VenueWhisperProps) {
  // Aggregate positives / concerns across all analyzed reviews
  const allPositives: string[] = [];
  const allConcerns: string[] = [];
  for (const r of reviews) {
    const cs = (r.categorySummary ?? {}) as CategorySummary;
    allPositives.push(...extractStringArray(cs.positiveHighlights));
    allConcerns.push(...extractStringArray(cs.negativeHighlights));
  }

  const topPositives = topByFrequency(allPositives, 3);
  const topConcerns = topByFrequency(allConcerns, 3);

  const analyzedCount = reviews.filter(
    (r) => r.categorySummary != null,
  ).length;

  if (analyzedCount === 0 || (topPositives.length === 0 && topConcerns.length === 0)) {
    return null;
  }

  return (
    <section
      aria-label="口コミの要約"
      className="relative overflow-hidden rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(42,35,32,0.04),0_4px_12px_rgba(42,35,32,0.05)]"
    >
      <div className="flex items-center gap-2">
        <Sparkles
          aria-hidden="true"
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.6}
        />
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Whisper — {analyzedCount} 件の匿名口コミから
        </p>
      </div>

      {topPositives.length > 0 && (
        <div className="mt-4">
          <p className="text-[11.5px] font-medium text-[var(--gold-warm)]">
            ◯ 印象に残る点
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px] leading-[1.75] text-foreground">
            {topPositives.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--gold-warm)]"
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topConcerns.length > 0 && (
        <div className="mt-4">
          <p className="text-[11.5px] font-medium text-[color:var(--destructive)]/80">
            △ 気になる点
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px] leading-[1.75] text-foreground">
            {topConcerns.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--destructive)]/60"
                />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reviewEstimateAggregate &&
        (reviewEstimateAggregate.sampleCount ?? 0) >= 2 &&
        reviewEstimateAggregate.deltaYen != null && (
          <p className="mt-4 border-t border-dashed border-border pt-3 text-[11.5px] text-muted-foreground leading-relaxed">
            ※ 見積もりが最終的に平均{" "}
            <span className="font-medium text-[var(--gold-warm)]">
              +¥{Math.round(Math.abs(reviewEstimateAggregate.deltaYen) / 10000)}万
            </span>{" "}
            上がっている声もあります（{reviewEstimateAggregate.sampleCount} 件中）。
          </p>
        )}
    </section>
  );
}
