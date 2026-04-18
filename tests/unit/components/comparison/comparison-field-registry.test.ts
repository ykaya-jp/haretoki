/**
 * Unit tests for the comparison field registry.
 *
 * These tests protect the contract between the Prisma select in
 * `getComparisonMatrix` and the UI renderer. If a Deep Extraction column
 * is renamed or dropped, the accessor here will return `undefined` and
 * the test will catch it before the /compare board renders empty cells.
 */

import { describe, it, expect } from "vitest";
import {
  COMPARE_FIELDS,
  resolveHighlight,
  FIELD_GROUP_LABELS,
} from "@/components/comparison/comparison-field-registry";
import type { ComparisonVenue } from "@/server/actions/checklist";

function makeVenue(overrides: Partial<ComparisonVenue> = {}): ComparisonVenue {
  return {
    id: overrides.id ?? "v-1",
    name: overrides.name ?? "式場A",
    location: null,
    accessInfo: null,
    photoUrls: [],
    scores: [],
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
    ...overrides,
  };
}

describe("comparison-field-registry", () => {
  it("includes all expected groups with labels", () => {
    // Every group that appears in COMPARE_FIELDS must be in FIELD_GROUP_LABELS.
    const groupsInFields = new Set(COMPARE_FIELDS.map((f) => f.group));
    for (const g of groupsInFields) {
      expect(FIELD_GROUP_LABELS[g], `label missing for group ${g}`).toBeTruthy();
    }
  });

  it("has stable field ids (no duplicates)", () => {
    const ids = COMPARE_FIELDS.map((f) => f.id);
    expect(new Set(ids).size, "duplicate field id").toBe(ids.length);
  });

  describe("accessors", () => {
    it("external-rating returns null when no rating", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "external-rating")!;
      expect(f.accessor(makeVenue())).toBeNull();
    });

    it("external-rating returns {value,count} when rating present", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "external-rating")!;
      const v = makeVenue({ externalRatingValue: 4.47, externalReviewCount: 1433 });
      expect(f.accessor(v)).toEqual({ value: 4.47, count: 1433 });
    });

    it("cost-range returns {min,max} shape", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "cost-range")!;
      const v = makeVenue({ costMin: 2_000_000, costMax: 3_500_000 });
      expect(f.accessor(v)).toEqual({ min: 2_000_000, max: 3_500_000 });
    });

    it("parking returns {has,capacity} with both fields", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "parking")!;
      const v = makeVenue({ hasParking: true, parkingCapacity: 30 });
      expect(f.accessor(v)).toEqual({ has: true, capacity: 30 });
    });

    it("parking returns null when hasParking is null (not yet extracted)", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "parking")!;
      expect(f.accessor(makeVenue())).toBeNull();
    });

    it("ceremony-styles maps raw enum values to Japanese labels", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "ceremony-styles")!;
      const v = makeVenue({ ceremonyStyles: ["chapel", "shinto"] });
      const result = f.accessor(v) as string[];
      expect(result.length).toBe(2);
      // Labels come from CEREMONY_STYLE_LABELS — just assert the mapping was
      // applied (value !== raw enum), not the exact copy (which may change).
      expect(result[0]).not.toBe("chapel");
    });

    it("address combines postalCode + streetAddress with 〒 prefix", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "address")!;
      const v = makeVenue({ postalCode: "107-0062", streetAddress: "港区南青山3-14-23" });
      expect(f.accessor(v)).toBe("〒107-0062 港区南青山3-14-23");
    });

    it("address returns null when both parts are missing", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "address")!;
      expect(f.accessor(makeVenue())).toBeNull();
    });
  });

  describe("hasValue predicates", () => {
    it("returns false for all rows when venue has no deep extraction", () => {
      const blank = makeVenue();
      // composite-score is null when scores is empty → hasValue should be false
      for (const f of COMPARE_FIELDS) {
        expect(f.hasValue(f.accessor(blank)), `${f.id} should be empty`).toBe(false);
      }
    });

    it("returns true for rating row when externalRatingValue is set", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "external-rating")!;
      const v = makeVenue({ externalRatingValue: 4.47 });
      expect(f.hasValue(f.accessor(v))).toBe(true);
    });
  });

  describe("resolveHighlight — best/min", () => {
    it("marks the lowest-cost venue as winner", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "cost-range")!;
      const venues = [
        makeVenue({ id: "a", costMin: 3_000_000, costMax: 4_000_000 }),
        makeVenue({ id: "b", costMin: 2_000_000, costMax: 3_500_000 }),
        makeVenue({ id: "c", costMin: 2_500_000, costMax: 3_500_000 }),
      ];
      const winners = resolveHighlight(f, venues);
      expect(winners).toEqual(new Set(["b"]));
    });

    it("returns empty set when all venues tie (no winner)", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "cost-range")!;
      const venues = [
        makeVenue({ id: "a", costMin: 2_000_000, costMax: 3_000_000 }),
        makeVenue({ id: "b", costMin: 2_000_000, costMax: 3_000_000 }),
      ];
      expect(resolveHighlight(f, venues).size).toBe(0);
    });

    it("returns empty set when fewer than 2 venues have values", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "cost-range")!;
      const venues = [makeVenue({ id: "a", costMin: 2_000_000 })];
      expect(resolveHighlight(f, venues).size).toBe(0);
    });
  });

  describe("resolveHighlight — best/max", () => {
    it("marks the highest-rated venue as winner", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "external-rating")!;
      const venues = [
        makeVenue({ id: "a", externalRatingValue: 3.8 }),
        makeVenue({ id: "b", externalRatingValue: 4.5 }),
        makeVenue({ id: "c", externalRatingValue: 4.2 }),
      ];
      expect(resolveHighlight(f, venues)).toEqual(new Set(["b"]));
    });
  });

  describe("resolveHighlight — present", () => {
    it("highlights all venues with has=true when at least one lacks it", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "parking")!;
      const venues = [
        makeVenue({ id: "a", hasParking: true, parkingCapacity: 30 }),
        makeVenue({ id: "b", hasParking: false }),
        makeVenue({ id: "c", hasParking: true, parkingCapacity: 5 }),
      ];
      expect(resolveHighlight(f, venues)).toEqual(new Set(["a", "c"]));
    });

    it("returns empty set when every venue has it (no differentiation)", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "parking")!;
      const venues = [
        makeVenue({ id: "a", hasParking: true }),
        makeVenue({ id: "b", hasParking: true }),
      ];
      expect(resolveHighlight(f, venues).size).toBe(0);
    });

    it("returns empty set when every venue lacks it (no winner)", () => {
      const f = COMPARE_FIELDS.find((x) => x.id === "shuttle")!;
      const venues = [
        makeVenue({ id: "a", hasShuttle: false }),
        makeVenue({ id: "b", hasShuttle: false }),
      ];
      expect(resolveHighlight(f, venues).size).toBe(0);
    });
  });
});
