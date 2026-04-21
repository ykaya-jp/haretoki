import { describe, it, expect } from "vitest";
import {
  computeWeighted,
  computeWeightedComposite,
  aggregateScoresByDimension,
  coerceWeights,
  normalizeWeight,
  defaultWeights,
  WEIGHT_DEFAULT,
} from "@/lib/weighted-score";

describe("normalizeWeight", () => {
  it("returns the value unchanged when in [1,5]", () => {
    expect(normalizeWeight(1)).toBe(1);
    expect(normalizeWeight(3)).toBe(3);
    expect(normalizeWeight(5)).toBe(5);
  });
  it("clamps below 1 up to 1, above 5 down to 5", () => {
    expect(normalizeWeight(0)).toBe(1);
    expect(normalizeWeight(-10)).toBe(1);
    expect(normalizeWeight(100)).toBe(5);
  });
  it("falls back to default (3) for non-finite inputs", () => {
    expect(normalizeWeight(NaN)).toBe(WEIGHT_DEFAULT);
    expect(normalizeWeight(null)).toBe(WEIGHT_DEFAULT);
    expect(normalizeWeight(undefined)).toBe(WEIGHT_DEFAULT);
    expect(normalizeWeight("abc")).toBe(WEIGHT_DEFAULT);
  });
});

describe("defaultWeights", () => {
  it("returns 3 for every TIER1 dimension", () => {
    const w = defaultWeights();
    expect(w.cuisine).toBe(3);
    expect(w.hospitality).toBe(3);
    expect(w.overall).toBe(3);
    expect(w.ceremony_space).toBe(3);
  });
});

describe("coerceWeights", () => {
  it("returns all-default weights for null / undefined", () => {
    expect(coerceWeights(null).cuisine).toBe(3);
    expect(coerceWeights(undefined).hospitality).toBe(3);
  });
  it("merges user-provided values with defaults for missing dims", () => {
    const w = coerceWeights({ cuisine: 5, hospitality: 1 });
    expect(w.cuisine).toBe(5);
    expect(w.hospitality).toBe(1);
    expect(w.overall).toBe(3); // default
  });
  it("clamps out-of-range user input", () => {
    const w = coerceWeights({ cuisine: 99, overall: -3 });
    expect(w.cuisine).toBe(5);
    expect(w.overall).toBe(1);
  });
  it("drops unknown dimension keys silently", () => {
    const w = coerceWeights({ cuisine: 4, invented_dim: 9 });
    expect(w.cuisine).toBe(4);
    expect((w as Record<string, number>).invented_dim).toBeUndefined();
  });
});

describe("computeWeighted", () => {
  it("returns null when no dimension has a finite score", () => {
    expect(computeWeighted({}, null)).toBeNull();
    expect(
      computeWeighted({ cuisine: null, hospitality: null }, { cuisine: 5 }),
    ).toBeNull();
  });

  it("equals plain arithmetic mean when weights are null (default)", () => {
    // cuisine=4, hospitality=2 → mean = 3
    const result = computeWeighted(
      { cuisine: 4, hospitality: 2 },
      null,
    );
    expect(result).toBe(3);
  });

  it("equals plain arithmetic mean when every weight is equal", () => {
    const result = computeWeighted(
      { cuisine: 4, hospitality: 2, overall: 3 },
      { cuisine: 2, hospitality: 2, overall: 2 },
    );
    // (4+2+3)/3 = 3
    expect(result).toBe(3);
  });

  it("biases composite toward the heavily-weighted dimension", () => {
    // cuisine=5 (weight 5 = 超重視), hospitality=1 (weight 1 = どうでもいい)
    // weighted mean = (5*5 + 1*1) / (5+1) = 26/6 ≈ 4.33 → rounds to 4.3
    const result = computeWeighted(
      { cuisine: 5, hospitality: 1 },
      { cuisine: 5, hospitality: 1 },
    );
    expect(result).toBe(4.3);
    // Unweighted would have been 3.0 — so weighting must raise it meaningfully
    expect(result! - 3.0).toBeGreaterThan(1.0);
  });

  it("ignores dimensions without a score even if weighted high", () => {
    // Only cuisine has data; weight on hospitality is irrelevant.
    const result = computeWeighted(
      { cuisine: 4.0, hospitality: null },
      { cuisine: 3, hospitality: 5 },
    );
    expect(result).toBe(4.0);
  });

  it("clamps and defaults malformed weight values so bad DB data can't crash the UI", () => {
    const result = computeWeighted(
      { cuisine: 4, hospitality: 2 },
      // @ts-expect-error — intentionally invalid
      { cuisine: "oops", hospitality: 999 },
    );
    // cuisine weight → default 3, hospitality weight → clamp 5
    // = (4*3 + 2*5) / (3+5) = 22/8 = 2.75 → 2.8
    expect(result).toBe(2.8);
  });

  it("rounds result to one decimal place", () => {
    const result = computeWeighted(
      { cuisine: 4, hospitality: 3 },
      { cuisine: 5, hospitality: 1 },
    );
    // (4*5 + 3*1)/(5+1) = 23/6 ≈ 3.8333 → 3.8
    expect(result).toBe(3.8);
  });
});

describe("aggregateScoresByDimension", () => {
  it("user_rating outranks zexy for the same dimension", () => {
    const result = aggregateScoresByDimension([
      { source: "user_rating", dimension: "cuisine", score: 5 },
      { source: "zexy", dimension: "cuisine", score: 3 },
    ]);
    // (5*1.0 + 3*0.5)/(1.0+0.5) = 6.5/1.5 ≈ 4.33
    expect(result.cuisine).toBeCloseTo(4.333, 2);
  });

  it("skips non-finite raw values", () => {
    const result = aggregateScoresByDimension([
      { source: "user_rating", dimension: "cuisine", score: "bogus" },
      { source: "user_rating", dimension: "cuisine", score: 4 },
    ]);
    expect(result.cuisine).toBe(4);
  });
});

describe("computeWeightedComposite (end-to-end)", () => {
  it("returns null for empty score arrays (parity with computeCompositeScore)", () => {
    expect(computeWeightedComposite([], null)).toBeNull();
  });

  it("matches an arithmetic mean when all weights are default", () => {
    // Two dims, each single user_rating score → dim averages 4 and 2 → mean 3
    const result = computeWeightedComposite(
      [
        { source: "user_rating", dimension: "cuisine", score: 4 },
        { source: "user_rating", dimension: "hospitality", score: 2 },
      ],
      null,
    );
    expect(result).toBe(3.0);
  });

  it("flips the composite when the user heavily weights the high-scoring dim", () => {
    const scores = [
      { source: "user_rating", dimension: "cuisine", score: 5 },
      { source: "user_rating", dimension: "hospitality", score: 1 },
    ];
    const neutral = computeWeightedComposite(scores, {
      cuisine: 3,
      hospitality: 3,
    });
    const cuisineHeavy = computeWeightedComposite(scores, {
      cuisine: 5,
      hospitality: 1,
    });
    expect(neutral).toBe(3.0);
    expect(cuisineHeavy).not.toBeNull();
    expect(cuisineHeavy!).toBeGreaterThan(neutral!);
  });
});
