/**
 * Pure filter-composition logic for venue queries.
 *
 * Kept separate from `venues.ts` so that the Prisma `where`-clause builder can
 * be unit-tested without loading the Prisma client (which requires a live
 * DATABASE_URL at module-init time).
 */

import type { PaymentMethod } from "@/lib/payment";

export interface VenueFilters {
  status?: string;
  minScore?: number;
  dimensionMinScore?: { dimension: string; score: number };
  costMin?: number;
  costMax?: number;
  dressBringIn?: string;
  /** Lower bound (yen, inclusive) for dressBringInFee. */
  dressBringInFeeMin?: number;
  /** Upper bound (yen, inclusive) for dressBringInFee. */
  dressBringInFeeMax?: number;
  /** When true, restrict to venues with dressBringInFee === 0 (excludes null/unknown). */
  dressBringInFeeFreeOnly?: boolean;
  /** When true, also include venues whose dressBringIn status is "negotiable", regardless of fee. */
  dressBringInIncludeNegotiable?: boolean;
  /**
   * @deprecated Use `paymentMethodEnums` instead. Kept for backward compat with
   * old URL params / saved views during the R1.5c → R2 transition. When set,
   * falls back to a `has` match against the legacy free-text `paymentMethods`
   * column so pre-migration rows remain queryable.
   */
  paymentMethod?: string;
  /** Canonical multi-select filter over `Venue.paymentMethodEnums`. */
  paymentMethodEnums?: PaymentMethod[];
  /** Lower bound (inclusive) on `Venue.maxInstallments` — "分割 N 回以上". */
  maxInstallmentsMin?: number;
  /**
   * Cap on review-derived estimate-increase percent (`Venue.reviewEstimateDeltaPct`).
   * When set, venues with null deltaPct are implicitly excluded (Prisma `lte` semantics).
   */
  reviewEstimateDeltaPctMax?: number;
  /**
   * Minimum sample count (`Venue.reviewEstimateSampleCount`) required for the
   * review-delta aggregate to be considered trustworthy. Defaults to unset —
   * callers typically pass 3 when the UI toggle is on.
   */
  reviewEstimateMinSampleCount?: number;
  sortBy?:
    | "score_desc"
    | "cost_asc"
    | "cost_desc"
    | "created_desc"
    | "review_delta_asc";
  query?: string;
  // Onboarding-derived personalization filters
  styles?: string[];
  areas?: string[];
  guestCount?: number;
  budgetMax?: number;
}

/**
 * Build the Prisma `where` clause for venue queries.
 *
 * Null-handling note: Prisma numeric comparisons like `{ gte, lte, equals }`
 * implicitly exclude rows whose column is null, which matches our intent —
 * venues with an unknown `dressBringInFee` should be omitted when the user
 * actively applies a numeric filter.
 */
export function buildVenueWhere(
  projectId: string,
  filters?: VenueFilters
): Record<string, unknown> {
  const where: Record<string, unknown> = { projectId };

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.costMin !== undefined) {
    where.costMin = { gte: filters.costMin };
  }
  if (filters?.costMax !== undefined) {
    where.costMax = { lte: filters.costMax };
  }

  // Dress bring-in fee range — merge gte/lte/equals into a single object.
  const feeConstraint: Record<string, number> = {};
  if (filters?.dressBringInFeeFreeOnly) {
    feeConstraint.equals = 0;
  } else {
    if (filters?.dressBringInFeeMin !== undefined) {
      feeConstraint.gte = filters.dressBringInFeeMin;
    }
    if (filters?.dressBringInFeeMax !== undefined) {
      feeConstraint.lte = filters.dressBringInFeeMax;
    }
  }
  const hasFeeConstraint = Object.keys(feeConstraint).length > 0;

  // "要相談を含む" — union a negotiable-status branch with the numeric-fee branch.
  if (filters?.dressBringInIncludeNegotiable && hasFeeConstraint) {
    where.OR = [
      ...(Array.isArray(where.OR) ? (where.OR as unknown[]) : []),
      { dressBringInFee: feeConstraint },
      { dressBringIn: "negotiable" },
    ];
  } else if (hasFeeConstraint) {
    where.dressBringInFee = feeConstraint;
  }

  if (filters?.dressBringIn) {
    // If "include negotiable" is on without a numeric constraint, widen to OR.
    if (
      filters?.dressBringInIncludeNegotiable &&
      !hasFeeConstraint &&
      filters.dressBringIn !== "negotiable"
    ) {
      where.OR = [
        ...(Array.isArray(where.OR) ? (where.OR as unknown[]) : []),
        { dressBringIn: filters.dressBringIn },
        { dressBringIn: "negotiable" },
      ];
    } else {
      where.dressBringIn = filters.dressBringIn;
    }
  }

  if (filters?.paymentMethodEnums && filters.paymentMethodEnums.length > 0) {
    where.paymentMethodEnums = { hasSome: filters.paymentMethodEnums };
  }
  if (filters?.maxInstallmentsMin !== undefined) {
    where.maxInstallments = { gte: filters.maxInstallmentsMin };
  }
  // Legacy free-text path — kept so saved filter states from before R1.5c still
  // work. New UI should populate `paymentMethodEnums` instead.
  if (filters?.paymentMethod) {
    where.paymentMethods = { has: filters.paymentMethod };
  }

  // Review-derived estimate increase constraints.
  // `lte` on reviewEstimateDeltaPct excludes null rows per Prisma semantics,
  // which matches intent: venues without aggregated review data are treated as
  // "unknown" and filtered out once the user opts into this cap.
  if (filters?.reviewEstimateDeltaPctMax !== undefined) {
    where.reviewEstimateDeltaPct = { lte: filters.reviewEstimateDeltaPctMax };
  }
  if (filters?.reviewEstimateMinSampleCount !== undefined) {
    where.reviewEstimateSampleCount = {
      gte: filters.reviewEstimateMinSampleCount,
    };
  }
  if (filters?.query && filters.query.trim().length > 0) {
    const q = filters.query.trim();
    where.OR = [
      ...(Array.isArray(where.OR) ? (where.OR as unknown[]) : []),
      { name: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }
  // Onboarding-derived filters: ceremony styles match-any
  if (filters?.styles && filters.styles.length > 0) {
    where.ceremonyStyles = { hasSome: filters.styles };
  }
  // Guest count fits inside capacity range (allow null endpoints)
  if (filters?.guestCount !== undefined) {
    const count = filters.guestCount;
    where.AND = [
      ...(Array.isArray(where.AND) ? (where.AND as unknown[]) : []),
      { OR: [{ capacityMin: null }, { capacityMin: { lte: count } }] },
      { OR: [{ capacityMax: null }, { capacityMax: { gte: count } }] },
    ];
  }
  // Area: match any of the provided areas against location substring
  if (filters?.areas && filters.areas.length > 0) {
    const areaConds = filters.areas.map((a) => ({
      location: { contains: a, mode: "insensitive" as const },
    }));
    where.AND = [
      ...(Array.isArray(where.AND) ? (where.AND as unknown[]) : []),
      { OR: areaConds },
    ];
  }

  return where;
}
