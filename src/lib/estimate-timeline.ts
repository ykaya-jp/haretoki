/**
 * Pure helpers for the Estimate Timeline view.
 *
 * The timeline visualises how an `Estimate` for one venue evolved across
 * versions (v1 → v2 → v3 …). We keep the math in a side-effect-free
 * module so it can be unit-tested without React, Recharts, or Prisma.
 *
 * Version numbering: `Estimate.version` starts at 1 and is incremented
 * on each `createEstimate` call (see src/server/actions/estimates.ts).
 * The server returns them in `version desc` order, so consumers may
 * pass them in any order — `buildTimelinePoints` re-sorts ascending.
 */

/** Minimum shape required from a persisted EstimateItem. */
export type TimelineItemInput = {
  category: string;
  amount: number;
};

/** Minimum shape required from a persisted Estimate. */
export type TimelineEstimateInput = {
  id: string;
  version: number;
  total: number;
  createdAt: Date | string;
  items: TimelineItemInput[];
};

/** A single node on the horizontal timeline. */
export type TimelinePoint = {
  id: string;
  version: number;
  total: number;
  createdAt: Date;
  /** Per-category totals (missing categories coerced to 0). */
  categoryTotals: Record<string, number>;
  /** `total - previousTotal`. `null` for the first point. */
  deltaFromPrev: number | null;
};

/** Per-category breakdown of how much moved between two adjacent versions. */
export type CategoryDelta = {
  category: string;
  from: number;
  to: number;
  delta: number;
};

/** Summary across the whole timeline (first vs last point). */
export type TimelineSummary = {
  firstVersion: number;
  lastVersion: number;
  firstTotal: number;
  lastTotal: number;
  totalDelta: number;
  percentChange: number;
};

/**
 * Convert a list of estimates into ordered timeline points.
 *
 * - Sorts ascending by `version` (ties broken by `createdAt`).
 * - `categoryTotals` sums every `EstimateItem.amount` per category.
 *   Missing items for a category default to 0 by simply not existing
 *   in the record — downstream code uses `?? 0` when comparing across
 *   points. This matches the spec: "値がない EstimateItem は 0 円として扱う".
 * - `deltaFromPrev` is absolute yen difference against the previous point.
 */
export function buildTimelinePoints(
  estimates: TimelineEstimateInput[],
): TimelinePoint[] {
  const sorted = [...estimates].sort((a, b) => {
    if (a.version !== b.version) return a.version - b.version;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return sorted.map((est, idx) => {
    const categoryTotals: Record<string, number> = {};
    for (const item of est.items) {
      categoryTotals[item.category] =
        (categoryTotals[item.category] ?? 0) + item.amount;
    }
    const prev = idx > 0 ? sorted[idx - 1].total : null;
    return {
      id: est.id,
      version: est.version,
      total: est.total,
      createdAt: new Date(est.createdAt),
      categoryTotals,
      deltaFromPrev: prev == null ? null : est.total - prev,
    };
  });
}

/**
 * Compute the per-category delta between two timeline points.
 *
 * Categories present in either side are surfaced; missing categories
 * contribute 0. Sorted by absolute delta so the biggest movers come
 * first — this is what the UI needs for the collapsed breakdown list.
 */
export function computeCategoryDeltas(
  from: TimelinePoint,
  to: TimelinePoint,
): CategoryDelta[] {
  const keys = new Set<string>([
    ...Object.keys(from.categoryTotals),
    ...Object.keys(to.categoryTotals),
  ]);
  const rows: CategoryDelta[] = [];
  for (const category of keys) {
    const f = from.categoryTotals[category] ?? 0;
    const t = to.categoryTotals[category] ?? 0;
    if (f === 0 && t === 0) continue;
    rows.push({ category, from: f, to: t, delta: t - f });
  }
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return rows;
}

/**
 * Summarise the span between the first and last timeline points.
 *
 * Returns `null` when fewer than two points exist — a single-version
 * timeline has no story to tell and the UI should hide the section.
 */
export function summariseTimeline(
  points: TimelinePoint[],
): TimelineSummary | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const totalDelta = last.total - first.total;
  // Guard against division by zero even though Estimate.total is
  // constrained to positive in zod — defensive because the helper is
  // pure and may be reused elsewhere.
  const percentChange =
    first.total === 0 ? 0 : (totalDelta / first.total) * 100;
  return {
    firstVersion: first.version,
    lastVersion: last.version,
    firstTotal: first.total,
    lastTotal: last.total,
    totalDelta,
    percentChange,
  };
}

/**
 * Format a signed yen delta for UI display.
 *
 * - +15万円 / −8万円 / ±0万円
 * - Uses U+2212 (minus sign) rather than hyphen-minus for proper
 *   typographic rendering with tabular-nums.
 * - Rounds to the nearest 万 (10,000 yen). Sub-万 deltas still show
 *   as 0万円 with the sign preserved.
 */
export function formatDeltaMan(deltaYen: number): string {
  const man = Math.round(deltaYen / 10000);
  if (man === 0) return "±0万円";
  const sign = man > 0 ? "+" : "\u2212";
  return `${sign}${Math.abs(man)}万円`;
}
