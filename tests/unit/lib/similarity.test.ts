import { describe, it, expect } from "vitest";
import {
  jaccard,
  rangeOverlap,
  locationPrefixMatch,
  computeVenueSimilarity,
  SIMILARITY_WEIGHTS,
} from "@/lib/similarity";

describe("jaccard", () => {
  it("returns 0 for two empty arrays (no signal, not vacuous 1)", () => {
    expect(jaccard([], [])).toBe(0);
    expect(jaccard(null, undefined)).toBe(0);
  });

  it("returns 1 for identical non-empty sets", () => {
    expect(jaccard(["chapel", "garden"], ["chapel", "garden"])).toBe(1);
  });

  it("computes intersection / union correctly", () => {
    // intersection = {"chapel"}, union = {"chapel","garden","hotel"} -> 1/3
    expect(jaccard(["chapel", "garden"], ["chapel", "hotel"])).toBeCloseTo(1 / 3, 6);
  });

  it("returns 0 when disjoint", () => {
    expect(jaccard(["chapel"], ["garden"])).toBe(0);
  });

  it("is case-insensitive for string values", () => {
    expect(jaccard(["Chapel", "Garden"], ["chapel", "GARDEN"])).toBe(1);
  });

  it("deduplicates repeated entries (set semantics)", () => {
    // Both sides reduce to {"a"}. Intersection=1, union=1 -> 1.
    expect(jaccard(["a", "a", "a"], ["a"])).toBe(1);
  });
});

describe("rangeOverlap", () => {
  it("returns 1 when ranges are identical", () => {
    expect(rangeOverlap(100, 200, 100, 200)).toBe(1);
  });

  it("returns 0 when ranges are disjoint", () => {
    expect(rangeOverlap(0, 50, 100, 200)).toBe(0);
  });

  it("computes partial overlap as |∩| / |∪|", () => {
    // [100,200] ∩ [150,300] = [150,200] width 50
    // [100,200] ∪ [150,300] = [100,300] width 200
    // ratio = 50/200 = 0.25
    expect(rangeOverlap(100, 200, 150, 300)).toBeCloseTo(0.25, 6);
  });

  it("returns 0 when either interval is fully missing", () => {
    expect(rangeOverlap(null, null, 100, 200)).toBe(0);
    expect(rangeOverlap(100, 200, null, null)).toBe(0);
  });

  it("treats one-sided bounds as point-like fallback", () => {
    // a = only min 100 -> treated as [100,100]; b = [100,200]
    // intersection = [100,100] width 0, union = [100,200] width 100
    // point vs range with shared endpoint -> 0 (no overlap length)
    expect(rangeOverlap(100, null, 100, 200)).toBe(0);
  });

  it("matches point-to-point identical ranges", () => {
    // both collapse to the same point -> full match
    expect(rangeOverlap(100, 100, 100, 100)).toBe(1);
  });
});

describe("locationPrefixMatch", () => {
  it("returns 0 when either side is empty / null", () => {
    expect(locationPrefixMatch(null, "東京都渋谷区")).toBe(0);
    expect(locationPrefixMatch("", "東京都渋谷区")).toBe(0);
  });

  it("returns 0 when prefectures differ", () => {
    expect(locationPrefixMatch("東京都渋谷区", "神奈川県横浜市")).toBe(0);
  });

  it("returns 1 when prefecture and ward both match", () => {
    expect(
      locationPrefixMatch("東京都渋谷区神宮前1-1", "東京都渋谷区恵比寿2-2"),
    ).toBe(1);
  });

  it("returns 0.5 when only prefecture matches", () => {
    expect(locationPrefixMatch("東京都渋谷区", "東京都港区")).toBe(0.5);
  });

  it("returns 0.5 when ward is missing on one side (prefecture only)", () => {
    expect(locationPrefixMatch("東京都", "東京都渋谷区")).toBe(0.5);
  });
});

describe("computeVenueSimilarity", () => {
  it("returns 0 when both venues have no populated fields", () => {
    expect(
      computeVenueSimilarity(
        { id: "a" },
        { id: "b" },
      ),
    ).toBe(0);
  });

  it("returns max score for a fully identical venue", () => {
    const shape = {
      id: "a",
      ceremonyStyles: ["chapel", "garden"],
      vibeTags: ["natural", "modern"],
      location: "東京都渋谷区神宮前",
      costMin: 100,
      costMax: 200,
      capacityMin: 40,
      capacityMax: 80,
    };
    const other = { ...shape, id: "b" };
    const max =
      SIMILARITY_WEIGHTS.ceremonyStyles +
      SIMILARITY_WEIGHTS.vibeTags +
      SIMILARITY_WEIGHTS.location +
      SIMILARITY_WEIGHTS.cost +
      SIMILARITY_WEIGHTS.capacity;
    expect(computeVenueSimilarity(shape, other)).toBeCloseTo(max, 6);
  });

  it("weights ceremonyStyles × 3 and vibeTags × 3 as the heaviest signals", () => {
    // Only ceremony matches fully -> 3
    const a = {
      id: "a",
      ceremonyStyles: ["chapel"],
      vibeTags: ["natural"],
      location: "東京都渋谷区",
      costMin: 100,
      costMax: 200,
    };
    const b = {
      id: "b",
      ceremonyStyles: ["chapel"],
      vibeTags: ["modern"], // disjoint -> 0
      location: "神奈川県横浜市", // different prefecture -> 0
      costMin: 1000,
      costMax: 2000, // disjoint -> 0
    };
    // ceremony 1*3 + vibe 0 + location 0 + cost 0 + capacity 0 = 3
    expect(computeVenueSimilarity(a, b)).toBe(3);
  });

  it("aggregates partial matches from multiple dimensions", () => {
    const a = {
      id: "a",
      ceremonyStyles: ["chapel", "garden"],
      location: "東京都渋谷区",
      costMin: 100,
      costMax: 200,
    };
    const b = {
      id: "b",
      ceremonyStyles: ["chapel", "hotel"], // Jaccard 1/3
      location: "東京都港区", // prefecture only -> 0.5
      costMin: 150,
      costMax: 300, // overlap 50/200 = 0.25
    };
    // ceremony (1/3)*3 + vibe 0 + location 0.5*2 + cost 0.25*2 + capacity 0
    // = 1 + 0 + 1 + 0.5 + 0 = 2.5
    expect(computeVenueSimilarity(a, b)).toBeCloseTo(2.5, 6);
  });

  it("ignores missing vibeTags without inflating score", () => {
    const a = {
      id: "a",
      ceremonyStyles: ["chapel"],
      vibeTags: null,
      location: "東京都渋谷区",
    };
    const b = {
      id: "b",
      ceremonyStyles: ["chapel"],
      vibeTags: null,
      location: "東京都渋谷区",
    };
    // ceremony 1*3 + vibe 0 + location 1*2 = 5 (not inflated by empty-match)
    expect(computeVenueSimilarity(a, b)).toBe(5);
  });
});
