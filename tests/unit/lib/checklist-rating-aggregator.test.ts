import { describe, it, expect } from "vitest";
import {
  aggregateChildScoresToDimensions,
  compositeFromChildScores,
  resolveDimension,
} from "@/lib/checklist-rating-aggregator";
import { TIER1_DIMENSIONS } from "@/lib/constants";

describe("resolveDimension", () => {
  it("maps known preset items via ITEM_TO_DIMENSION", () => {
    expect(resolveDimension("chapel.interior.decor-style")).toBe(
      "ceremony_space",
    );
    expect(resolveDimension("cuisine_drink.cuisine.taste")).toBe("cuisine");
  });

  it("falls back to 'overall' when no mapping exists", () => {
    expect(resolveDimension("unknown.item.id")).toBe("overall");
  });

  it("uses the custom lookup when provided", () => {
    expect(
      resolveDimension("custom-xyz", { "custom-xyz": "attire_items" }),
    ).toBe("attire_items");
  });

  it("preset mapping wins over custom lookup for the same id", () => {
    // Defensive: a preset id collision in the custom lookup should never
    // override the static table — the preset is canonical.
    expect(
      resolveDimension("chapel.interior.decor-style", {
        "chapel.interior.decor-style": "cost_contract",
      }),
    ).toBe("ceremony_space");
  });
});

describe("aggregateChildScoresToDimensions", () => {
  it("initialises every Tier-1 dimension with an empty bucket", () => {
    const map = aggregateChildScoresToDimensions([]);
    for (const dim of TIER1_DIMENSIONS) {
      expect(map[dim]).toEqual({ score: null, ratedCount: 0, totalCount: 0 });
    }
  });

  it("counts unrated items in totalCount but not ratedCount", () => {
    const map = aggregateChildScoresToDimensions([
      { itemId: "chapel.interior.decor-style", numericScore: null },
      { itemId: "chapel.interior.size", numericScore: undefined },
    ]);
    expect(map.ceremony_space.totalCount).toBe(2);
    expect(map.ceremony_space.ratedCount).toBe(0);
    expect(map.ceremony_space.score).toBeNull();
  });

  it("computes arithmetic mean for rated items", () => {
    const map = aggregateChildScoresToDimensions([
      { itemId: "chapel.interior.decor-style", numericScore: 4.5 },
      { itemId: "chapel.interior.size", numericScore: 4.0 },
      { itemId: "chapel.interior.virgin-road", numericScore: 5.0 },
    ]);
    // (4.5 + 4.0 + 5.0) / 3 = 4.5
    expect(map.ceremony_space.score).toBe(4.5);
    expect(map.ceremony_space.ratedCount).toBe(3);
    expect(map.ceremony_space.totalCount).toBe(3);
  });

  it("ignores non-finite scores", () => {
    const map = aggregateChildScoresToDimensions([
      // @ts-expect-error — intentionally malformed
      { itemId: "chapel.interior.decor-style", numericScore: "oops" },
      { itemId: "chapel.interior.size", numericScore: 4 },
    ]);
    expect(map.ceremony_space.score).toBe(4.0);
    expect(map.ceremony_space.ratedCount).toBe(1);
    expect(map.ceremony_space.totalCount).toBe(2);
  });

  it("routes unmapped item ids into 'overall'", () => {
    const map = aggregateChildScoresToDimensions([
      { itemId: "unknown.x.y", numericScore: 3.5 },
    ]);
    expect(map.overall.score).toBe(3.5);
    expect(map.ceremony_space.totalCount).toBe(0);
  });

  it("rounds to 1 decimal — matches Decimal(2,1) DB column", () => {
    const map = aggregateChildScoresToDimensions([
      { itemId: "cuisine_drink.cuisine.taste", numericScore: 3 },
      { itemId: "cuisine_drink.cuisine.ingredients", numericScore: 4 },
      // 7/3 = 2.333... → 2.3
      { itemId: "cuisine_drink.cuisine.age-appropriate", numericScore: 0 },
    ]);
    // Note: 0 isn't valid per zod scoring (>= 0.5), but the aggregator is
    // permissive — DB or zod is the guard, aggregator is "do the math".
    expect(map.cuisine.score).toBe(2.3);
  });

  it("respects custom item dimensions via the lookup arg", () => {
    const map = aggregateChildScoresToDimensions(
      [{ itemId: "custom-tatami", numericScore: 4.0 }],
      { "custom-tatami": "ceremony_space" },
    );
    expect(map.ceremony_space.score).toBe(4.0);
    expect(map.overall.totalCount).toBe(0);
  });

  it("isolates dimensions — banquet rating doesn't leak into cuisine", () => {
    const map = aggregateChildScoresToDimensions([
      { itemId: "banquet.interior.lighting", numericScore: 5 },
      { itemId: "cuisine_drink.cuisine.taste", numericScore: 2 },
    ]);
    expect(map.banquet_space.score).toBe(5.0);
    expect(map.cuisine.score).toBe(2.0);
    expect(map.ceremony_space.score).toBeNull();
  });
});

describe("compositeFromChildScores", () => {
  it("returns null when nothing is rated", () => {
    expect(compositeFromChildScores([])).toBeNull();
    expect(
      compositeFromChildScores([
        { itemId: "chapel.interior.decor-style", numericScore: null },
      ]),
    ).toBeNull();
  });

  it("means the per-dimension means (= dimensions of size != length of items)", () => {
    const result = compositeFromChildScores([
      // ceremony_space mean: (4 + 5)/2 = 4.5
      { itemId: "chapel.interior.decor-style", numericScore: 4 },
      { itemId: "chapel.interior.size", numericScore: 5 },
      // cuisine mean: 3
      { itemId: "cuisine_drink.cuisine.taste", numericScore: 3 },
    ]);
    // mean of (4.5, 3) = 3.75 → 3.8
    expect(result).toBe(3.8);
  });

  it("drops empty dimensions instead of dragging the composite toward 0", () => {
    // Only one dimension rated → composite = that dimension's score.
    const result = compositeFromChildScores([
      { itemId: "chapel.interior.decor-style", numericScore: 4.5 },
    ]);
    expect(result).toBe(4.5);
  });
});
