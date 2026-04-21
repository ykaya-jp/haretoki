import { describe, it, expect } from "vitest";
import {
  classifyAdvantage,
  computePartnerOpinionDiff,
  aggregatePartnerDiffAcrossVenues,
  ADVANTAGE_TIE_MAX,
  ADVANTAGE_STRONG_MIN,
} from "@/lib/comparison-advantage";

/**
 * The thresholds in comparison-advantage.ts drive user-visible copy
 * ("ほぼ同じ" / arrows / "明確に優勢"). Lock the behaviour so a future
 * tweak to the constants doesn't silently flip which rows count as
 * "strongly leaning" on the compare board.
 */
describe("classifyAdvantage", () => {
  it("returns unknown when either side is null", () => {
    expect(classifyAdvantage(null, 4).kind).toBe("unknown");
    expect(classifyAdvantage(3, null).kind).toBe("unknown");
    expect(classifyAdvantage(null, null).kind).toBe("unknown");
  });

  it("treats < 0.5 spread as tie", () => {
    expect(classifyAdvantage(4.0, 4.0).kind).toBe("tie");
    expect(classifyAdvantage(4.2, 4.0).kind).toBe("tie");
    expect(classifyAdvantage(4.0, 4.4).kind).toBe("tie");
  });

  it("marks the leaning side when spread is in [0.5, 1.0)", () => {
    const left = classifyAdvantage(4.5, 4.0);
    expect(left.kind).toBe("left");
    if (left.kind === "left") expect(left.delta).toBeCloseTo(0.5);

    const right = classifyAdvantage(3.0, 3.9);
    expect(right.kind).toBe("right");
  });

  it("promotes to -strong when spread >= 1.0", () => {
    expect(classifyAdvantage(5.0, 4.0).kind).toBe("left-strong");
    expect(classifyAdvantage(3.0, 4.5).kind).toBe("right-strong");
  });

  it("thresholds match the exported constants", () => {
    expect(ADVANTAGE_TIE_MAX).toBe(0.5);
    expect(ADVANTAGE_STRONG_MIN).toBe(1.0);
  });
});

describe("computePartnerOpinionDiff", () => {
  it("returns null magnitude when either rating is missing", () => {
    const diffs = computePartnerOpinionDiff(
      ["ambiance", "cuisine"],
      { ambiance: 5 },
      { cuisine: 4 },
    );
    expect(diffs[0].magnitude).toBeNull();
    expect(diffs[1].magnitude).toBeNull();
  });

  it("computes |owner - partner| when both rated", () => {
    const diffs = computePartnerOpinionDiff(
      ["ambiance", "cuisine", "service"],
      { ambiance: 5, cuisine: 3, service: 4 },
      { ambiance: 3, cuisine: 3, service: 4.5 },
    );
    expect(diffs[0].magnitude).toBe(2);
    expect(diffs[1].magnitude).toBe(0);
    expect(diffs[2].magnitude).toBeCloseTo(0.5);
  });

  it("handles null rating maps entirely", () => {
    const diffs = computePartnerOpinionDiff(["ambiance"], null, null);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].magnitude).toBeNull();
  });
});

describe("aggregatePartnerDiffAcrossVenues", () => {
  it("takes the max magnitude across venues", () => {
    const perVenue = [
      [{ dimensionId: "ambiance", ownerScore: 5, partnerScore: 4.5, magnitude: 0.5 }],
      [{ dimensionId: "ambiance", ownerScore: 5, partnerScore: 2.5, magnitude: 2.5 }],
      [{ dimensionId: "ambiance", ownerScore: 3, partnerScore: 3, magnitude: 0 }],
    ];
    expect(aggregatePartnerDiffAcrossVenues(perVenue, "ambiance")).toBe(2.5);
  });

  it("returns 0 when no venue has evidence", () => {
    const perVenue = [
      [{ dimensionId: "ambiance", ownerScore: null, partnerScore: null, magnitude: null }],
    ];
    expect(aggregatePartnerDiffAcrossVenues(perVenue, "ambiance")).toBe(0);
  });

  it("skips unrated venues and still picks a max from rated ones", () => {
    const perVenue = [
      [{ dimensionId: "ambiance", ownerScore: null, partnerScore: 4, magnitude: null }],
      [{ dimensionId: "ambiance", ownerScore: 5, partnerScore: 3.5, magnitude: 1.5 }],
    ];
    expect(aggregatePartnerDiffAcrossVenues(perVenue, "ambiance")).toBe(1.5);
  });
});
