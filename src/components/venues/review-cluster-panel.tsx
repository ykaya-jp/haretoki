import { ThumbsUp, AlertCircle } from "lucide-react";

interface ClusterTheme {
  theme: string;
  summary: string;
  count?: number;
}

interface ReviewClusterPanelProps {
  positive: ClusterTheme[];
  negative: ClusterTheme[];
  /** Total reviews visible on the source site's headline count, if known.
   *  Used only for the "元の口コミ 〜件" caption so couples understand the
   *  clusters are distilled from a larger corpus, not the 20 individual
   *  review cards below. */
  sourceCount?: number | null;
}

/**
 * Compact two-column summary of what surfaced positively / negatively
 * across the venue's full review corpus. Rendered at the top of the
 * Review section so couples can read "10 good themes + 10 warning themes"
 * without scrolling through 30 individual cards.
 *
 * Hidden when both arrays are empty — clustering either hasn't run or
 * the corpus was too thin to produce a meaningful grouping.
 */
export function ReviewClusterPanel({
  positive,
  negative,
  sourceCount,
}: ReviewClusterPanelProps) {
  if (positive.length === 0 && negative.length === 0) return null;

  return (
    <section
      aria-label="口コミのクラスタまとめ"
      className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card-low)] sm:p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--gold-warm)" }}
        />
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-foreground font-medium">
          先輩カップルが語ったこと
        </p>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {sourceCount != null && sourceCount > 0 && (
        <p className="mb-3 text-[11.5px] text-muted-foreground leading-relaxed">
          元のサイトに並ぶ約 {sourceCount.toLocaleString("ja-JP")} 件の口コミから、
          AI が繰り返し話題に上がっているテーマをまとめました。
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {positive.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <ThumbsUp
                aria-hidden="true"
                className="h-4 w-4 text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]"
                strokeWidth={1.6}
              />
              <h3 className="text-[12px] font-medium text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]">
                よかったところ
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  ({positive.length})
                </span>
              </h3>
            </div>
            <ul className="space-y-2.5">
              {positive.map((c, i) => (
                <li
                  key={i}
                  className="rounded-xl bg-[color-mix(in_oklab,var(--success,#22c55e)_6%,var(--background))] p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-foreground leading-snug">
                      {c.theme}
                    </p>
                    {c.count != null && c.count > 0 && (
                      <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                        約 {c.count} 件
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    {c.summary}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {negative.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <AlertCircle
                aria-hidden="true"
                className="h-4 w-4 text-destructive/80"
                strokeWidth={1.6}
              />
              <h3 className="text-[12px] font-medium text-destructive/80">
                気になるところ
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  ({negative.length})
                </span>
              </h3>
            </div>
            <ul className="space-y-2.5">
              {negative.map((c, i) => (
                <li
                  key={i}
                  className="rounded-xl bg-destructive/[0.04] p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-foreground leading-snug">
                      {c.theme}
                    </p>
                    {c.count != null && c.count > 0 && (
                      <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                        約 {c.count} 件
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    {c.summary}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
