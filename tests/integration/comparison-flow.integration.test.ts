/**
 * Integration — comparison flow chain.
 *
 * Verifies that the cross-action chain
 *   getMatrixData (favorites → matrix venues)
 *   → getComparisonMatrix (matrix venues → /compare board)
 *   → deriveProsCons (per-venue scores → top-2 / bottom-2 dimensions)
 * stays internally consistent on a shared underlying venue set.
 *
 * "Consistent" here means:
 *   - The same venue id surfaces in every layer for a given selection.
 *   - The score map fed into deriveProsCons matches what
 *     getComparisonMatrix exposes via ComparisonVenue.scores.
 *   - venueIds passed via URL param flow into getComparisonMatrix's
 *     `where.id.in` clause without re-ordering or filtering.
 *
 * Why integration vs unit: the unit suites already pin individual
 * action behaviour. This file pins the *contract between actions* —
 * the joints where a small shape drift (e.g. matrix returns "venueId"
 * but comparison expects "id") would silently break the /compare
 * board even though every unit test stays green.
 *
 * Mocks: prisma + auth at the module boundary, identical pattern to
 * the unit tests in tests/unit/server/actions/. No real DB; no Claude.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------

const mockFavoriteFindMany = vi.fn();
const mockVenueFindMany = vi.fn();
const mockProjectChecklistFindMany = vi.fn();
const mockAnswerFindMany = vi.fn();
const mockReviewFindMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    venueFavorite: {
      findMany: (...args: unknown[]) => mockFavoriteFindMany(...args),
    },
    venue: {
      findMany: (...args: unknown[]) => mockVenueFindMany(...args),
    },
    projectChecklist: {
      findMany: (...args: unknown[]) => mockProjectChecklistFindMany(...args),
    },
    venueChecklistAnswer: {
      findMany: (...args: unknown[]) => mockAnswerFindMany(...args),
    },
    review: {
      findMany: (...args: unknown[]) => mockReviewFindMany(...args),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({
    projectId: "proj-1",
    role: "owner",
  })),
  requireVenueAccess: vi.fn(async () => ({ projectId: "proj-1" })),
}));

import { getMatrixData } from "@/server/actions/matrix";
import { getComparisonMatrix } from "@/server/actions/checklist";
import { deriveProsCons, scoresToMap } from "@/lib/venue-pros-cons";
import { TIER1_DIMENSIONS } from "@/lib/constants";

// --- Fixtures --------------------------------------------------------------

/** A "high cuisine, low cost" venue and a "low cuisine, high cost"
 *  venue so the pros/cons derivation has both ≥4.0 and ≤2.5 hits. */
const VENUE_A_SCORES = [
  { dimension: "cuisine", score: 4.5, source: "user_rating" },
  { dimension: "ceremony_space", score: 4.2, source: "user_rating" },
  { dimension: "cost_contract", score: 2.0, source: "user_rating" },
  { dimension: "logistics", score: 3.5, source: "user_rating" },
];
const VENUE_B_SCORES = [
  { dimension: "cuisine", score: 2.3, source: "user_rating" },
  { dimension: "ceremony_space", score: 3.0, source: "user_rating" },
  { dimension: "cost_contract", score: 4.6, source: "user_rating" },
  { dimension: "logistics", score: 4.1, source: "user_rating" },
];

const MATRIX_FAVORITES = [
  {
    venue: {
      id: "venue-a",
      name: "式場A",
      photoUrls: ["https://cdn.example/a.jpg"],
      scores: VENUE_A_SCORES,
      estimates: [],
      visits: [],
      costMin: 3_000_000,
      costMax: 4_000_000,
      dressBringIn: "allowed",
      dressBringInFee: 0,
      paymentMethodEnums: ["cash"],
      maxInstallments: null,
    },
  },
  {
    venue: {
      id: "venue-b",
      name: "式場B",
      photoUrls: ["https://cdn.example/b.jpg"],
      scores: VENUE_B_SCORES,
      estimates: [],
      visits: [],
      costMin: 2_500_000,
      costMax: 3_500_000,
      dressBringIn: "negotiable",
      dressBringInFee: 30_000,
      paymentMethodEnums: ["cash", "credit"],
      maxInstallments: 6,
    },
  },
];

/** Comparison-shaped row — every Deep Extraction column nullable so
 *  the test stays focused on the score chain, not the row shape. */
function comparisonRow(id: string, name: string, scores: typeof VENUE_A_SCORES) {
  return {
    id,
    name,
    location: null,
    accessInfo: null,
    photoUrls: [],
    costMin: null,
    costMax: null,
    capacityMin: null,
    capacityMax: null,
    ceremonyStyles: [],
    externalRatingValue: null,
    externalReviewCount: null,
    postalCode: null,
    streetAddress: null,
    hasParking: null,
    parkingCapacity: null,
    hasShuttle: null,
    hasAccommodation: null,
    acceptsSecondParty: null,
    barrierFree: null,
    ceremonyFeeExact: null,
    productionFeeMin: null,
    productionFeeMax: null,
    serviceFeeRate: null,
    operatingHours: null,
    closedDays: [],
    cuisineTypes: [],
    chefCredentials: null,
    scores,
  };
}

beforeEach(() => {
  mockFavoriteFindMany.mockReset();
  mockVenueFindMany.mockReset();
  mockProjectChecklistFindMany.mockReset().mockResolvedValue([]);
  mockAnswerFindMany.mockReset().mockResolvedValue([]);
  mockReviewFindMany.mockReset().mockResolvedValue([]);
});

describe("comparison flow chain — getMatrixData → getComparisonMatrix → deriveProsCons", () => {
  it("returns the same venue set across getMatrixData and getComparisonMatrix", async () => {
    mockFavoriteFindMany.mockResolvedValue(MATRIX_FAVORITES);
    mockVenueFindMany.mockResolvedValue([
      comparisonRow("venue-a", "式場A", VENUE_A_SCORES),
      comparisonRow("venue-b", "式場B", VENUE_B_SCORES),
    ]);

    const matrix = await getMatrixData();
    const matrixIds = matrix.venues.map((v) => v.id);

    // The user clicked "比べる" on every favourite — feed those ids back
    // into getComparisonMatrix the same way the /compare page does.
    const compareMatrix = await getComparisonMatrix(matrixIds);
    const compareIds = compareMatrix.venues.map((v) => v.id);

    expect(matrixIds).toEqual(["venue-a", "venue-b"]);
    expect(compareIds).toEqual(matrixIds);
  });

  it("derives pros/cons from the same score map getComparisonMatrix exposes", async () => {
    mockFavoriteFindMany.mockResolvedValue(MATRIX_FAVORITES);
    mockVenueFindMany.mockResolvedValue([
      comparisonRow("venue-a", "式場A", VENUE_A_SCORES),
      comparisonRow("venue-b", "式場B", VENUE_B_SCORES),
    ]);

    await getMatrixData();
    const compare = await getComparisonMatrix(["venue-a", "venue-b"]);

    const venueA = compare.venues.find((v) => v.id === "venue-a")!;
    const aMap = scoresToMap(venueA.scores);
    const aProsCons = deriveProsCons(aMap);

    // venue-a: cuisine 4.5, ceremony 4.2 → pros (both ≥ 4.0)
    //          cost_contract 2.0 → cons (≤ 2.5); logistics 3.5 excluded.
    expect(aProsCons.pros.map((p) => p.dim)).toEqual([
      "cuisine",
      "ceremony_space",
    ]);
    expect(aProsCons.cons.map((c) => c.dim)).toEqual(["cost_contract"]);
  });

  it("passes venueIds straight through to prisma.venue.findMany.where.id.in", async () => {
    mockFavoriteFindMany.mockResolvedValue(MATRIX_FAVORITES);
    mockVenueFindMany.mockResolvedValue([]);

    const requested = ["venue-b", "venue-a"]; // user re-ordered on /compare

    await getComparisonMatrix(requested);

    expect(mockVenueFindMany).toHaveBeenCalled();
    const where = mockVenueFindMany.mock.calls[0][0].where as {
      id: { in: string[] };
    };
    expect(where.id.in).toEqual(requested);
  });

  it("preserves caller venue order through the comparison response", async () => {
    mockFavoriteFindMany.mockResolvedValue(MATRIX_FAVORITES);
    // Prisma may return rows in any order; the action must restore the
    // caller's requested order. Simulate "wrong" prisma order.
    mockVenueFindMany.mockResolvedValue([
      comparisonRow("venue-a", "式場A", VENUE_A_SCORES),
      comparisonRow("venue-b", "式場B", VENUE_B_SCORES),
    ]);

    const compare = await getComparisonMatrix(["venue-b", "venue-a"]);
    expect(compare.venues.map((v) => v.id)).toEqual(["venue-b", "venue-a"]);
  });

  it("matrix winners point to ids that survive into getComparisonMatrix", async () => {
    mockFavoriteFindMany.mockResolvedValue(MATRIX_FAVORITES);
    mockVenueFindMany.mockResolvedValue([
      comparisonRow("venue-a", "式場A", VENUE_A_SCORES),
      comparisonRow("venue-b", "式場B", VENUE_B_SCORES),
    ]);

    const matrix = await getMatrixData();
    const compare = await getComparisonMatrix(matrix.venues.map((v) => v.id));

    // Every winner id must still exist in the comparison venue set —
    // otherwise the /compare board would highlight a venue that's not
    // even in the grid.
    const compareIds = new Set(compare.venues.map((v) => v.id));
    for (const winnerId of Object.values(matrix.winners)) {
      expect(compareIds.has(winnerId)).toBe(true);
    }
  });

  it("matrix totalScore averaged across all 8 TIER1 dimensions (null-safe)", async () => {
    mockFavoriteFindMany.mockResolvedValue(MATRIX_FAVORITES);

    const matrix = await getMatrixData();
    const venueA = matrix.venues.find((v) => v.id === "venue-a")!;

    // venue-a has 4 of 8 dimensions populated (cuisine 4.5, ceremony 4.2,
    // cost_contract 2.0, logistics 3.5). Average = 14.2 / 4 = 3.55 → 3.6.
    expect(venueA.totalScore).toBe(3.6);
    // Every TIER1 dimension key is present; missing → null (not 0).
    for (const dim of TIER1_DIMENSIONS) {
      expect(venueA.scoresByDimension).toHaveProperty(dim);
    }
    expect(venueA.scoresByDimension.attire_items).toBeNull();
  });
});
