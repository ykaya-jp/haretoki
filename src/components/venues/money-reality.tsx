import { ChevronDown } from "lucide-react";
import type { MoneyRealityReport } from "@/server/actions/money-reality";

/**
 * E-6 Money Reality Check — 3 カード (抜け/上がりやすい/交渉余地) + 口コミ統計
 *
 * Server Component. 静的な detail 要素で収まるので hydration boundary 不要。
 */
export function MoneyReality({ report }: { report: MoneyRealityReport }) {
  const hasMissing = report.missing.length > 0;
  const hasRisks = report.upgradeRisks.length > 0;
  const hasReviewStat =
    report.reviewStats.sampleCount !== null &&
    report.reviewStats.sampleCount >= 2 &&
    report.reviewStats.avgDeltaYen !== null &&
    report.reviewStats.avgDeltaYen > 0;

  if (!hasMissing && !hasRisks && !hasReviewStat) return null;

  return (
    <section aria-label="見積もり Reality Check" className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--gold-warm)" }}
        />
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-foreground font-medium">
          Reality Check
        </p>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* Yellow: 抜けている項目 */}
      {hasMissing && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: "color-mix(in oklab, oklch(0.82 0.12 75) 12%, transparent)",
            borderLeft: "3px solid oklch(0.82 0.12 75)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: "oklch(0.82 0.12 75)" }}
            />
            <h4 className="text-[13.5px] font-medium">抜けている項目</h4>
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
              style={{ background: "rgba(255,255,255,0.5)" }}
            >
              {report.missing.length} 件
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-relaxed">
            このあと見積もりに加わる可能性が高い項目です
          </p>
          <ul className="mt-3 space-y-2">
            {report.missing.slice(0, 5).map((m) => (
              <li
                key={m.key}
                className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2"
              >
                <span className="flex-1 text-[12.5px] font-medium">
                  {m.label}
                </span>
                {m.typicalAmount > 0 && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] tabular-nums text-white"
                    style={{ background: "oklch(0.82 0.12 75)" }}
                  >
                    平均 +¥{Math.round(m.typicalAmount / 10_000)}万
                  </span>
                )}
                {m.typicalAmount === 0 && (
                  <span className="rounded-full bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground border border-border">
                    金額要確認
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Red: 上がりやすい項目 */}
      {hasRisks && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: "color-mix(in oklab, var(--destructive) 8%, transparent)",
            borderLeft: "3px solid var(--destructive)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--destructive)" }}
            />
            <h4 className="text-[13.5px] font-medium">上がりやすい項目</h4>
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
              style={{ background: "rgba(255,255,255,0.5)" }}
            >
              {report.upgradeRisks.length} 件
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-relaxed">
            最終見積もりで増える確率が高い傾向です
          </p>
          <ul className="mt-3 space-y-2">
            {report.upgradeRisks.map((r) => (
              <li
                key={r.key}
                className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2 text-[12.5px]"
              >
                <span className="flex-1">
                  {r.label} —{" "}
                  <strong>{Math.round(r.baseRate * 100)}%</strong> で +¥
                  {Math.round(r.avgDeltaYen / 10_000)}万
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gold: この式場の実績 (口コミ集計) */}
      {hasReviewStat && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--gold-subtle)",
            borderLeft: "3px solid var(--gold-warm)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--gold-warm)" }}
            />
            <h4 className="text-[13.5px] font-medium text-[var(--gold-warm)]">
              この式場の実績
            </h4>
          </div>
          <p
            className="mt-2 font-[family-name:var(--font-display)] font-extralight tabular-nums"
            style={{ fontSize: 28, color: "var(--gold-warm)", lineHeight: 1.1 }}
          >
            +¥{Math.round(Math.abs(report.reviewStats.avgDeltaYen ?? 0) / 10_000)}万
          </p>
          <p className="mt-1 text-[13px] leading-relaxed">
            過去の口コミ{" "}
            <strong>{report.reviewStats.sampleCount} 件</strong>{" "}
            の平均で、最終見積もりが初期から上がっています。<br />
            あなたの見積もりも同程度の増加がありうる、と想定するのが安全です。
          </p>
        </div>
      )}

      {/* Green: 交渉の余地 (collapsed details) */}
      <details
        className="group rounded-2xl p-4"
        style={{
          background: "color-mix(in oklab, var(--success) 6%, transparent)",
          borderLeft: "3px solid var(--success)",
        }}
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <p
              className="text-[10.5px] uppercase tracking-[0.14em] font-medium"
              style={{ color: "var(--success)" }}
            >
              交渉の余地
            </p>
            <h4 className="mt-1 font-[family-name:var(--font-display)] text-[15px] font-normal">
              3 つの切り口があります
            </h4>
          </div>
          <ChevronDown
            className="h-5 w-5 transition-transform group-open:rotate-180"
            style={{ color: "var(--success)" }}
            strokeWidth={1.8}
          />
        </summary>
        <div className="mt-4 space-y-3">
          {report.negotiationTips.map((tip) => (
            <div
              key={tip.key}
              className="rounded-xl bg-background/80 p-3.5"
            >
              <h5 className="text-[13px] font-medium">{tip.title}</h5>
              <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                {tip.summary}
              </p>
              <blockquote
                className="mt-2 border-l-2 pl-3 text-[12px] italic leading-[1.75]"
                style={{
                  borderColor:
                    "color-mix(in oklab, var(--gold-warm) 40%, transparent)",
                }}
              >
                {tip.script}
              </blockquote>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
            ⚠ 押しつけない、失礼にならない、具体的な数字を出す。
            「交渉」ではなく「相談」として切り出すと、プランナーさんも動きやすくなります。
          </p>
        </div>
      </details>
    </section>
  );
}
