import { describe, it, expect } from "vitest";
import { buildVenueWhere } from "@/server/actions/venue-filters";

const PROJECT_ID = "proj-test";

/**
 * Simulate Prisma's numeric comparison semantics locally so we can assert the
 * *intent* of `buildVenueWhere` without booting a real database. Prisma
 * excludes rows whose column is null for `gte`/`lte`/`equals` comparisons —
 * we replicate that here.
 */
function matchesFeeConstraint(
  fee: number | null,
  constraint: { equals?: number; gte?: number; lte?: number } | undefined
): boolean {
  if (!constraint) return true;
  if (fee === null) return false;
  if (constraint.equals !== undefined && fee !== constraint.equals) return false;
  if (constraint.gte !== undefined && fee < constraint.gte) return false;
  if (constraint.lte !== undefined && fee > constraint.lte) return false;
  return true;
}

describe("buildVenueWhere — dress bring-in fee", () => {
  it("scopes every query to the current projectId", () => {
    const where = buildVenueWhere(PROJECT_ID);
    expect(where.projectId).toBe(PROJECT_ID);
  });

  it("emits no dressBringInFee constraint when the filter is absent", () => {
    const where = buildVenueWhere(PROJECT_ID, {});
    expect(where.dressBringInFee).toBeUndefined();
  });

  it("[boundary] '無料のみ' restricts fee to equals: 0 (null rows excluded)", () => {
    const where = buildVenueWhere(PROJECT_ID, { dressBringInFeeFreeOnly: true });
    expect(where.dressBringInFee).toEqual({ equals: 0 });

    const constraint = where.dressBringInFee as { equals?: number };
    expect(matchesFeeConstraint(0, constraint)).toBe(true);
    expect(matchesFeeConstraint(10_000, constraint)).toBe(false);
    // Null row (unknown fee) is excluded — matches Prisma semantics.
    expect(matchesFeeConstraint(null, constraint)).toBe(false);
  });

  it("[range] min=10000 + max=50000 produces { gte, lte } merged into one object", () => {
    const where = buildVenueWhere(PROJECT_ID, {
      dressBringInFeeMin: 10_000,
      dressBringInFeeMax: 50_000,
    });
    expect(where.dressBringInFee).toEqual({ gte: 10_000, lte: 50_000 });

    const c = where.dressBringInFee as { gte: number; lte: number };
    expect(matchesFeeConstraint(10_000, c)).toBe(true); // inclusive lower
    expect(matchesFeeConstraint(30_000, c)).toBe(true);
    expect(matchesFeeConstraint(50_000, c)).toBe(true); // inclusive upper
    expect(matchesFeeConstraint(9_000, c)).toBe(false);
    expect(matchesFeeConstraint(51_000, c)).toBe(false);
  });

  it("[null handling] a null-fee row is excluded whenever any numeric fee filter is set", () => {
    const minOnly = buildVenueWhere(PROJECT_ID, { dressBringInFeeMin: 20_000 });
    expect(minOnly.dressBringInFee).toEqual({ gte: 20_000 });
    expect(
      matchesFeeConstraint(null, minOnly.dressBringInFee as { gte: number })
    ).toBe(false);

    const maxOnly = buildVenueWhere(PROJECT_ID, { dressBringInFeeMax: 100_000 });
    expect(maxOnly.dressBringInFee).toEqual({ lte: 100_000 });
    expect(
      matchesFeeConstraint(null, maxOnly.dressBringInFee as { lte: number })
    ).toBe(false);
  });

  it("'要相談を含む' unions negotiable rows with the numeric-fee branch via OR", () => {
    const where = buildVenueWhere(PROJECT_ID, {
      dressBringInFeeMax: 50_000,
      dressBringInIncludeNegotiable: true,
    });
    expect(where.dressBringInFee).toBeUndefined();
    expect(where.OR).toEqual([
      { dressBringInFee: { lte: 50_000 } },
      { dressBringIn: "negotiable" },
    ]);
  });

  it("[boundary] reviewEstimateDeltaPctMax emits lte constraint (null rows excluded)", () => {
    const where = buildVenueWhere(PROJECT_ID, {
      reviewEstimateDeltaPctMax: 25,
    });
    expect(where.reviewEstimateDeltaPct).toEqual({ lte: 25 });
    // No explicit sample-count gate when only pct cap is set.
    expect(where.reviewEstimateSampleCount).toBeUndefined();
  });

  it("[boundary] reviewEstimateMinSampleCount emits gte constraint independently", () => {
    const where = buildVenueWhere(PROJECT_ID, {
      reviewEstimateMinSampleCount: 3,
    });
    expect(where.reviewEstimateSampleCount).toEqual({ gte: 3 });
    expect(where.reviewEstimateDeltaPct).toBeUndefined();
  });

  it("[boundary] both pct cap + sample-count gate compose independently", () => {
    const where = buildVenueWhere(PROJECT_ID, {
      reviewEstimateDeltaPctMax: 20,
      reviewEstimateMinSampleCount: 3,
    });
    expect(where.reviewEstimateDeltaPct).toEqual({ lte: 20 });
    expect(where.reviewEstimateSampleCount).toEqual({ gte: 3 });
  });

  it("'要相談を含む' without a numeric range leaves the clause unconstrained (or OR-widens the status filter)", () => {
    const plain = buildVenueWhere(PROJECT_ID, {
      dressBringInIncludeNegotiable: true,
    });
    expect(plain.dressBringInFee).toBeUndefined();
    expect(plain.OR).toBeUndefined();

    const withStatus = buildVenueWhere(PROJECT_ID, {
      dressBringIn: "allowed",
      dressBringInIncludeNegotiable: true,
    });
    expect(withStatus.dressBringIn).toBeUndefined();
    expect(withStatus.OR).toEqual([
      { dressBringIn: "allowed" },
      { dressBringIn: "negotiable" },
    ]);
  });
});
