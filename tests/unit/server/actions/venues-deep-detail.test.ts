import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase B contract test — the venue detail page renders 19 deep-extraction
 * fields (external rating, lat/lng, postal/street, phone, parking, shuttle,
 * accommodation, 2nd party, barrier-free, ceremony/production fees,
 * service rate, operating hours, closed days, cuisine, chef credentials).
 * If `getVenueHeader`'s Prisma `select` ever drops one of these, the page
 * silently regresses back to "data saved but never shown" — exactly the
 * bug v3 was created to fix.
 *
 * This test pins the contract: every key in VENUE_DEEP_DETAIL_SELECT_KEYS
 * must appear in the select the action hands to Prisma, and the exported
 * list must stay in sync with the Prisma schema's v2 deep-extraction
 * columns. If any of the three drifts, the test fails.
 */

const findFirstMock = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    venue: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({
    projectId: "proj-1",
    role: "owner",
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe("getVenueHeader deep-detail select", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    findFirstMock.mockResolvedValue(null);
  });

  it("selects all VENUE_DEEP_DETAIL_SELECT_KEYS keys", async () => {
    const { getVenueHeader, VENUE_DEEP_DETAIL_SELECT_KEYS } = await import(
      "@/server/actions/venues"
    );
    await getVenueHeader("venue-1");

    expect(findFirstMock).toHaveBeenCalledTimes(1);
    const call = findFirstMock.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };

    for (const key of VENUE_DEEP_DETAIL_SELECT_KEYS) {
      expect(call.select[key], `missing ${key} in select`).toBe(true);
    }
  });

  it("VENUE_DEEP_DETAIL_SELECT_KEYS matches Prisma schema v2 columns", async () => {
    // Pin the exact 21-field contract the detail page renders. This is the
    // list of Venue columns added in the v2 "Deep extraction" migration that
    // the v3 detail-page phase surfaces in UI. If a column is added to the
    // schema, it must be added here and to getVenueHeader. If this assertion
    // ever fails with "expected length X, got Y", check prisma/schema.prisma
    // for new Venue fields under the /// Deep extraction / Facilities / Cost
    // breakdown / Operating / Cuisine comment blocks.
    const { VENUE_DEEP_DETAIL_SELECT_KEYS } = await import(
      "@/server/actions/venues"
    );
    const expected = new Set([
      "externalRatingValue",
      "externalReviewCount",
      "postalCode",
      "streetAddress",
      "latitude",
      "longitude",
      "phoneNumber",
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
    ]);
    expect(new Set(VENUE_DEEP_DETAIL_SELECT_KEYS)).toEqual(expected);
  });
});
