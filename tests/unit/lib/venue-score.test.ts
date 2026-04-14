import { describe, it, expect } from "vitest";
import { computeCompositeScore, SCORE_SOURCE_WEIGHTS } from "@/lib/venue-score";

describe("computeCompositeScore", () => {
  it("returns null for empty scores", () => {
    expect(computeCompositeScore([])).toBeNull();
  });

  it("returns the single user_rating score when only one entry", () => {
    const scores = [{ source: "user_rating", dimension: "cuisine", score: 4.0 }];
    expect(computeCompositeScore(scores)).toBe(4.0);
  });

  it("weights user_rating higher than zexy for same dimension", () => {
    const scores = [
      { source: "user_rating", dimension: "atmosphere", score: 5.0 },
      { source: "zexy", dimension: "atmosphere", score: 3.0 },
    ];
    // user_rating weight=1.0, zexy weight=0.5
    // weighted avg = (5*1 + 3*0.5) / (1+0.5) = 6.5/1.5 ≈ 4.33
    const result = computeCompositeScore(scores);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(4.0);
    expect(result!).toBeLessThan(5.0);
  });

  it("averages across dimensions", () => {
    const scores = [
      { source: "user_rating", dimension: "cuisine", score: 4.0 },
      { source: "user_rating", dimension: "access", score: 2.0 },
    ];
    // dim averages: cuisine=4, access=2 => total=(4+2)/2=3
    expect(computeCompositeScore(scores)).toBe(3.0);
  });

  it("ignores non-finite score values", () => {
    const scores = [
      { source: "user_rating", dimension: "cuisine", score: NaN },
      { source: "user_rating", dimension: "access", score: 4.0 },
    ];
    expect(computeCompositeScore(scores)).toBe(4.0);
  });

  it("rounds result to 1 decimal place", () => {
    const scores = [
      { source: "user_rating", dimension: "atmosphere", score: 4.0 },
      { source: "zexy", dimension: "atmosphere", score: 3.0 },
      { source: "user_rating", dimension: "cuisine", score: 3.0 },
    ];
    const result = computeCompositeScore(scores);
    expect(result).not.toBeNull();
    // Check it's rounded to 1 decimal
    expect(String(result)).toMatch(/^\d+(\.\d)?$/);
  });

  it("SCORE_SOURCE_WEIGHTS has user_rating as highest weight", () => {
    const userWeight = SCORE_SOURCE_WEIGHTS["user_rating"];
    for (const [source, weight] of Object.entries(SCORE_SOURCE_WEIGHTS)) {
      if (source !== "user_rating") {
        expect(weight).toBeLessThanOrEqual(userWeight);
      }
    }
  });
});
