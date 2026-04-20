"use client";

import { useUpdatedHighlight } from "./use-updated-highlight";
import { cn } from "@/lib/utils";

interface VenueCostBreakdownProps {
  /** Flat ceremony fee, in JPY. */
  ceremonyFeeExact: number | null;
  /** Production (演出) fee lower bound, in JPY. */
  productionFeeMin: number | null;
  /** Production (演出) fee upper bound, in JPY. */
  productionFeeMax: number | null;
  /** Service fee rate, 0..1 (e.g. 0.10 for 10%). */
  serviceFeeRate: number | null;
}

function yen(n: number): string {
  if (n >= 10000) {
    // Match the codebase's convention of showing 万 as soon as ≥ 10k.
    const man = n / 10000;
    // Show 1 decimal when useful, 0 otherwise, keep tabular alignment.
    const shown =
      Number.isInteger(man) || man >= 100 ? man.toFixed(0) : man.toFixed(1);
    return `¥${shown}万`;
  }
  return `¥${n.toLocaleString("ja-JP")}`;
}

function productionRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${yen(min)}〜${yen(max)}`;
  return yen(min ?? max!);
}

/**
 * Cost Breakdown — 費用の内訳 rendered below the Estimate section. Shows
 * the raw operator-published fees (挙式料 / 演出料 / サービス料率) as a
 * small tabular block, complementing the user's actual estimate lines.
 *
 * Why separate from EstimateSection:
 *   - EstimateSection is the user's own quote captured from the venue.
 *   - This block is the structured data from the venue's public page
 *     (JSON-LD offers), which is often broader than a single 見積もり
 *     (e.g. production fee range spans 3 plans). Keeping them adjacent
 *     but distinct lets the user calibrate their quote against the
 *     published floor/ceiling.
 */
export function VenueCostBreakdown({
  ceremonyFeeExact,
  productionFeeMin,
  productionFeeMax,
  serviceFeeRate,
}: VenueCostBreakdownProps) {
  const highlight = useUpdatedHighlight();

  const hasCeremony = ceremonyFeeExact != null && ceremonyFeeExact > 0;
  const productionRangeText = productionRange(productionFeeMin, productionFeeMax);
  const hasProduction = productionRangeText != null;
  const hasServiceRate = serviceFeeRate != null && serviceFeeRate > 0;

  if (!hasCeremony && !hasProduction && !hasServiceRate) return null;

  return (
    <section
      aria-label="式場からの基本料金"
      className={cn(
        "space-y-3 rounded-2xl bg-card p-5 shadow-[var(--shadow-card-low)] transition-[box-shadow,outline] duration-500",
        highlight && "ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--gold-warm)" }}
        />
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-foreground font-medium">
          式場からの基本料金
        </p>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      <p className="text-[11.5px] text-muted-foreground leading-relaxed">
        式場が公開している基本料金（見積もりとは別のベース情報）
      </p>

      <dl className="divide-y divide-border/60 text-[13px]">
        {hasCeremony && (
          <div className="flex items-baseline justify-between py-2">
            <dt className="text-muted-foreground">挙式料</dt>
            <dd className="tabular-nums font-medium text-foreground">
              {yen(ceremonyFeeExact!)}
            </dd>
          </div>
        )}
        {hasProduction && (
          <div className="flex items-baseline justify-between py-2">
            <dt className="text-muted-foreground">演出料</dt>
            <dd className="tabular-nums font-medium text-foreground">
              {productionRangeText}
            </dd>
          </div>
        )}
        {hasServiceRate && (
          <div className="flex items-baseline justify-between py-2">
            <dt className="text-muted-foreground">サービス料率</dt>
            <dd className="tabular-nums font-medium text-foreground">
              {(serviceFeeRate! * 100).toFixed(serviceFeeRate! * 100 % 1 === 0 ? 0 : 1)}
              %
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
