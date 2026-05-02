import { describe, it, expect } from "vitest";
import {
  aggregateReviewsForVenue,
  HIGHLIGHTS_TOP_N,
  REVIEW_SUMMARY_MAX_CHARS,
  type ReviewRowForAggregate,
} from "@/lib/review-aggregations";

/**
 * R2 — pure aggregator boundary tests. Pinning the contract that
 * /compare's "口コミ要約" cells depend on:
 *
 *   - latest aggregate row supplies summary/strengths/concerns
 *   - sentimentAvg averages across ALL rows that have sentiment.overall
 *   - individual rows (no sentiment) still count toward `count`
 *   - empty input returns the "no reviews yet" shape
 *   - summary capped to REVIEW_SUMMARY_MAX_CHARS
 *   - sentiment.overall clamped to [-1, 1]
 */

function makeRow(overrides: Partial<ReviewRowForAggregate> = {}): ReviewRowForAggregate {
  return {
    aiSummary: null,
    sentiment: null,
    categorySummary: null,
    fetchedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("aggregateReviewsForVenue", () => {
  it("returns the no-reviews shape on empty input", () => {
    expect(aggregateReviewsForVenue([])).toEqual({
      summary: null,
      strengths: [],
      concerns: [],
      count: 0,
      sentimentAvg: null,
    });
  });

  it("returns count > 0 with null summary when only individual rows exist", () => {
    // Individual rows have sentiment === null (saveExtractedReviews never
    // writes sentiment). The /compare UI should still surface "口コミ N 件"
    // so couples know reviews exist even before analyze has run.
    const rows = [
      makeRow({ aiSummary: "良かった" }),
      makeRow({ aiSummary: "雰囲気が好き" }),
    ];
    const out = aggregateReviewsForVenue(rows);
    expect(out.summary).toBe(null);
    expect(out.strengths).toEqual([]);
    expect(out.concerns).toEqual([]);
    expect(out.count).toBe(2);
    expect(out.sentimentAvg).toBe(null);
  });

  it("picks the LATEST aggregate row's summary + highlights", () => {
    const old = makeRow({
      aiSummary: "古い要約",
      sentiment: { overall: 0.4 },
      categorySummary: {
        positiveHighlights: ["旧 強み"],
        negativeHighlights: ["旧 懸念"],
      },
      fetchedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = makeRow({
      aiSummary: "新しい要約",
      sentiment: { overall: 0.6 },
      categorySummary: {
        positiveHighlights: ["新 強み 1", "新 強み 2"],
        negativeHighlights: ["新 懸念"],
      },
      fetchedAt: new Date("2026-04-01T00:00:00Z"),
    });
    // Order intentionally reversed to verify selection by fetchedAt
    const out = aggregateReviewsForVenue([newer, old]);
    expect(out.summary).toBe("新しい要約");
    expect(out.strengths).toEqual(["新 強み 1", "新 強み 2"]);
    expect(out.concerns).toEqual(["新 懸念"]);
  });

  it("averages sentiment.overall across ALL rows that have it", () => {
    const rows = [
      makeRow({ sentiment: { overall: 0.6 }, fetchedAt: new Date("2026-01-01") }),
      makeRow({ sentiment: { overall: 0.4 }, fetchedAt: new Date("2026-02-01") }),
      makeRow({ sentiment: { overall: 0.2 }, fetchedAt: new Date("2026-03-01") }),
      // Individual row — should NOT pull mean toward 0
      makeRow({ aiSummary: "個別レビュー" }),
    ];
    const out = aggregateReviewsForVenue(rows);
    // (0.6 + 0.4 + 0.2) / 3 = 0.4
    expect(out.sentimentAvg).toBe(0.4);
    expect(out.count).toBe(4);
  });

  it("clamps sentiment.overall to [-1, 1] before averaging", () => {
    // A misbehaving model write (e.g. 5.0) should not blow up the dashboard.
    const rows = [
      makeRow({ sentiment: { overall: 5.0 }, fetchedAt: new Date("2026-01-01") }),
      makeRow({ sentiment: { overall: -2.0 }, fetchedAt: new Date("2026-02-01") }),
    ];
    const out = aggregateReviewsForVenue(rows);
    // Clamped to (1 + -1) / 2 = 0
    expect(out.sentimentAvg).toBe(0);
  });

  it("rounds sentimentAvg to 2 decimal places", () => {
    const rows = [
      makeRow({ sentiment: { overall: 1 / 3 }, fetchedAt: new Date("2026-01-01") }),
    ];
    const out = aggregateReviewsForVenue(rows);
    expect(out.sentimentAvg).toBe(0.33);
  });

  it("ignores rows whose sentiment.overall is non-numeric", () => {
    const rows = [
      makeRow({
        sentiment: { overall: "garbage" as unknown as number },
        fetchedAt: new Date("2026-01-01"),
      }),
      makeRow({ sentiment: { overall: 0.5 }, fetchedAt: new Date("2026-02-01") }),
    ];
    const out = aggregateReviewsForVenue(rows);
    expect(out.sentimentAvg).toBe(0.5);
  });

  it("caps the summary text to REVIEW_SUMMARY_MAX_CHARS", () => {
    const longSummary = "あ".repeat(REVIEW_SUMMARY_MAX_CHARS + 50);
    const rows = [
      makeRow({
        aiSummary: longSummary,
        sentiment: { overall: 0.5 },
        fetchedAt: new Date("2026-01-01"),
      }),
    ];
    const out = aggregateReviewsForVenue(rows);
    expect(out.summary).not.toBeNull();
    expect(out.summary!.length).toBe(REVIEW_SUMMARY_MAX_CHARS);
    expect(out.summary!.endsWith("…")).toBe(true);
  });

  it("limits strengths and concerns to HIGHLIGHTS_TOP_N", () => {
    const tooMany = Array.from({ length: HIGHLIGHTS_TOP_N + 5 }, (_, i) => `強み${i}`);
    const rows = [
      makeRow({
        sentiment: { overall: 0.3 },
        categorySummary: {
          positiveHighlights: tooMany,
          negativeHighlights: tooMany,
        },
        fetchedAt: new Date("2026-01-01"),
      }),
    ];
    const out = aggregateReviewsForVenue(rows);
    expect(out.strengths).toHaveLength(HIGHLIGHTS_TOP_N);
    expect(out.concerns).toHaveLength(HIGHLIGHTS_TOP_N);
  });

  it("skips empty / non-string highlight entries defensively", () => {
    const rows = [
      makeRow({
        sentiment: { overall: 0.3 },
        categorySummary: {
          positiveHighlights: ["", "  ", "良い", 42, null, "雰囲気"],
          negativeHighlights: "not-an-array",
        },
        fetchedAt: new Date("2026-01-01"),
      }),
    ];
    const out = aggregateReviewsForVenue(rows);
    expect(out.strengths).toEqual(["良い", "雰囲気"]);
    expect(out.concerns).toEqual([]);
  });

  it("treats sentiment === null as not-an-aggregate (no summary picked)", () => {
    const rows = [
      makeRow({
        aiSummary: "個別の感想",
        sentiment: null,
        fetchedAt: new Date("2026-01-01"),
      }),
    ];
    const out = aggregateReviewsForVenue(rows);
    expect(out.summary).toBe(null);
    expect(out.count).toBe(1);
  });
});
