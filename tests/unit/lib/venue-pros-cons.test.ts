/**
 * Unit tests for venue-pros-cons — pure derive Pros/Cons from a 6-dim
 * score map plus the scoresToMap normalizer.
 *
 * Thresholds (as per implementation):
 *   - PRO_THRESHOLD: ≥ 4.0
 *   - CON_THRESHOLD: ≤ 2.5
 *   - Mid-range (2.5 < x < 4.0) → excluded from both lists
 *   - Pros / Cons each capped at 2, sorted by absolute strength.
 *
 * scoresToMap rules:
 *   - user_rating wins over ai_analysis when both exist for the same dim.
 */

import { describe, it, expect } from "vitest";
import { deriveProsCons, scoresToMap } from "@/lib/venue-pros-cons";

describe("deriveProsCons", () => {
  it("returns 2 pros and 0 cons when all scores ≥ 4.0", async () => {
    const result = deriveProsCons({
      cuisine: 4.5,
      hospitality: 4.8,
      ceremony_space: 4.2,
      banquet_space: 4.0,
    });

    expect(result.pros).toHaveLength(2);
    expect(result.cons).toHaveLength(0);
    // Sorted by descending score
    expect(result.pros[0].score).toBe(4.8);
    expect(result.pros[0].dim).toBe("hospitality");
    expect(result.pros[0].label).toBe("スタッフ・対応");
    expect(result.pros[1].score).toBe(4.5);
  });

  it("returns 0 pros and 2 cons when all scores ≤ 2.5", async () => {
    const result = deriveProsCons({
      cuisine: 2.5,
      hospitality: 1.5,
      ceremony_space: 2.0,
      banquet_space: 2.4,
    });

    expect(result.pros).toHaveLength(0);
    expect(result.cons).toHaveLength(2);
    // Sorted by ascending score (worst first)
    expect(result.cons[0].score).toBe(1.5);
    expect(result.cons[0].dim).toBe("hospitality");
    expect(result.cons[1].score).toBe(2.0);
  });

  it("returns empty pros + cons when all scores fall in mid-range (2.5 < x < 4.0)", async () => {
    const result = deriveProsCons({
      cuisine: 3.0,
      hospitality: 3.5,
      ceremony_space: 3.9,
      banquet_space: 2.6,
    });

    expect(result.pros).toEqual([]);
    expect(result.cons).toEqual([]);
  });

  it("picks top-2 pros and bottom-2 cons in a mixed score map", async () => {
    const result = deriveProsCons({
      cuisine: 4.7, // pro
      hospitality: 4.2, // pro
      ceremony_space: 4.0, // pro (cap at 2 → excluded)
      banquet_space: 3.0, // mid → excluded
      cost_contract: 1.8, // con
      logistics: 2.3, // con
    });

    // Pros capped at 2, sorted desc
    expect(result.pros).toHaveLength(2);
    expect(result.pros[0].dim).toBe("cuisine");
    expect(result.pros[1].dim).toBe("hospitality");

    // Cons sorted asc (worst first)
    expect(result.cons).toHaveLength(2);
    expect(result.cons[0].dim).toBe("cost_contract");
    expect(result.cons[1].dim).toBe("logistics");
  });

  it("ignores null scores entirely", async () => {
    const result = deriveProsCons({
      cuisine: 4.5,
      hospitality: null,
      cost_contract: 2.0,
    });

    expect(result.pros).toHaveLength(1);
    expect(result.pros[0].dim).toBe("cuisine");
    expect(result.cons).toHaveLength(1);
    expect(result.cons[0].dim).toBe("cost_contract");
  });

  it("falls back to dimension key when DIMENSION_LABELS lacks a label", async () => {
    const result = deriveProsCons({
      unknown_dim: 4.5,
    });

    expect(result.pros[0].dim).toBe("unknown_dim");
    expect(result.pros[0].label).toBe("unknown_dim");
  });
});

describe("scoresToMap", () => {
  it("converts a score array into a dimension→score map", () => {
    const map = scoresToMap([
      { dimension: "cuisine", score: 4.0, source: "ai_analysis" },
      { dimension: "hospitality", score: 3.5, source: "ai_analysis" },
    ]);

    expect(map.cuisine).toBe(4.0);
    expect(map.hospitality).toBe(3.5);
  });

  it("prefers user_rating over ai_analysis when both exist", () => {
    const map = scoresToMap([
      { dimension: "cuisine", score: 3.0, source: "ai_analysis" },
      { dimension: "cuisine", score: 4.5, source: "user_rating" },
    ]);

    expect(map.cuisine).toBe(4.5);
  });

  it("user_rating wins regardless of array order (ai_analysis first then user_rating)", () => {
    const map1 = scoresToMap([
      { dimension: "cuisine", score: 3.0, source: "ai_analysis" },
      { dimension: "cuisine", score: 4.5, source: "user_rating" },
    ]);
    const map2 = scoresToMap([
      { dimension: "cuisine", score: 4.5, source: "user_rating" },
      { dimension: "cuisine", score: 3.0, source: "ai_analysis" },
    ]);

    expect(map1.cuisine).toBe(4.5);
    expect(map2.cuisine).toBe(4.5);
  });

  it("returns empty map when given empty array", () => {
    expect(scoresToMap([])).toEqual({});
  });
});
