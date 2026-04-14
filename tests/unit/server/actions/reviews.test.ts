import { describe, it, expect } from "vitest";
import {
  estimateIncreaseSchema,
  parseEstimateIncrease,
  aggregateEstimateIncrease,
} from "@/server/actions/review-schema";

describe("estimateIncreaseSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = estimateIncreaseSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts an all-undefined payload", () => {
    const result = estimateIncreaseSchema.safeParse({
      initial: undefined,
      final: undefined,
      deltaYen: undefined,
      deltaPct: undefined,
      confidence: undefined,
      note: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a partial (mixed) payload", () => {
    const result = estimateIncreaseSchema.safeParse({
      deltaYen: 800000,
      confidence: "high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid confidence value", () => {
    const result = estimateIncreaseSchema.safeParse({ confidence: "unsure" });
    expect(result.success).toBe(false);
  });

  it("rejects non-number deltaYen", () => {
    const result = estimateIncreaseSchema.safeParse({ deltaYen: "800000" });
    expect(result.success).toBe(false);
  });
});

describe("parseEstimateIncrease", () => {
  it("returns null for fully-empty payload (no fields set)", () => {
    expect(parseEstimateIncrease({})).toBeNull();
  });

  it("returns null for null/non-object input", () => {
    expect(parseEstimateIncrease(null)).toBeNull();
    expect(parseEstimateIncrease("foo")).toBeNull();
  });

  it("returns parsed object when at least one field is present", () => {
    const parsed = parseEstimateIncrease({ deltaYen: 500000 });
    expect(parsed).toEqual({ deltaYen: 500000 });
  });
});

describe("aggregateEstimateIncrease", () => {
  it("averages deltaYen + deltaPct across 3 reviews", () => {
    const result = aggregateEstimateIncrease([
      { deltaYen: 600000, deltaPct: 20 },
      { deltaYen: 900000, deltaPct: 30 },
      { deltaYen: 1200000, deltaPct: 40 },
    ]);
    expect(result.sampleCount).toBe(3);
    expect(result.deltaYen).toBe(900000);
    expect(result.deltaPct).toBe(30);
  });

  it("skips reviews without deltaYen when averaging yen", () => {
    const result = aggregateEstimateIncrease([
      { deltaYen: 800000 },
      { deltaPct: 25 },
      { deltaYen: 400000, deltaPct: 15 },
    ]);
    expect(result.sampleCount).toBe(3);
    expect(result.deltaYen).toBe(600000); // (800000 + 400000) / 2
    expect(result.deltaPct).toBe(20); // (25 + 15) / 2
  });

  it("returns null averages and zero count when no reviews have data", () => {
    const result = aggregateEstimateIncrease([null, undefined]);
    expect(result).toEqual({ deltaYen: null, deltaPct: null, sampleCount: 0 });
  });

  it("rounds pct to 2 decimals", () => {
    const result = aggregateEstimateIncrease([
      { deltaPct: 10 },
      { deltaPct: 15 },
      { deltaPct: 17 },
    ]);
    expect(result.deltaPct).toBe(14); // (10+15+17)/3 = 14
  });
});
