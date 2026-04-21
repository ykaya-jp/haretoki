import { describe, it, expect } from "vitest";
import {
  buildDecisionSummary,
  STRENGTH_THRESHOLD,
  PRICE_THRESHOLD_YEN,
  type SummaryVenueInput,
} from "@/lib/decision-summary";

/** Tiny factory to keep test bodies readable. */
function mkVenue(
  id: string,
  name: string,
  opts: Partial<Omit<SummaryVenueInput, "id" | "name">> = {},
): SummaryVenueInput {
  return {
    id,
    name,
    costMin: opts.costMin ?? null,
    costMax: opts.costMax ?? null,
    estimateTotal: opts.estimateTotal ?? null,
    scores: opts.scores ?? [],
  };
}

describe("buildDecisionSummary", () => {
  it("returns null when shortlist has only 1 venue (nothing to compare)", () => {
    const shortlist = [mkVenue("a", "A", { costMax: 4_000_000 })];
    expect(buildDecisionSummary("a", shortlist)).toBeNull();
  });

  it("returns a summary when shortlist has >= 2 venues", () => {
    const shortlist = [
      mkVenue("a", "A", { costMax: 3_000_000 }),
      mkVenue("b", "B", { costMax: 4_000_000 }),
    ];
    const result = buildDecisionSummary("a", shortlist);
    expect(result).not.toBeNull();
    expect(result!.venueId).toBe("a");
    expect(result!.price?.direction).toBe("cheaper");
  });

  it("reports price savings vs the most expensive candidate (cheaper target)", () => {
    const shortlist = [
      mkVenue("cheap", "安め", { costMax: 3_000_000 }),
      mkVenue("mid", "中間", { costMax: 4_000_000 }),
      mkVenue("pricey", "高め", { costMax: 5_000_000 }),
    ];
    const r = buildDecisionSummary("cheap", shortlist)!;
    expect(r.price?.direction).toBe("cheaper");
    expect(r.price?.savingsYen).toBe(2_000_000);
    expect(r.price?.comparedWith).toBe("高め");
    expect(r.price?.label).toContain("200万円");
  });

  it("frames the most expensive candidate against the cheapest", () => {
    const shortlist = [
      mkVenue("a", "安め", { costMax: 3_000_000 }),
      mkVenue("b", "高め", { costMax: 5_000_000 }),
    ];
    const r = buildDecisionSummary("b", shortlist)!;
    expect(r.price?.direction).toBe("costlier");
    expect(r.price?.comparedWith).toBe("安め");
    expect(r.price?.label).toContain("多い");
  });

  it("drops tiny price diffs below PRICE_THRESHOLD_YEN", () => {
    const shortlist = [
      mkVenue("a", "A", { costMax: 3_000_000 }),
      mkVenue("b", "B", { costMax: 3_000_000 + PRICE_THRESHOLD_YEN - 1 }),
    ];
    const r = buildDecisionSummary("a", shortlist)!;
    expect(r.price?.direction).toBe("tied");
    expect(r.price?.label).toBe("");
  });

  it("ranks strengths where target beats the shortlist average", () => {
    const shortlist = [
      mkVenue("target", "本命", {
        scores: [
          { dimension: "cuisine", score: 5, source: "user_rating" },
          { dimension: "hospitality", score: 4, source: "user_rating" },
        ],
      }),
      mkVenue("other", "相手", {
        scores: [
          { dimension: "cuisine", score: 3, source: "user_rating" },
          { dimension: "hospitality", score: 4, source: "user_rating" },
        ],
      }),
    ];
    const r = buildDecisionSummary("target", shortlist)!;
    // cuisine diff = +2.0 (surfaced); hospitality diff = 0 (dropped)
    expect(r.strengths.length).toBe(1);
    expect(r.strengths[0].dimension).toBe("cuisine");
    expect(r.strengths[0].diff).toBeGreaterThan(0);
    expect(r.compromises).toEqual([]);
  });

  it("ranks compromises where target lags the shortlist average", () => {
    const shortlist = [
      mkVenue("target", "本命", {
        scores: [{ dimension: "cuisine", score: 2, source: "user_rating" }],
      }),
      mkVenue("other", "相手", {
        scores: [{ dimension: "cuisine", score: 5, source: "user_rating" }],
      }),
    ];
    const r = buildDecisionSummary("target", shortlist)!;
    expect(r.compromises.length).toBe(1);
    expect(r.compromises[0].dimension).toBe("cuisine");
    expect(r.compromises[0].diff).toBeLessThan(0);
  });

  it("drops noise-level dimension diffs below STRENGTH_THRESHOLD", () => {
    const shortlist = [
      mkVenue("a", "A", {
        scores: [{ dimension: "cuisine", score: 4.1, source: "user_rating" }],
      }),
      mkVenue("b", "B", {
        scores: [{ dimension: "cuisine", score: 4.0, source: "user_rating" }],
      }),
    ];
    const r = buildDecisionSummary("a", shortlist)!;
    // diff ≈ 0.1 < STRENGTH_THRESHOLD — not surfaced
    expect(STRENGTH_THRESHOLD).toBeGreaterThan(0.1);
    expect(r.strengths).toEqual([]);
    expect(r.compromises).toEqual([]);
  });

  it("produces a fallback rationale when differences are all tiny", () => {
    const shortlist = [
      mkVenue("a", "A", {
        scores: [{ dimension: "cuisine", score: 4, source: "user_rating" }],
      }),
      mkVenue("b", "B", {
        scores: [{ dimension: "cuisine", score: 4, source: "user_rating" }],
      }),
    ];
    const r = buildDecisionSummary("a", shortlist)!;
    expect(r.strengths).toEqual([]);
    expect(r.compromises).toEqual([]);
    expect(r.rationale.length).toBeGreaterThan(0);
    expect(r.headline.length).toBeGreaterThan(0);
  });

  it("returns null when target is missing from the shortlist", () => {
    const shortlist = [
      mkVenue("a", "A"),
      mkVenue("b", "B"),
    ];
    expect(buildDecisionSummary("missing", shortlist)).toBeNull();
  });

  it("prefers estimateTotal over costMax when both are present", () => {
    const shortlist = [
      mkVenue("a", "A", { costMax: 9_999_999, estimateTotal: 3_000_000 }),
      mkVenue("b", "B", { costMax: 5_000_000 }),
    ];
    const r = buildDecisionSummary("a", shortlist)!;
    expect(r.price?.direction).toBe("cheaper");
    expect(r.price?.savingsYen).toBe(2_000_000);
  });
});
