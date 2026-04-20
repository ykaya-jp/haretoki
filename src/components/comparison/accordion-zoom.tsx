"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Filter, GitCompare, Loader2 } from "lucide-react";
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
import { DimensionRow } from "./dimension-row";
import { AIInsightCard } from "@/components/ai/insight-card";
import { cn } from "@/lib/utils";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

type OwnerFilter = "all" | "mine" | "partner" | "both";

const OWNER_FILTERS: { id: OwnerFilter; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "mine", label: "自分" },
  { id: "partner", label: "パートナー" },
  { id: "both", label: "おふたり" },
];

const MAX_SELECTED = 4;

/**
 * AccordionZoom — the "比べる" tab's comparison matrix.
 *
 * Design shifts from the prior version:
 *   - Matrix is a real horizontal-scroll table with a sticky-left label
 *     column; previously we tried `grid-template-columns: 100px repeat(N,
 *     1fr)` which made the per-venue columns collapse below 80px once
 *     N ≥ 4 and the 5-star glyphs wrapped. Fixed 72px columns + 92px
 *     sticky label column now give every cell room to breathe and let
 *     us scroll when N gets large.
 *   - Venue selection is now explicit (chip row with on/off tap). Users
 *     pick up to 4 venues from a pool that respects the owner filter,
 *     so "比べる" always shows what you chose rather than "everything
 *     the project has ever seen".
 *   - Owner filter (自分 / パートナー / おふたり / すべて) lifts the
 *     same "whose candidate?" affordance the shortlist tab already
 *     has, so /candidates?tab=compare stays consistent.
 */
export function AccordionZoom() {
  const [data, setData] = useState<UnifiedComparisonData | null>(null);
  const [insight, setInsight] = useState<MatrixInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffOnly, setDiffOnly] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
        // silently fall through to empty state below
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pool = venues that match the owner filter. "all" passes everything
  // through so even venues no one has favorited yet (rare — we auto-
  // favorite on create, but legacy rows may exist) remain comparable.
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

  // Auto-populate selection when pool first resolves or the owner
  // filter changes. Keep the previously-selected venues that still
  // match, top up from the pool head to 3 (not 4 — that's a user-
  // driven ceiling). Reset when the filter changes and nothing remains.
  useEffect(() => {
    if (pool.length === 0) {
      setSelected(new Set());
      return;
    }
    setSelected((prev) => {
      const kept = new Set<string>();
      for (const v of pool) if (prev.has(v.id)) kept.add(v.id);
      if (kept.size >= 2) return kept;
      const fill = pool.slice(0, Math.min(3, pool.length));
      return new Set(fill.map((v) => v.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter, pool.length]);

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
        <p className="text-body text-muted-foreground">
          並べて見比べるには、式場を 2 件以上迎えてください。
        </p>
        <Link
          href="/explore"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground active:scale-[0.98]"
        >
          式場を探す
        </Link>
      </div>
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

  // Preserve the data.venues order so the matrix doesn't re-shuffle
  // every time the user toggles a chip.
  const selectedVenues = data.venues.filter((v) => selected.has(v.id));
  const venueIds = selectedVenues.map((v) => v.id);
  const canRender = venueIds.length >= 2;

  // 375px budget: 92px sticky label + 72px * N + 24px internal padding.
  // Beyond 3 columns the container scrolls horizontally — accepted
  // because the sticky-left label keeps orientation intact.
  const gridTemplate = `92px repeat(${venueIds.length}, 72px)`;

  const atLimit = selected.size >= MAX_SELECTED;

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Filter bar — owner scope, venue chips, diff-only */}
      <div className="space-y-3 px-3">
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

        {pool.length > 0 ? (
          <>
            <div
              className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide"
              aria-label="比較する式場を選ぶ"
            >
              {pool.map((v) => {
                const on = selected.has(v.id);
                const disabled = !on && atLimit;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggle(v.id)}
                    disabled={disabled}
                    aria-pressed={on}
                    className={cn(
                      "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-[12.5px] transition-all active:scale-[0.97] disabled:opacity-40",
                      on
                        ? "border-[color-mix(in_oklab,var(--gold-warm)_60%,transparent)] bg-[var(--gold-subtle)] text-foreground"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {v.photoUrl ? (
                      <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
                        <Image
                          src={v.photoUrl}
                          alt=""
                          fill
                          sizes="24px"
                          className="object-cover"
                        />
                      </span>
                    ) : (
                      <span className="h-6 w-6 shrink-0 rounded-full bg-muted" />
                    )}
                    <span className="max-w-[10ch] truncate font-[family-name:var(--font-display)]">
                      {v.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {selected.size} / {MAX_SELECTED} 件 比較中
              </span>
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
                <Filter className="h-3 w-3" strokeWidth={2} />
                差分のみ
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {ownerFilter === "both"
                ? "おふたりが共通で候補にしている式場はまだありません。"
                : ownerFilter === "partner"
                  ? "パートナーがまだ候補に入れていません。"
                  : "候補がまだありません。"}
            </p>
          </div>
        )}
      </div>

      {pool.length > 0 && !canRender ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <GitCompare
            className="h-7 w-7 text-muted-foreground/60"
            strokeWidth={1.4}
          />
          <p className="text-[13px] text-muted-foreground">
            並べたい式場を 2 件以上えらんでください
          </p>
        </div>
      ) : canRender ? (
        <div className="mx-3 overflow-x-auto rounded-2xl border border-border bg-card">
          {/* Venue header row — sticky on vertical scroll so the names
              stay in view when the dimension list gets long. */}
          <div
            className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div
              className="grid items-center gap-2 px-3 py-2"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className="sticky left-0 z-10 bg-card/95" />
              {selectedVenues.map((venue) => (
                <Link
                  key={venue.id}
                  href={`/venues/${venue.id}`}
                  className="flex min-w-0 flex-col items-center gap-1"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border">
                    {venue.photoUrl ? (
                      <Image
                        src={venue.photoUrl}
                        alt={venue.name}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted" />
                    )}
                  </div>
                  <p
                    className="w-full truncate text-center font-[family-name:var(--font-display)] text-[11px] leading-tight text-foreground/85"
                    title={venue.name}
                  >
                    {venue.name}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {/* Total score row */}
          <div className="border-b border-border bg-[color-mix(in_oklab,var(--gold-warm)_8%,transparent)]">
            <div
              className="grid min-h-11 items-center gap-2 px-3 py-2"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <span className="sticky left-0 bg-[color-mix(in_oklab,var(--gold-warm)_8%,var(--card))] text-[11.5px] font-medium text-foreground/80">
                総合
              </span>
              {venueIds.map((venueId) => {
                const score = data.totalScore[venueId] ?? null;
                return (
                  <div
                    key={venueId}
                    className="flex items-center justify-center"
                  >
                    {score !== null ? (
                      <span className="tabular-nums text-sm font-medium text-[var(--gold-warm)]">
                        {score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {data.dimensions.map((dimension, i) => (
            <DimensionRow
              key={dimension.id}
              dimension={dimension}
              venueIds={venueIds}
              diffOnly={diffOnly}
              defaultExpanded={i === 0}
              isWinner={
                dimension.winnerId !== null &&
                venueIds.includes(dimension.winnerId)
              }
            />
          ))}

          {data.unmappedItems.length > 0 && (
            <DimensionRow
              key="unmapped"
              dimension={{
                id: "unmapped",
                label: "その他",
                scores: Object.fromEntries(venueIds.map((id) => [id, null])),
                winnerId: null,
                checklistItems: data.unmappedItems,
                totalItems: data.unmappedItems.length,
                answeredItems: data.unmappedItems.filter((item) =>
                  venueIds.some((vid) => item.answers[vid]?.status !== null),
                ).length,
              }}
              venueIds={venueIds}
              diffOnly={diffOnly}
              defaultExpanded={false}
              isWinner={false}
            />
          )}
        </div>
      ) : null}

      <AnimatePresence>
        {insight && canRender && (
          <motion.div
            key="insight"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: LUXURY_EASE, delay: 0.3 }}
            className="mx-3"
          >
            <AIInsightCard
              type="comparison"
              title="AIコーチからのひとこと"
              body={insight.summary}
              actions={insight.nextActions.map((action) => ({
                label: action,
                href: "/coach",
              }))}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
