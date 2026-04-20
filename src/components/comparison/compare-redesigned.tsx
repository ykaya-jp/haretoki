"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Scale,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  getUnifiedComparisonData,
  type UnifiedComparisonData,
  type FavoritedByMap,
} from "@/server/actions/unified-comparison";
import {
  getMatrixInsight,
  type MatrixInsight,
} from "@/server/actions/matrix-insight";
import { AIInsightCard } from "@/components/ai/insight-card";
import { cn } from "@/lib/utils";

/**
 * CompareRedesigned — 比べるタブの抜本書き直し。
 *
 * 背景: 既存 AccordionZoom は 375px で右に伸びすぎ、DimensionRow の
 * 自前 grid-template がヘッダー行と不整合になりラベルが潰れる構造破綻
 * があった。product-designer のリサーチ (Airbnb / Booking.com / NN/G
 * 2026) でも「mobile で 3+ venue の完全並列マトリクスは破綻する」が
 * 一貫した結論 → マトリクスそのものを捨てる。
 *
 * - Duel (ペアで比べる, default): 2 件の A/B を並置、swipe/ボタンで
 *   全 C(N,2) ペアを回遊。差分 ≥ 0.5 の dimension だけ「ここが論点」
 *   カードに昇格、同値は 1 行で圧縮。
 * - Stack (ぜんぶ並べる): 全 venue を縦積みカード、各 card 内に
 *   dimension を bar + 数値で 4 行表示。横スクロールは発生しない。
 *
 * 勝者(winner) 表現は UI から削除。結婚式場選びで一方が「負け」扱い
 * されるのはブランドに反するため、「ここが論点」「+0.8 強み」のような
 * 論点提示語彙に全面置換。
 */

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

type OwnerFilter = "all" | "mine" | "partner" | "both";
type Mode = "duel" | "stack";

const OWNER_FILTERS: { id: OwnerFilter; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "mine", label: "自分" },
  { id: "partner", label: "パートナー" },
  { id: "both", label: "おふたり" },
];

const MODES: { id: Mode; label: string; Icon: typeof Scale }[] = [
  { id: "duel", label: "ペアで比べる", Icon: Scale },
  { id: "stack", label: "ぜんぶ並べる", Icon: Layers },
];

const STACK_VISIBLE_DIMS = 4;

export function CompareRedesigned() {
  const [data, setData] = useState<UnifiedComparisonData | null>(null);
  const [insight, setInsight] = useState<MatrixInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("duel");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [pairIndex, setPairIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [compData, insightData] = await Promise.all([
          getUnifiedComparisonData(),
          getMatrixInsight(),
        ]);
        if (!cancelled) {
          setData(compData);
          setInsight(insightData);
        }
      } catch {
        // Empty-state fallback below handles this
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const pool = useMemo(() => {
    if (!data) return [];
    return data.venues.filter((v) => {
      if (ownerFilter === "all") return true;
      const owners: FavoritedByMap[string] = data.favoritedBy[v.id] ?? [];
      if (ownerFilter === "mine") return owners.includes("me");
      if (ownerFilter === "partner") return owners.includes("partner");
      return owners.includes("me") && owners.includes("partner");
    });
  }, [data, ownerFilter]);

  const pairs = useMemo<[string, string][]>(() => {
    const out: [string, string][] = [];
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        out.push([pool[i].id, pool[j].id]);
      }
    }
    return out;
  }, [pool]);

  // Reset pair cursor when the pool shrinks below the current index.
  // Render-phase comparison is React 19's sanctioned pattern (avoids
  // the "setState inside useEffect triggers cascade" lint error).
  const [prevPairsLen, setPrevPairsLen] = useState(pairs.length);
  if (prevPairsLen !== pairs.length) {
    setPrevPairsLen(pairs.length);
    if (pairIndex >= pairs.length) setPairIndex(0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.venues.length < 2) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          並べて見比べるには、式場を 2 件以上
          <br />
          候補にしてください。
        </p>
        <Link
          href="/explore"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground active:scale-[0.98]"
        >
          式場を探す
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Sticky filter bar: owner scope + compare mode */}
      <div className="sticky top-0 z-20 space-y-3 bg-background/80 px-3 pb-2 pt-3 backdrop-blur-xl">
        <div
          className="inline-flex gap-1 rounded-full bg-muted p-1"
          role="tablist"
          aria-label="誰の候補をみる"
        >
          {OWNER_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={ownerFilter === f.id}
              onClick={() => setOwnerFilter(f.id)}
              className={cn(
                "min-h-9 rounded-full px-3 text-[12px] font-medium transition-colors active:scale-[0.97]",
                ownerFilter === f.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          className="inline-flex gap-1 rounded-full bg-muted p-1"
          role="tablist"
          aria-label="比べ方を選ぶ"
        >
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors active:scale-[0.97]",
                mode === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {pool.length < 2 ? (
        <div className="px-6 py-10 text-center text-[13px] text-muted-foreground">
          このフィルタでペアになる式場がありません。別の絞り込みを試してみてください。
        </div>
      ) : mode === "duel" ? (
        <DuelView
          data={data}
          pairs={pairs}
          pairIndex={pairIndex}
          onPrev={() => setPairIndex((i) => Math.max(0, i - 1))}
          onNext={() =>
            setPairIndex((i) => Math.min(pairs.length - 1, i + 1))
          }
          insight={insight}
        />
      ) : (
        <StackView data={data} pool={pool} />
      )}
    </div>
  );
}

/** DUEL — A vs B, carousel through all C(N,2) pairs */
function DuelView({
  data,
  pairs,
  pairIndex,
  onPrev,
  onNext,
  insight,
}: {
  data: UnifiedComparisonData;
  pairs: [string, string][];
  pairIndex: number;
  onPrev: () => void;
  onNext: () => void;
  insight: MatrixInsight | null;
}) {
  if (pairs.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-[13px] text-muted-foreground">
        このフィルタでペアになる式場がありません。
      </p>
    );
  }
  const [aId, bId] = pairs[pairIndex];
  const A = data.venues.find((v) => v.id === aId);
  const B = data.venues.find((v) => v.id === bId);
  if (!A || !B) return null;

  // Sort dimensions by |Δ| desc so the biggest gaps surface first.
  const diffs = data.dimensions
    .map((d) => {
      const sa = d.scores[aId];
      const sb = d.scores[bId];
      if (sa === null || sa === undefined || sb === null || sb === undefined) {
        return null;
      }
      return { dimId: d.id, label: d.label, a: sa, b: sb, delta: sa - sb };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  const significant = diffs.filter((d) => Math.abs(d.delta) >= 0.5);
  const tied = diffs.filter((d) => Math.abs(d.delta) < 0.5);

  const sa = data.totalScore[aId] ?? null;
  const sb = data.totalScore[bId] ?? null;

  return (
    <motion.div
      key={`${aId}-${bId}`}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: LUXURY_EASE }}
      className="flex flex-col gap-4 px-3"
    >
      {/* Pair navigator */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={pairIndex === 0}
          aria-label="前のペア"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card transition-transform active:scale-95 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {pairIndex + 1} / {pairs.length} ペア
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={pairIndex >= pairs.length - 1}
          aria-label="次のペア"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card transition-transform active:scale-95 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* A vs B heads */}
      <div className="grid grid-cols-2 gap-2">
        {[A, B].map((v, i) => {
          const s = i === 0 ? sa : sb;
          const otherS = i === 0 ? sb : sa;
          const lead =
            s !== null && otherS !== null && s - otherS >= 0.5
              ? (s - otherS).toFixed(1)
              : null;
          return (
            <Link
              key={v.id}
              href={`/venues/${v.id}`}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 transition-transform active:scale-[0.98]"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                {v.photoUrl && (
                  <Image
                    src={v.photoUrl}
                    alt=""
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                )}
              </div>
              <h3 className="truncate font-[family-name:var(--font-display)] text-[13px] font-light leading-tight">
                {v.name}
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="tabular-nums text-2xl font-extralight text-foreground">
                  {s !== null ? s.toFixed(1) : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground">/5.0</span>
                {lead && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-[var(--gold-subtle)] px-2 text-[10px] font-medium tabular-nums text-[var(--gold-warm)]">
                    +{lead}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* "ここが論点" diff card */}
      <section
        className="rounded-2xl border border-border bg-card p-4"
        aria-label="差分ハイライト"
      >
        <header className="mb-3 flex items-center justify-between">
          <h4 className="text-[12px] font-medium tracking-wider text-muted-foreground">
            ここが論点
          </h4>
          <span className="tabular-nums text-[11px] text-muted-foreground">
            {significant.length} 項目
          </span>
        </header>
        {significant.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            大きな違いは見つかりませんでした。どちらも近い評価です。
          </p>
        ) : (
          <ul className="space-y-3">
            {significant.map((d) => {
              const leader = d.delta > 0 ? A : B;
              const absDelta = Math.abs(d.delta);
              const aPct = (d.a / 5) * 100;
              const bPct = (d.b / 5) * 100;
              return (
                <li key={d.dimId} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-foreground/85">
                      {d.label}
                    </span>
                    <span className="truncate tabular-nums text-[11px] font-medium text-[var(--gold-warm)]">
                      {leader.name.length > 8
                        ? `${leader.name.slice(0, 8)}…`
                        : leader.name}{" "}
                      +{absDelta.toFixed(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div
                      className="relative h-1.5 rounded-full bg-muted"
                      aria-label={`${A.name} ${d.a.toFixed(1)}`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
                        style={{ width: `${aPct}%` }}
                      />
                    </div>
                    <div
                      className="relative h-1.5 rounded-full bg-muted"
                      aria-label={`${B.name} ${d.b.toFixed(1)}`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
                        style={{ width: `${bPct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {tied.length > 0 && (
          <p className="mt-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground/80">
            ほぼ同じ: {tied.map((d) => d.label).join(" / ")}
          </p>
        )}
      </section>

      {insight && (
        <AIInsightCard
          type="comparison"
          title="AIコーチからのひとこと"
          body={buildPairCopy(A.name, B.name, significant, insight)}
          actions={[
            {
              label: "コーチに相談する",
              href: `/coach?pair=${A.id},${B.id}`,
            },
          ]}
        />
      )}
    </motion.div>
  );
}

function buildPairCopy(
  aName: string,
  bName: string,
  significant: { label: string; delta: number }[],
  fallback: MatrixInsight,
) {
  if (significant.length === 0) {
    // When the pair is near-tied, the project-level insight still
    // surfaces useful framing ("費用が同額で…" 等).
    return `${aName} と ${bName} は総合点が近いですね。${fallback.summary.split("。")[0]}。`;
  }
  const top = significant[0];
  const leader = top.delta > 0 ? aName : bName;
  const rest =
    significant.length > 1
      ? "他にも差のある項目があります。"
      : "";
  return `${top.label} で ${leader} が ${Math.abs(top.delta).toFixed(
    1,
  )} 点リードしています。${rest}譲れない軸を一度話してみませんか。`;
}

/** STACK — vertical list of all venues, one card per venue */
function StackView({
  data,
  pool,
}: {
  data: UnifiedComparisonData;
  pool: UnifiedComparisonData["venues"];
}) {
  return (
    <div className="space-y-3 px-3">
      {pool.map((v) => {
        const total = data.totalScore[v.id];
        return (
          <Link
            key={v.id}
            href={`/venues/${v.id}`}
            className="block space-y-3 rounded-2xl border border-border bg-card p-4 transition-transform active:scale-[0.99]"
          >
            <header className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                {v.photoUrl && (
                  <Image
                    src={v.photoUrl}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-[family-name:var(--font-display)] text-[15px] font-light">
                  {v.name}
                </h3>
                {v.latestEstimateTotal !== null && (
                  <p className="tabular-nums text-[11.5px] text-muted-foreground">
                    見積もり ¥{Math.round(v.latestEstimateTotal / 10000)}万
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className="tabular-nums text-2xl font-extralight">
                  {total !== null && total !== undefined
                    ? total.toFixed(1)
                    : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground">総合</span>
              </div>
            </header>
            <ul className="space-y-2">
              {data.dimensions.slice(0, STACK_VISIBLE_DIMS).map((d) => {
                const s = d.scores[v.id];
                const hasScore = s !== null && s !== undefined;
                const pct = hasScore ? (s / 5) * 100 : 0;
                return (
                  <li
                    key={d.id}
                    className="grid grid-cols-[80px_1fr_32px] items-center gap-2"
                  >
                    <span className="text-[11.5px] text-muted-foreground">
                      {d.label}
                    </span>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-right text-[11px] text-foreground/80">
                      {hasScore ? s.toFixed(1) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Link>
        );
      })}
    </div>
  );
}
