"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, SlidersHorizontal, Check, X, Sparkles } from "lucide-react";
import { getMatrixData, type MatrixData } from "@/server/actions/matrix";
import { getMatrixInsight, type MatrixInsight } from "@/server/actions/matrix-insight";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { LUXURY_EASE } from "@/lib/motion-variants";

const HIDDEN_DIMS_KEY = "haretoki:matrix:hidden-dims";
const VENUE_FILTERS_KEY = "haretoki:matrix:venue-filters";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit_card: "カード",
  cash: "現金",
  bank_transfer: "振込",
  installment: "分割",
};

interface VenueFilters {
  /** Keep only venues whose dressBringIn is in this set. Empty = no filter. */
  dressBringIn: string[];
  /** Keep venues whose paymentMethodEnums include any of these. Empty = no filter. */
  paymentMethods: string[];
}

function readPersistedVenueFilters(): VenueFilters {
  const empty: VenueFilters = { dressBringIn: [], paymentMethods: [] };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(VENUE_FILTERS_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "dressBringIn" in parsed &&
      "paymentMethods" in parsed
    ) {
      const p = parsed as { dressBringIn: unknown; paymentMethods: unknown };
      const dressBringIn = Array.isArray(p.dressBringIn)
        ? p.dressBringIn.filter((v): v is string => typeof v === "string")
        : [];
      const paymentMethods = Array.isArray(p.paymentMethods)
        ? p.paymentMethods.filter((v): v is string => typeof v === "string")
        : [];
      return { dressBringIn, paymentMethods };
    }
  } catch {
    // ignore
  }
  return empty;
}

function formatYen(amount: number | null): string {
  if (amount === null) return "—";
  const man = Math.round(amount / 10000);
  return `${man}万円`;
}

function scoreColor(score: number | null, isWinner: boolean): string {
  if (score === null) return "text-muted-foreground/40";
  if (isWinner) return "text-[var(--gold-warm)] font-medium";
  if (score >= 4.0) return "text-foreground";
  if (score >= 3.0) return "text-foreground/80";
  return "text-muted-foreground";
}

/** Winner cell: stronger gold tint + subtle top hairline. Non-winner: subtle
 *  tonal. All colors go through var() tokens so ダークモードで崩れない. */
function scoreBackground(score: number | null, isWinner: boolean): string {
  if (isWinner) return "bg-[color-mix(in_oklab,var(--gold-warm)_10%,transparent)]";
  if (score === null) return "bg-transparent";
  if (score >= 4.5) return "bg-[color-mix(in_oklab,var(--success)_10%,transparent)]";
  if (score >= 4.0) return "bg-[color-mix(in_oklab,var(--success)_5%,transparent)]";
  if (score < 3.0) return "bg-[color-mix(in_oklab,var(--destructive)_6%,transparent)]";
  return "bg-transparent";
}

/**
 * Hydrate hiddenDims from localStorage via a lazy useState initializer rather
 * than an effect. `useEffect`+`setState` pattern trips React 19's
 * `set-state-in-effect` rule (cascading renders). `typeof window` guards SSR;
 * the matrix shows a loading skeleton until `getMatrixData()` resolves, so
 * there's no hydration-visible difference.
 */
function readPersistedHiddenDims(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_DIMS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return new Set(parsed as string[]);
    }
  } catch {
    // corrupted/privacy mode — fall through
  }
  return new Set();
}

export function DecisionMatrix() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hiddenDims, setHiddenDims] = useState<Set<string>>(readPersistedHiddenDims);
  const [venueFilters, setVenueFilters] = useState<VenueFilters>(readPersistedVenueFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [insight, setInsight] = useState<MatrixInsight | null | undefined>(undefined);
  const prefersReduced = useReducedMotion();

  const persistVenueFilters = (next: VenueFilters) => {
    try {
      if (next.dressBringIn.length === 0 && next.paymentMethods.length === 0) {
        window.localStorage.removeItem(VENUE_FILTERS_KEY);
      } else {
        window.localStorage.setItem(VENUE_FILTERS_KEY, JSON.stringify(next));
      }
    } catch {
      // ignore
    }
  };

  const toggleVenueFilter = (kind: keyof VenueFilters, value: string) => {
    setVenueFilters((prev) => {
      const has = prev[kind].includes(value);
      const nextValues = has
        ? prev[kind].filter((v) => v !== value)
        : [...prev[kind], value];
      const next = { ...prev, [kind]: nextValues };
      persistVenueFilters(next);
      return next;
    });
  };

  const clearVenueFilters = () => {
    const empty: VenueFilters = { dressBringIn: [], paymentMethods: [] };
    setVenueFilters(empty);
    persistVenueFilters(empty);
  };

  useEffect(() => {
    getMatrixData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // Fetch AI insight in parallel — the matrix renders first, the insight
  // card arrives progressively. null = not enough data; undefined = loading.
  useEffect(() => {
    let cancelled = false;
    getMatrixInsight()
      .then((res) => {
        if (!cancelled) setInsight(res);
      })
      .catch(() => {
        if (!cancelled) setInsight(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleDim = (id: string) => {
    setHiddenDims((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(HIDDEN_DIMS_KEY, JSON.stringify([...next]));
      } catch {
        // quota or privacy mode — silent, preference will reset next session
      }
      return next;
    });
  };

  const resetDims = () => {
    setHiddenDims(new Set());
    try {
      localStorage.removeItem(HIDDEN_DIMS_KEY);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.venues.length === 0) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          比べるには候補が必要です
        </p>
        <Link
          href="/explore"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200"
        >
          式場を見てみる
        </Link>
      </div>
    );
  }

  if (data.venues.length === 1) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          もう1件候補に入れると、比べられます
        </p>
        <Link
          href="/explore"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200"
        >
          他の式場も見てみる
        </Link>
      </div>
    );
  }

  const { venues: allVenues, dimensions: allDimensions, winners } = data;
  const dimensions = allDimensions.filter((d) => !hiddenDims.has(d.id));
  const hiddenCount = allDimensions.length - dimensions.length;

  const venues = allVenues.filter((v) => {
    if (venueFilters.dressBringIn.length > 0) {
      if (!v.dressBringIn || !venueFilters.dressBringIn.includes(v.dressBringIn)) {
        return false;
      }
    }
    if (venueFilters.paymentMethods.length > 0) {
      const has = venueFilters.paymentMethods.some((m) =>
        v.paymentMethodEnums.includes(m),
      );
      if (!has) return false;
    }
    return true;
  });
  const filteredOutCount = allVenues.length - venues.length;
  const venueFilterActive =
    venueFilters.dressBringIn.length + venueFilters.paymentMethods.length > 0;

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.9, ease: LUXURY_EASE }}
      className="space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            並べて、見比べる
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-[19px] font-light tracking-[0.01em] text-foreground">
            決定マトリクス
          </h3>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            {filteredOutCount > 0
              ? `条件で ${filteredOutCount} 件を非表示中 · ${venues.length} 件を比較中`
              : hiddenCount > 0
                ? `${allDimensions.length - hiddenCount} / ${allDimensions.length} 観点を表示中`
                : "ゴールドの背景が、各観点の 1 位です"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          aria-expanded={filterOpen}
          aria-label="絞り込みを開く"
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-[color-mix(in_oklab,var(--gold-warm)_55%,transparent)]",
            hiddenCount > 0 || venueFilterActive || filterOpen
              ? "bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
              : "bg-card text-foreground",
          )}
          style={{
            borderColor:
              hiddenCount > 0 || venueFilterActive || filterOpen
                ? "color-mix(in oklab, var(--gold-warm) 55%, transparent)"
                : "var(--border)",
          }}
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.6} />
          <span>絞る</span>
          {(hiddenCount > 0 || venueFilterActive) && (
            <span
              aria-hidden="true"
              className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[var(--gold-warm)]"
            />
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {filterOpen && (
          <motion.div
            key="filter-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl border border-border/70 bg-card/70 p-4 backdrop-blur-sm"
              role="group"
              aria-label="表示する観点"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  表示する観点
                </p>
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={resetDims}
                    className="text-[11.5px] text-muted-foreground underline-offset-4 hover:underline"
                  >
                    すべて表示に戻す
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {allDimensions.map((dim) => {
                  const isActive = !hiddenDims.has(dim.id);
                  return (
                    <button
                      key={dim.id}
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      onClick={() => toggleDim(dim.id)}
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition active:scale-[0.98]",
                        isActive
                          ? "bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
                          : "bg-background text-muted-foreground line-through decoration-1",
                      )}
                      style={{
                        borderColor: isActive
                          ? "color-mix(in oklab, var(--gold-warm) 40%, transparent)"
                          : "var(--border)",
                      }}
                    >
                      {isActive ? (
                        <Check className="h-3 w-3" strokeWidth={2} />
                      ) : (
                        <X className="h-3 w-3" strokeWidth={2} />
                      )}
                      <span>{dim.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Venue filters — F-08 */}
              <div className="mt-5 border-t border-border/50 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                    条件で式場を絞る
                  </p>
                  {venueFilterActive && (
                    <button
                      type="button"
                      onClick={clearVenueFilters}
                      className="text-[11.5px] text-muted-foreground underline-offset-4 hover:underline"
                    >
                      条件をクリア
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <p className="mb-1.5 text-[11px] text-muted-foreground">
                      ドレス持込
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "allowed", label: "可" },
                        { value: "negotiable", label: "要相談" },
                        { value: "not_allowed", label: "不可" },
                      ].map((opt) => {
                        const isOn = venueFilters.dressBringIn.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="switch"
                            aria-checked={isOn}
                            onClick={() => toggleVenueFilter("dressBringIn", opt.value)}
                            className={cn(
                              "inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[12px] transition active:scale-[0.98]",
                              isOn
                                ? "bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
                                : "bg-background text-muted-foreground",
                            )}
                            style={{
                              borderColor: isOn
                                ? "color-mix(in oklab, var(--gold-warm) 40%, transparent)"
                                : "var(--border)",
                            }}
                          >
                            {isOn && <Check className="h-3 w-3" strokeWidth={2} />}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] text-muted-foreground">
                      支払い方法
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => {
                        const isOn = venueFilters.paymentMethods.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            role="switch"
                            aria-checked={isOn}
                            onClick={() => toggleVenueFilter("paymentMethods", value)}
                            className={cn(
                              "inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[12px] transition active:scale-[0.98]",
                              isOn
                                ? "bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
                                : "bg-background text-muted-foreground",
                            )}
                            style={{
                              borderColor: isOn
                                ? "color-mix(in oklab, var(--gold-warm) 40%, transparent)"
                                : "var(--border)",
                            }}
                          >
                            {isOn && <Check className="h-3 w-3" strokeWidth={2} />}
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-muted-foreground/80">
                選択はこの端末のみ記憶されます。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty-after-filter state: everything filtered out */}
      {venues.length === 0 && venueFilterActive && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface-raised p-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            条件に合う候補がありません。
          </p>
          <button
            type="button"
            onClick={clearVenueFilters}
            className="mt-2 text-[13px] font-medium text-[var(--gold-warm)] underline-offset-4 hover:underline"
          >
            条件をクリアする
          </button>
        </div>
      )}

      {/* Scrollable table with right-edge fade to signal horizontal scroll.
          Note: The "別の式場を検討する / 決め直す" affordance for post-decision
          state belongs in candidates-view.tsx (where the decision screen is
          rendered at ~line 307-324), not in this matrix component. */}
      {venues.length > 0 && (
      <div className="relative">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-3 text-left text-xs font-medium text-muted-foreground w-[80px] md:w-[100px]">
                項目
              </th>
              {venues.map((v) => (
                <th key={v.id} className="px-2 py-3 text-center min-w-[110px]">
                  <div className="flex flex-col items-center gap-1.5">
                    {v.photoUrl ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-full">
                        <Image src={v.photoUrl} alt="" fill sizes="48px" className="object-cover" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted" />
                    )}
                    <Link
                      href={`/venues/${v.id}`}
                      prefetch={true}
                      className="block font-[family-name:var(--font-display)] text-xs font-light tracking-[-0.005em] leading-tight truncate max-w-[100px] hover:underline"
                    >
                      {v.name}
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Total score row */}
            <tr>
              <td className="sticky left-0 z-10 bg-card px-3 py-3 text-xs font-medium">
                総合
              </td>
              {venues.map((v) => {
                const isWinner = winners.total === v.id;
                return (
                  <td
                    key={v.id}
                    aria-label={isWinner ? "総合 1 位" : undefined}
                    className={cn(
                      "relative px-2 py-3 text-center text-sm tabular-nums transition-colors",
                      scoreBackground(v.totalScore, isWinner),
                      scoreColor(v.totalScore, isWinner),
                      isWinner &&
                        "before:absolute before:left-2 before:right-2 before:top-0 before:h-[2px] before:bg-[var(--gold-warm)] before:content-['']",
                    )}
                  >
                    {v.totalScore !== null ? v.totalScore.toFixed(1) : "—"}
                  </td>
                );
              })}
            </tr>
            {/* Dimension rows */}
            {dimensions.map((dim) => (
              <tr key={dim.id}>
                <td className="sticky left-0 z-10 bg-card px-3 py-3 text-xs text-muted-foreground">
                  {dim.label}
                </td>
                {venues.map((v) => {
                  const score = v.scoresByDimension[dim.id];
                  const isWinner = winners[dim.id] === v.id;
                  return (
                    <td
                      key={v.id}
                      aria-label={isWinner ? `${dim.label} 1 位` : undefined}
                      className={cn(
                        "relative px-2 py-3 text-center text-sm tabular-nums transition-colors",
                        scoreBackground(score, isWinner),
                        scoreColor(score, isWinner),
                      )}
                    >
                      {isWinner && (
                        <span
                          aria-hidden="true"
                          className="absolute right-1.5 top-1.5 block h-1.5 w-1.5 rounded-full bg-[var(--gold-warm)]"
                        />
                      )}
                      {score !== null ? score.toFixed(1) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* R-6: 見学後の気持ち (E-3 帰り道モード から集計) */}
            {venues.some((v) => v.wayHomeMood !== null) && (
              <tr>
                <td className="sticky left-0 z-10 bg-card px-3 py-3 text-xs text-muted-foreground">
                  見学後の気持ち
                </td>
                {venues.map((v) => {
                  const m = v.wayHomeMood;
                  const emoji =
                    m === null
                      ? "—"
                      : m >= 4.5
                        ? "☀️"
                        : m >= 3.5
                          ? "🌤"
                          : m >= 2.5
                            ? "☁️"
                            : "🌫";
                  return (
                    <td
                      key={v.id}
                      className="relative px-2 py-3 text-center text-base"
                      aria-label={
                        m !== null
                          ? `見学後の気持ち ${m.toFixed(1)} / 5`
                          : "帰り道モード未記録"
                      }
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </td>
                  );
                })}
              </tr>
            )}
            {/* Cost row */}
            <tr>
              <td className="sticky left-0 z-10 bg-card px-3 py-3 text-xs text-muted-foreground">
                費用
              </td>
              {venues.map((v) => {
                const cost = v.latestEstimateTotal ?? v.costMax ?? v.costMin;
                const isWinner = winners.cost_value === v.id;
                return (
                  <td
                    key={v.id}
                    className={cn(
                      "relative px-2 py-3 text-center text-sm tabular-nums transition-colors",
                      isWinner &&
                        "bg-[color-mix(in_oklab,var(--gold-warm)_10%,transparent)] text-[var(--gold-warm)] font-medium before:absolute before:left-2 before:right-2 before:top-0 before:h-[2px] before:bg-[var(--gold-warm)] before:content-['']",
                    )}
                    aria-label={isWinner ? `${formatYen(cost)} 費用 1 位` : undefined}
                  >
                    {formatYen(cost)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        </div>
        {/* Right-edge fade to hint horizontal scroll */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-background to-transparent"
        />
      </div>
      )}

      {/* Winners summary — "観点ごとのベスト" */}
      <div
        className="relative overflow-hidden rounded-2xl p-5"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 10%, var(--background)) 0%, color-mix(in oklab, var(--primary) 5%, var(--background)) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
        }}
      >
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]">
          観点ごとのベスト
        </p>

        {winners.total && (
          <div
            className="mt-3 rounded-xl border border-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)] bg-[color-mix(in_oklab,var(--card)_85%,var(--background))] p-3"
          >
            <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">総合</p>
            <p className="mt-0.5 font-[family-name:var(--font-display)] text-[17px] font-light text-foreground">
              ◎ {venues.find((v) => v.id === winners.total)?.name}
            </p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-y-2.5 gap-x-4">
          {dimensions.map((dim) => {
            const winnerId = winners[dim.id];
            const winnerName = venues.find((v) => v.id === winnerId)?.name;
            if (!winnerName) return null;
            return (
              <div key={dim.id} className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {dim.label}
                </span>
                <span className="font-[family-name:var(--font-display)] text-[13.5px] font-light text-foreground truncate">
                  {winnerName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI ひとこと分析 — progressive; card appears once Claude (or template) returns */}
      <AnimatePresence>
        {insight && (
          <motion.div
            key="ai-insight"
            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: LUXURY_EASE }}
            className="rounded-2xl border-l-[3px] border-l-[var(--gold-warm)] bg-[var(--gold-subtle)] p-5"
            role="article"
            aria-label="AI によるひとこと分析"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold-warm)]/10">
                <Sparkles
                  aria-hidden="true"
                  className="h-4 w-4 text-[var(--gold-warm)]"
                  strokeWidth={1.5}
                />
              </div>
              <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]">
                AI のひとこと分析
              </p>
            </div>

            <p className="mt-3 text-[13.5px] leading-[1.7] text-foreground">
              {insight.summary}
            </p>

            {insight.nextActions.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {insight.nextActions.map((action, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12.5px] leading-relaxed text-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 block h-1 w-1 shrink-0 rounded-full bg-[var(--gold-warm)]"
                    />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            )}

            {insight.fallback && (
              <p className="mt-3 text-[10.5px] text-muted-foreground/80">
                ※ AI 分析が一時的に使えないため、簡易分析を表示しています
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
