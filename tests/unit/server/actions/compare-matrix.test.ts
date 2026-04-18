/**
 * Tests for getComparisonMatrix.
 *
 * Guards the contract that the Prisma select includes all Deep Extraction
 * columns the /compare grid relies on. If any column is dropped from the
 * select in checklist.ts, this test will catch it before the board renders
 * empty cells in production.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({ projectId: "project-1" })),
  requireVenueAccess: vi.fn(async () => ({ projectId: "project-1" })),
}));

const venueFindMany = vi.fn();
const projectChecklistFindMany = vi.fn();
const answerFindMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    venue: { findMany: (...args: unknown[]) => venueFindMany(...args) },
    projectChecklist: {
      findMany: (...args: unknown[]) => projectChecklistFindMany(...args),
    },
    venueChecklistAnswer: {
      findMany: (...args: unknown[]) => answerFindMany(...args),
    },
  },
}));

import { getComparisonMatrix } from "@/server/actions/checklist";
import { COMPARE_MAX_VENUES } from "@/lib/comparison-types";

describe("getComparisonMatrix — Deep Extraction fields", () => {
  beforeEach(() => {
    venueFindMany.mockReset();
    projectChecklistFindMany.mockReset().mockResolvedValue([]);
    answerFindMany.mockReset().mockResolvedValue([]);
  });

  it("selects all 19+ Deep Extraction columns (contract guard)", async () => {
    venueFindMany.mockResolvedValue([]);

    await getComparisonMatrix(["v-1"]);

    expect(venueFindMany).toHaveBeenCalledOnce();
    const selectArg = venueFindMany.mock.calls[0][0].select;

    // These are the columns the /compare board reads — if any one is
    // dropped from the select the board falls back to empty cells with no
    // runtime error, which is exactly the bug Phase 1 surfaced.
    const required = [
      "id",
      "name",
      "location",
      "accessInfo",
      "photoUrls",
      "costMin",
      "costMax",
      "capacityMin",
      "capacityMax",
      "ceremonyStyles",
      "externalRatingValue",
      "externalReviewCount",
      "postalCode",
      "streetAddress",
      "hasParking",
      "parkingCapacity",
      "hasShuttle",
      "hasAccommodation",
      "acceptsSecondParty",
      "barrierFree",
      "ceremonyFeeExact",
      "productionFeeMin",
      "productionFeeMax",
      "serviceFeeRate",
      "operatingHours",
      "closedDays",
      "cuisineTypes",
      "chefCredentials",
    ];
    for (const key of required) {
      expect(selectArg[key], `select should include ${key}`).toBe(true);
    }
  });

  it("converts Decimal serviceFeeRate to a plain number", async () => {
    venueFindMany.mockResolvedValue([
      {
        id: "v-1",
        name: "式場A",
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
        // Prisma returns Decimal — Number("0.1") coerces cleanly for us.
        serviceFeeRate: "0.1",
        operatingHours: null,
        closedDays: [],
        cuisineTypes: [],
        chefCredentials: null,
        scores: [],
      },
    ]);

    const matrix = await getComparisonMatrix(["v-1"]);
    expect(matrix.venues[0].serviceFeeRate).toBe(0.1);
  });

  it("preserves the caller's requested venue order", async () => {
    venueFindMany.mockResolvedValue([
      {
        id: "b",
        name: "B",
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
        scores: [],
      },
      {
        id: "a",
        name: "A",
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
        scores: [],
      },
    ]);

    const matrix = await getComparisonMatrix(["a", "b"]);
    expect(matrix.venues.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("clamps to COMPARE_MAX_VENUES (= 10)", async () => {
    venueFindMany.mockResolvedValue([]);
    const tooMany = Array.from({ length: 15 }, (_, i) => `v-${i}`);
    await getComparisonMatrix(tooMany);

    const whereArg = venueFindMany.mock.calls[0][0].where;
    expect(whereArg.id.in.length).toBe(COMPARE_MAX_VENUES);
    expect(COMPARE_MAX_VENUES).toBe(10);
  });
});
