import { describe, it, expect } from "vitest";
import {
  getScoreCoverage,
  // Confirm canonical exports are reachable from the new path. The existing
  // venue-score.test.ts / weighted-score.test.ts cover the same symbols via
  // the @deprecated shim — that's the back-compat proof. This file is the
  // forward-compat proof.
  SCORE_SOURCE_WEIGHTS,
  computeCompositeScore,
  computeWeightedComposite,
  WEIGHT_DEFAULT,
} from "@/lib/scoring";
import { TIER1_DIMENSIONS } from "@/lib/constants";

describe("scoring.ts canonical exports", () => {
  it("re-exports the same SCORE_SOURCE_WEIGHTS shape as the legacy module", () => {
    expect(SCORE_SOURCE_WEIGHTS.user_rating).toBe(1.0);
    expect(SCORE_SOURCE_WEIGHTS.zexy).toBe(0.5);
  });

  it("computeCompositeScore behaves identically via the canonical path", () => {
    const result = computeCompositeScore([
      { source: "user_rating", dimension: "cuisine", score: 4 },
      { source: "user_rating", dimension: "ceremony_space", score: 2 },
    ]);
    expect(result).toBe(3.0);
  });

  it("computeWeightedComposite behaves identically via the canonical path", () => {
    const result = computeWeightedComposite(
      [
        { source: "user_rating", dimension: "cuisine", score: 4 },
        { source: "user_rating", dimension: "hospitality", score: 2 },
      ],
      null,
    );
    expect(result).toBe(3.0);
  });

  it("WEIGHT_DEFAULT remains 3 (anchor for backwards-compat behaviour)", () => {
    expect(WEIGHT_DEFAULT).toBe(3);
  });
});

describe("getScoreCoverage (H1 transparency helper — new in PR #1)", () => {
  it("returns 0 covered + full total for an empty score list", () => {
    const cov = getScoreCoverage([]);
    expect(cov.covered).toBe(0);
    expect(cov.total).toBe(TIER1_DIMENSIONS.length);
    expect(cov.dimensions).toEqual([]);
  });

  it("counts each distinct dimension only once, regardless of multi-source rows", () => {
    const cov = getScoreCoverage([
      { dimension: "cuisine", score: 4 },
      { dimension: "cuisine", score: 3 },
      { dimension: "hospitality", score: 5 },
    ]);
    expect(cov.covered).toBe(2);
    // Sorted alphabetically — stable for test snapshots.
    expect(cov.dimensions).toEqual(["cuisine", "hospitality"]);
  });

  it("ignores rows whose score coerces to a non-finite number", () => {
    const cov = getScoreCoverage([
      { dimension: "cuisine", score: NaN },
      { dimension: "ceremony_space", score: "abc" },
      { dimension: "hospitality", score: null },
      { dimension: "overall", score: 4.2 },
    ]);
    expect(cov.covered).toBe(1);
    expect(cov.dimensions).toEqual(["overall"]);
  });

  it("returns total = TIER1_DIMENSIONS.length so the UI can render N/M without re-importing the constant", () => {
    const cov = getScoreCoverage([{ dimension: "cuisine", score: 5 }]);
    expect(cov.total).toBe(TIER1_DIMENSIONS.length);
    expect(cov.total).toBeGreaterThan(0);
  });

  it("includes dimensions that aren't in TIER1_DIMENSIONS (e.g. legacy DB keys) — coverage is descriptive, not gating", () => {
    // Some VenueScore rows still carry pre-v2 dimension keys; the helper
    // reports them so a future migration can spot them. The UI uses
    // `total` (= Tier-1 count) as the denominator, so an off-list key
    // doesn't inflate the percentage.
    const cov = getScoreCoverage([
      { dimension: "legacy_dim_x", score: 3 },
      { dimension: "cuisine", score: 4 },
    ]);
    expect(cov.covered).toBe(2);
    expect(cov.dimensions).toContain("legacy_dim_x");
    expect(cov.dimensions).toContain("cuisine");
  });
});
