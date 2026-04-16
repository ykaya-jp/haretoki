import { describe, it, expect } from "vitest";
import {
  TIER1_DIMENSIONS,
  DIMENSION_LABELS,
  getScoreColor,
  SCORE_COLORS,
} from "@/lib/constants";

describe("TIER1_DIMENSIONS", () => {
  it("contains exactly 8 dimensions", () => {
    expect(TIER1_DIMENSIONS).toHaveLength(8);
  });

  it("all have Japanese labels", () => {
    for (const dim of TIER1_DIMENSIONS) {
      expect(DIMENSION_LABELS[dim]).toBeDefined();
      expect(DIMENSION_LABELS[dim].length).toBeGreaterThan(0);
    }
  });
});

describe("getScoreColor", () => {
  it("returns high for scores >= 4.0", () => {
    expect(getScoreColor(4.0)).toBe(SCORE_COLORS.high);
    expect(getScoreColor(5.0)).toBe(SCORE_COLORS.high);
  });

  it("returns medium for scores 3.0-3.9", () => {
    expect(getScoreColor(3.0)).toBe(SCORE_COLORS.medium);
    expect(getScoreColor(3.9)).toBe(SCORE_COLORS.medium);
  });

  it("returns low for scores < 3.0", () => {
    expect(getScoreColor(2.9)).toBe(SCORE_COLORS.low);
    expect(getScoreColor(1.0)).toBe(SCORE_COLORS.low);
  });
});
