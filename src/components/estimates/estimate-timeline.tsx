"use client";

/**
 * EstimateTimeline — v1 → v2 → v3 の推移を時系列で可視化する。
 *
 * 式場担当者との交渉過程で「何がどう変わったか」を把握するための
 * section。複数バージョンが存在するときだけ価値があるため、
 * `points.length < 2` のときはコンポーネント自体が `null` を返す。
 *
 * 描画は軽量な SVG 直書き。Recharts を dynamic import する手もあるが、
 * 使うのは直線 + 点 + ラベルだけなので、追加 runtime を載せない選択。
 * 375px モバイルでも自然にフィットするよう viewBox ベースで設計。
 *
 * Section 全体の失敗モード:
 * - 値が奇形 / total 0: `buildTimelinePoints` に任せる。delta は 0 表示で済む
 * - 単一 version: `summariseTimeline` が null を返すのでここで null render
 * - 大量 version (>10): とりあえず等間隔にプロット。実運用で 3-5 件が想定
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import {
  buildTimelinePoints,
  computeCategoryDeltas,
  formatDeltaMan,
  summariseTimeline,
  type TimelineEstimateInput,
} from "@/lib/estimate-timeline";
import { formatYen } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  attire: "衣裳",
  cuisine: "料理",
  photo_video: "写真・映像",
  flowers: "装花",
  performance: "演出",
  av_equipment: "音響設備",
  venue_fee: "会場費",
  other: "その他",
};

// Height / padding constants kept as literals so they can be read off
// the SVG without decoding JS. 375px viewport-friendly values.
const SVG_HEIGHT = 110;
const SVG_TOP_PAD = 24; // room for the yen label above each dot
const SVG_BOTTOM_PAD = 26; // room for version label below
const DOT_RADIUS = 5;

export function EstimateTimeline({
  estimates,
}: {
  estimates: TimelineEstimateInput[];
}) {
  const points = useMemo(() => buildTimelinePoints(estimates), [estimates]);
  const summary = useMemo(() => summariseTimeline(points), [points]);
  const [open, setOpen] = useState(false);

  if (!summary || points.length < 2) return null;

  const totals = points.map((p) => p.total);
  const maxTotal = Math.max(...totals);
  const minTotal = Math.min(...totals);
  // Add 8% headroom so dots don't hug the edges. If all totals are
  // identical (unlikely but possible if someone re-saves the same
  // number), fall back to a flat center line.
  const span = maxTotal - minTotal;
  const headroom = span === 0 ? 1 : span * 0.15;
  const yMin = minTotal - headroom;
  const yMax = maxTotal + headroom;

  const usableHeight = SVG_HEIGHT - SVG_TOP_PAD - SVG_BOTTOM_PAD;
  const yFor = (total: number): number => {
    if (yMax === yMin) return SVG_TOP_PAD + usableHeight / 2;
    const ratio = (total - yMin) / (yMax - yMin);
    return SVG_TOP_PAD + (1 - ratio) * usableHeight;
  };

  // X positions are simple equal-interval; version numbers may skip
  // (unlikely with current createEstimate logic but cheap to be robust).
  const xFor = (idx: number): number => {
    if (points.length === 1) return 50;
    return (idx / (points.length - 1)) * 100;
  };

  const trendUp = summary.totalDelta > 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;

  // Adjacent version pair for the breakdown default state = latest vs prev
  const latestIdx = points.length - 1;
  const prev = points[latestIdx - 1];
  const latest = points[latestIdx];
  const categoryDeltas = computeCategoryDeltas(prev, latest).filter(
    (r) => r.delta !== 0,
  );

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      {/* Eyebrow matches estimate-section pattern */}
      <div>
        <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
          Timeline
        </p>
        <h3 className="mt-0.5 font-[family-name:var(--font-display)] text-[15px] font-light tracking-[-0.005em]">
          見積もりの推移
        </h3>
      </div>

      {/* Summary row: "初期見積もりから +N万円" */}
      <div className="flex items-center gap-3 rounded-md bg-tint-gold px-3 py-2">
        <TrendIcon
          className="h-4 w-4 shrink-0 text-tone-gold"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-[11px] text-muted-foreground">
            v{summary.firstVersion} → v{summary.lastVersion}
          </p>
          <p className="text-sm font-light tabular-nums text-tone-gold">
            初期見積もりから{" "}
            <span className="font-medium">
              {formatDeltaMan(summary.totalDelta)}
            </span>
            {summary.firstTotal > 0 && (
              <span className="ml-1 text-[11px] text-muted-foreground">
                ({summary.percentChange >= 0 ? "+" : "\u2212"}
                {Math.abs(summary.percentChange).toFixed(1)}%)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Horizontal SVG timeline */}
      <svg
        viewBox={`0 0 100 ${SVG_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`見積もり推移 v${summary.firstVersion}から v${summary.lastVersion}まで`}
        className="h-[110px] w-full"
      >
        {/* Baseline connecting segments between points. Drawn per-segment
            so we can colour by sign (up vs down). */}
        {points.map((pt, i) => {
          if (i === 0) return null;
          const prevPt = points[i - 1];
          const up = pt.total > prevPt.total;
          const colour = up ? "var(--gold-warm)" : "var(--primary)";
          return (
            <line
              key={`seg-${pt.id}`}
              x1={xFor(i - 1)}
              y1={yFor(prevPt.total)}
              x2={xFor(i)}
              y2={yFor(pt.total)}
              stroke={colour}
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Dots + labels */}
        {points.map((pt, i) => {
          const cx = xFor(i);
          const cy = yFor(pt.total);
          const delta = pt.deltaFromPrev;
          return (
            <g key={pt.id}>
              {/* yen label above each dot. text is SVG-native so tabular
                  nums are safe; we pick a small pixel font that works at
                  375px-wide viewport */}
              <text
                x={cx}
                y={cy - DOT_RADIUS - 6}
                textAnchor="middle"
                className="fill-foreground"
                style={{
                  fontSize: "7px",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                }}
              >
                {Math.round(pt.total / 10000)}万
              </text>
              <circle
                cx={cx}
                cy={cy}
                r={DOT_RADIUS}
                className="fill-background"
                stroke="var(--gold-warm)"
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
              />
              {/* version label below */}
              <text
                x={cx}
                y={SVG_HEIGHT - 10}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{
                  fontSize: "7px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                v{pt.version}
              </text>
              {/* delta chip between previous and this point, centred on
                  the segment. Skipped for the first point. */}
              {delta != null && i > 0 && (
                <text
                  x={(cx + xFor(i - 1)) / 2}
                  y={SVG_HEIGHT - 1}
                  textAnchor="middle"
                  style={{
                    fontSize: "6.5px",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 500,
                  }}
                  className={
                    delta > 0
                      ? "fill-[var(--gold-warm)]"
                      : delta < 0
                        ? "fill-[var(--primary)]"
                        : "fill-muted-foreground"
                  }
                >
                  {formatDeltaMan(delta)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Collapsible per-category breakdown (latest vs prev) */}
      {categoryDeltas.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-h-11 w-full items-center justify-between rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors active:scale-[0.98] active:bg-muted"
          >
            <span>
              v{prev.version} → v{latest.version} の項目別差分（
              {categoryDeltas.length}件）
            </span>
            {open ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          {open && (
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {categoryDeltas.map((row) => (
                <li
                  key={row.category}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="text-foreground">
                    {CATEGORY_LABELS[row.category] ?? row.category}
                  </span>
                  <span className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-[11px] text-muted-foreground">
                      {formatYen(row.from)} → {formatYen(row.to)}
                    </span>
                    <span
                      className={
                        row.delta > 0
                          ? "text-tone-gold"
                          : row.delta < 0
                            ? "text-primary"
                            : "text-muted-foreground"
                      }
                    >
                      {formatDeltaMan(row.delta)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
