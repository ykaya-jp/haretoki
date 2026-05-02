import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * R2 — getReviewSummariesForVenues server action contract.
 *
 * Pinned guarantees:
 *   1. Single `prisma.review.findMany` call regardless of venue count
 *      (= the N+1 prevention contract — 10-venue compare board must
 *      stay 1 query, not 10).
 *   2. Empty input returns an empty Map without touching prisma.
 *   3. Venue-scoped grouping: a row tagged venueId=A never bleeds into
 *      venueId=B's aggregate.
 *   4. Venues with no reviews still appear in the Map with the
 *      "no reviews yet" shape.
 */

const findManyMock = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    review: { findMany: (q: unknown) => findManyMock(q) },
  },
}));

// requireUser / requireProjectMembership aren't called by this helper —
// caller (getComparisonMatrix) already validates. We still mock them so
// nothing else in the module file blows up at import time if it ever
// gains a top-level reference.
vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(),
  requireProjectMembership: vi.fn(),
}));

// Anthropic SDK + cache adapter are inert here — the only function we
// import is getReviewSummariesForVenues, but the file's other exports
// reference these modules at import time.
vi.mock("@/lib/anthropic", () => ({
  isClaudeAvailable: () => false,
  askClaude: vi.fn(),
  withRetry: vi.fn(),
  computeInputHash: vi.fn(() => "stub"),
}));
vi.mock("@/server/ai/cache", () => ({
  getCachedAnalysis: vi.fn(),
  setCachedAnalysis: vi.fn(),
}));

import { getReviewSummariesForVenues } from "@/server/actions/comparison";

describe("getReviewSummariesForVenues", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("returns an empty Map without querying when input is empty", async () => {
    const out = await getReviewSummariesForVenues([]);
    expect(out.size).toBe(0);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("issues exactly ONE prisma.review.findMany regardless of venue count (no N+1)", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getReviewSummariesForVenues(["v1", "v2", "v3", "v4", "v5"]);
    expect(findManyMock).toHaveBeenCalledTimes(1);
    const arg = findManyMock.mock.calls[0]?.[0] as {
      where: { venueId: { in: string[] } };
    };
    expect(arg.where.venueId.in).toEqual(["v1", "v2", "v3", "v4", "v5"]);
  });

  it("groups rows by venueId without bleed-through", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        venueId: "v1",
        aiSummary: "v1 の要約",
        sentiment: { overall: 0.6 },
        categorySummary: {
          positiveHighlights: ["v1 の強み"],
          negativeHighlights: ["v1 の懸念"],
        },
        fetchedAt: new Date("2026-04-01"),
      },
      {
        venueId: "v2",
        aiSummary: "v2 の要約",
        sentiment: { overall: 0.2 },
        categorySummary: {
          positiveHighlights: ["v2 の強み"],
          negativeHighlights: ["v2 の懸念"],
        },
        fetchedAt: new Date("2026-04-01"),
      },
      // Second v1 row — older — should not override the latest summary
      {
        venueId: "v1",
        aiSummary: "v1 の古い要約",
        sentiment: { overall: 0.4 },
        categorySummary: { positiveHighlights: ["旧 v1"] },
        fetchedAt: new Date("2026-01-01"),
      },
    ]);

    const out = await getReviewSummariesForVenues(["v1", "v2"]);

    const v1 = out.get("v1");
    const v2 = out.get("v2");
    expect(v1?.summary).toBe("v1 の要約");
    expect(v1?.strengths).toEqual(["v1 の強み"]);
    expect(v1?.count).toBe(2);
    // Average of 0.6 and 0.4 = 0.5
    expect(v1?.sentimentAvg).toBe(0.5);

    expect(v2?.summary).toBe("v2 の要約");
    expect(v2?.strengths).toEqual(["v2 の強み"]);
    expect(v2?.concerns).toEqual(["v2 の懸念"]);
    expect(v2?.count).toBe(1);
  });

  it("includes venues with no review rows as 'no reviews yet' entries", async () => {
    // v3 has no rows in the DB result; the Map should still contain a
    // populated empty-shape entry so the UI can read it without
    // null-checking the Map miss separately.
    findManyMock.mockResolvedValueOnce([
      {
        venueId: "v1",
        aiSummary: "v1 のみ",
        sentiment: { overall: 0.5 },
        categorySummary: null,
        fetchedAt: new Date("2026-04-01"),
      },
    ]);

    const out = await getReviewSummariesForVenues(["v1", "v2", "v3"]);
    expect(out.size).toBe(3);
    expect(out.get("v2")).toEqual({
      summary: null,
      strengths: [],
      concerns: [],
      count: 0,
      sentimentAvg: null,
    });
    expect(out.get("v3")).toEqual({
      summary: null,
      strengths: [],
      concerns: [],
      count: 0,
      sentimentAvg: null,
    });
  });
});
