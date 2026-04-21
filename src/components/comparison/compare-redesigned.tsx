"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronsUpDown, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
 * CompareRedesigned — horizontal multi-select comparison table.
 *
 * The wife-review session landed on two firm requirements:
 *   1. Pick *any* N venues from the project (owner filter acts as a
 *      source-pool chip, not as a gate — users can pick across pools)
 *   2. See them **side-by-side horizontally** with compact per-dimension
 *      bars so the whole matrix reads as a spreadsheet at a glance
 *
 * The earlier iteration tried to dodge the mobile-width problem by
 * offering Duel (pairs) + Stack (vertical) modes and skipping the
 * matrix altogether. User explicitly rejected that ("横並びで比較
 * できるようにしたい") — so the matrix is back, done right this time:
 *
 *   - ALL rows (header, total, every dimension) share a single grid
 *     template via the `--cmp-grid` CSS custom property on the outer
 *     scroll container. No more DimensionRow drift.
 *   - Fixed column widths (120px label + 112px per venue). On mobile
 *     375px this means 2 venues fit exactly; 3+ venues scroll
 *     horizontally while the label column stays sticky-left.
 *   - Stars replaced with a compact 80px horizontal bar + tabular
 *     numeric score. 5 bars in a row are legible at 112px; 5 stars
 *     weren't.
 *   - Winner highlighting = subtle gold background + bold score,
 *     NOT a full-cell gold fill. Previous version saturated columns
 *     in gold which made 4-column matrices feel like a trophy shelf.
 */

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

type OwnerFilter = "all" | "mine" | "partner" | "both";

const OWNER_FILTERS: { id: OwnerFilter; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "mine", label: "自分" },
  { id: "partner", label: "パートナー" },
  { id: "both", label: "おふたり" },
];

const MAX_SELECTED = 5;
const LABEL_COL_PX = 120;
const VENUE_COL_PX = 112;

export function CompareRedesigned() {
  const [data, setData] = useState<UnifiedComparisonData | null>(null);
  const [insight, setInsight] = useState<MatrixInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [diffOnly, setDiffOnly] = useState(false);

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
        // fall through to the "< 2" empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pool defines which venues are eligible for the chip picker. The
  // owner filter narrows the pool; selected venues that fall outside
  // the new pool are dropped (render-phase reset, no effect cascade).
  const pool = useMemo(() => {
    if (!data) return [];
    if (ownerFilter === "all") return data.venues;
    return data.venues.filter((v) => {
      const owners: FavoritedByMap[string] = data.favoritedBy[v.id] ?? [];
      if (ownerFilter === "mine") return owners.includes("me");
      if (ownerFilter === "partner") return owners.includes("partner");
      return owners.includes("me") && owners.includes("partner");
    });
  }, [data, ownerFilter]);

  // Auto-seed the initial selection from the first 3 pool entries.
  // React 19 sanctions render-phase resets over useEffect setState.
  const [prevOwnerFilter, setPrevOwnerFilter] = useState(ownerFilter);
  if (prevOwnerFilter !== ownerFilter) {
    setPrevOwnerFilter(ownerFilter);
    if (pool.length === 0) {
      setSelected(new Set());
    } else {
      const kept = new Set<string>();
      for (const v of pool) if (selected.has(v.id)) kept.add(v.id);
      if (kept.size >= 2) {
        setSelected(kept);
      } else {
        setSelected(
          new Set(pool.slice(0, Math.min(3, pool.length)).map((v) => v.id)),
        );
      }
    }
  } else if (
    !loading &&
    data &&
    selected.size === 0 &&
    pool.length >= 2
  ) {
    // First paint: seed selection. Guarded on `!loading` so we don't
    // fight the initial `setData` setState.
    setSelected(
      new Set(pool.slice(0, Math.min(3, pool.length)).map((v) => v.id)),
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= MAX_SELECTED) return prev;
      next.add(id);
      return next;
    });
  };

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

  const selectedVenues = data.venues.filter((v) => selected.has(v.id));
  const venueIds = selectedVenues.map((v) => v.id);
  const canRender = venueIds.length >= 2;

  // Build matrix rows with per-dimension winner detection. "Winner"
  // semantics reused from the server payload; we only compute the
  // "ほぼ同じ (|Δ| < 0.5)" tie flag locally so the UI can tint
  // less aggressively when the gap is not meaningful.
  const rows = data.dimensions.map((d) => {
    const scores = venueIds.map((id) => d.scores[id] ?? null);
    const numeric = scores.filter((s): s is number => s !== null);
    const max = numeric.length > 0 ? Math.max(...numeric) : null;
    const min = numeric.length > 0 ? Math.min(...numeric) : null;
    const spread = max !== null && min !== null ? max - min : 0;
    const hasMeaningfulDiff = spread >= 0.5;
    const winnerId =
      max !== null && hasMeaningfulDiff
        ? venueIds[scores.findIndex((s) => s === max)] ?? null
        : null;
    return { dim: d, scores, winnerId, hasMeaningfulDiff, spread };
  });

  const visibleRows = diffOnly ? rows.filter((r) => r.hasMeaningfulDiff) : rows;
  const diffCount = rows.filter((r) => r.hasMeaningfulDiff).length;

  // One CSS variable drives every grid row — no more template drift.
  // Using inline style since Tailwind arbitrary values don't compose
  // cleanly with variable column counts.
  const gridStyle = {
    "--cmp-grid": `${LABEL_COL_PX}px repeat(${venueIds.length}, ${VENUE_COL_PX}px)`,
  } as React.CSSProperties;

  const atLimit = selected.size >= MAX_SELECTED;

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Sticky filter bar: owner scope + selection counter + diff toggle */}
      <div className="sticky top-0 z-20 space-y-3 bg-background/80 px-3 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div
            className="inline-flex gap-1 rounded-full bg-muted p-1"
            role="tablist"
            aria-label="誰の候補から選ぶ"
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
          <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
            {selected.size} / {MAX_SELECTED}
          </span>
        </div>
      </div>

      {/* Venue picker — "card chips" with thumbnail + name + selection
          indicator. Horizontally scrollable; each chip tap toggles a
          selection, but chips beyond MAX_SELECTED are disabled. */}
      {pool.length === 0 ? (
        <div className="mx-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {ownerFilter === "both"
              ? "おふたりが共通で候補にしている式場はまだありません。"
              : ownerFilter === "partner"
                ? "パートナーの候補はまだありません。"
                : ownerFilter === "mine"
                  ? "自分の候補はまだありません。"
                  : "候補がまだありません。"}
          </p>
        </div>
      ) : (
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide">
          {pool.map((v) => {
            const on = selected.has(v.id);
            const disabled = !on && atLimit;
            const owners = data.favoritedBy[v.id] ?? [];
            const byMe = owners.includes("me");
            const byPartner = owners.includes("partner");
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                disabled={disabled}
                aria-pressed={on}
                className={cn(
                  "group relative flex min-h-11 shrink-0 flex-col gap-1 overflow-hidden rounded-2xl border p-2 text-left transition-all active:scale-[0.97] disabled:opacity-40",
                  on
                    ? "border-[color-mix(in_oklab,var(--gold-warm)_60%,transparent)] bg-[var(--gold-subtle)]"
                    : "border-border bg-card",
                )}
                style={{ width: 108 }}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
                  {v.photoUrl ? (
                    <Image
                      src={v.photoUrl}
                      alt=""
                      fill
                      sizes="100px"
                      className="object-cover"
                    />
                  ) : null}
                  {on && (
                    <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gold-warm)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className="truncate font-[family-name:var(--font-display)] text-[11.5px] font-light leading-tight">
                  {v.name}
                </p>
                <div className="flex items-center gap-1">
                  {byMe && (
                    <span className="rounded-full bg-foreground/10 px-1.5 text-[9px] text-foreground/70">
                      自分
                    </span>
                  )}
                  {byPartner && (
                    <span className="rounded-full bg-foreground/10 px-1.5 text-[9px] text-foreground/70">
                      P
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {canRender ? (
        <>
          {/* Toolbar: diff toggle */}
          <div className="flex items-center justify-between px-3">
            <p className="text-[11px] text-muted-foreground">
              {selectedVenues.length} 件 比較中 · 差のある項目{" "}
              <span className="tabular-nums text-foreground/80">
                {diffCount}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setDiffOnly((v) => !v)}
              aria-pressed={diffOnly}
              className={cn(
                "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-[11px] transition-colors active:scale-[0.97]",
                diffOnly
                  ? "border-[var(--gold-warm)] bg-[var(--gold-warm)] text-white"
                  : "border-border text-muted-foreground",
              )}
            >
              <ChevronsUpDown className="h-3 w-3" strokeWidth={2} />
              差がある項目だけ
            </button>
          </div>

          {/* Matrix */}
          <div
            className="mx-3 overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card-low)]"
            style={gridStyle}
            role="region"
            aria-label="式場比較マトリクス"
          >
            {/* Header row — venue thumbnails + names */}
            <div
              className="grid items-end gap-0 border-b border-border"
              style={{ gridTemplateColumns: "var(--cmp-grid)" }}
            >
              <div
                className="sticky left-0 z-10 bg-card px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                style={{ width: LABEL_COL_PX }}
              >
                Venue
              </div>
              {selectedVenues.map((v) => (
                <Link
                  key={v.id}
                  href={`/venues/${v.id}`}
                  className="flex flex-col items-center gap-1.5 px-2 py-2 transition-transform active:scale-95"
                >
                  <div className="relative h-12 w-12 overflow-hidden rounded-full border border-border">
                    {v.photoUrl && (
                      <Image
                        src={v.photoUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <p
                    className="w-full truncate text-center font-[family-name:var(--font-display)] text-[11.5px] leading-tight"
                    title={v.name}
                  >
                    {v.name}
                  </p>
                </Link>
              ))}
            </div>

            {/* Total row */}
            <div
              className="grid items-center gap-0 border-b border-border bg-[color-mix(in_oklab,var(--gold-warm)_6%,transparent)]"
              style={{ gridTemplateColumns: "var(--cmp-grid)" }}
            >
              <div
                className="sticky left-0 z-10 bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--card))] px-3 py-2.5 text-[12px] font-medium text-foreground/85"
                style={{ width: LABEL_COL_PX }}
              >
                総合
              </div>
              {venueIds.map((id) => {
                const score = data.totalScore[id] ?? null;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-center px-2 py-2.5"
                  >
                    {score !== null ? (
                      <span className="tabular-nums text-[18px] font-extralight text-[var(--gold-warm)]">
                        {score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dimension rows */}
            {visibleRows.length === 0 ? (
              <p className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">
                差のある項目はありません。
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {visibleRows.map((row, idx) => (
                  <motion.div
                    key={row.dim.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: LUXURY_EASE }}
                    className={cn(
                      "grid items-center gap-0",
                      idx !== visibleRows.length - 1 && "border-b border-border/60",
                    )}
                    style={{ gridTemplateColumns: "var(--cmp-grid)" }}
                  >
                    <div
                      className="sticky left-0 z-10 bg-card px-3 py-2.5 text-[12px] font-medium text-foreground/80"
                      style={{ width: LABEL_COL_PX }}
                    >
                      {row.dim.label}
                    </div>
                    {row.scores.map((score, colIdx) => {
                      const venueId = venueIds[colIdx];
                      const isWinner = row.winnerId === venueId;
                      return (
                        <DimensionCell
                          key={venueId}
                          score={score}
                          isWinner={isWinner}
                        />
                      );
                    })}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* AI insight */}
          {insight && (
            <div className="mx-3">
              <AIInsightCard
                type="comparison"
                title="AIコーチからのひとこと"
                body={insight.summary}
                actions={insight.nextActions.map((label) => ({
                  label,
                  href: "/coach",
                }))}
              />
            </div>
          )}
        </>
      ) : pool.length >= 2 ? (
        <div className="mx-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <Sparkles
            className="h-6 w-6 text-[var(--gold-warm)]"
            strokeWidth={1.4}
          />
          <p className="text-[13px] text-muted-foreground">
            並べたい式場を 2 件以上えらんでください
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Compact per-cell renderer — a bar (80% fill for score 4/5) + the
 * numeric score underneath. Stars were replaced because 5 glyphs × N
 * columns wrap on 375px below ~80px per column; a bar + number stays
 * legible at 112px and reads as a "how close to full marks" signal.
 */
function DimensionCell({
  score,
  isWinner,
}: {
  score: number | null;
  isWinner: boolean;
}) {
  if (score === null) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 px-2 py-2.5",
          isWinner && "bg-[color-mix(in_oklab,var(--gold-warm)_5%,transparent)]",
        )}
      >
        <div className="h-1.5 w-[70%] rounded-full bg-muted" />
        <span className="text-[11px] text-muted-foreground/50">—</span>
      </div>
    );
  }
  const pct = Math.max(6, (score / 5) * 100);
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-2 py-2.5",
        isWinner && "bg-[color-mix(in_oklab,var(--gold-warm)_8%,transparent)]",
      )}
    >
      <div
        className="relative h-1.5 w-[80%] overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: LUXURY_EASE }}
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            isWinner
              ? "bg-[var(--gold-warm)]"
              : "bg-foreground/60",
          )}
        />
      </div>
      <span
        className={cn(
          "tabular-nums text-[12.5px] leading-none",
          isWinner
            ? "font-medium text-[var(--gold-warm)]"
            : "font-normal text-foreground/85",
        )}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}
