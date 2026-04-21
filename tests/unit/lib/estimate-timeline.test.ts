import { describe, expect, it } from "vitest";
import {
  buildTimelinePoints,
  computeCategoryDeltas,
  formatDeltaMan,
  summariseTimeline,
  type TimelineEstimateInput,
} from "@/lib/estimate-timeline";

/** Factory keeps test bodies readable. `createdAt` ordering matches version. */
function mkEstimate(
  version: number,
  total: number,
  items: Array<{ category: string; amount: number }> = [],
): TimelineEstimateInput {
  return {
    id: `e${version}`,
    version,
    total,
    // 2026-04-01 + (version-1) days so re-sorting by date matches version
    createdAt: new Date(2026, 3, version),
    items,
  };
}

describe("buildTimelinePoints", () => {
  it("sorts by version ascending regardless of input order", () => {
    const points = buildTimelinePoints([
      mkEstimate(3, 4_500_000),
      mkEstimate(1, 4_000_000),
      mkEstimate(2, 4_150_000),
    ]);
    expect(points.map((p) => p.version)).toEqual([1, 2, 3]);
  });

  it("computes deltaFromPrev for every point except the first", () => {
    const points = buildTimelinePoints([
      mkEstimate(1, 4_000_000),
      mkEstimate(2, 4_150_000),
      mkEstimate(3, 3_900_000),
    ]);
    expect(points[0].deltaFromPrev).toBeNull();
    expect(points[1].deltaFromPrev).toBe(150_000);
    expect(points[2].deltaFromPrev).toBe(-250_000);
  });

  it("aggregates item amounts per category", () => {
    const points = buildTimelinePoints([
      mkEstimate(1, 1_000_000, [
        { category: "cuisine", amount: 300_000 },
        { category: "cuisine", amount: 200_000 },
        { category: "flowers", amount: 150_000 },
      ]),
    ]);
    expect(points[0].categoryTotals).toEqual({
      cuisine: 500_000,
      flowers: 150_000,
    });
  });
});

describe("computeCategoryDeltas", () => {
  it("returns signed deltas sorted by absolute magnitude", () => {
    const [a, b] = buildTimelinePoints([
      mkEstimate(1, 500_000, [
        { category: "cuisine", amount: 300_000 },
        { category: "flowers", amount: 200_000 },
      ]),
      mkEstimate(2, 600_000, [
        { category: "cuisine", amount: 350_000 }, // +50,000
        { category: "flowers", amount: 170_000 }, // -30,000
        { category: "photo_video", amount: 80_000 }, // new, +80,000
      ]),
    ]);
    const rows = computeCategoryDeltas(a, b);
    expect(rows.map((r) => r.category)).toEqual([
      "photo_video", // |+80k| biggest
      "cuisine",     // |+50k|
      "flowers",     // |-30k|
    ]);
    expect(rows.find((r) => r.category === "cuisine")!.delta).toBe(50_000);
    expect(rows.find((r) => r.category === "flowers")!.delta).toBe(-30_000);
    expect(rows.find((r) => r.category === "photo_video")!.delta).toBe(80_000);
  });

  it("treats categories missing from one side as 0 (spec: 値がない item は 0 円)", () => {
    const [a, b] = buildTimelinePoints([
      mkEstimate(1, 300_000, [{ category: "cuisine", amount: 300_000 }]),
      mkEstimate(2, 300_000, [{ category: "flowers", amount: 300_000 }]),
    ]);
    const rows = computeCategoryDeltas(a, b);
    expect(rows.find((r) => r.category === "cuisine")).toEqual({
      category: "cuisine",
      from: 300_000,
      to: 0,
      delta: -300_000,
    });
    expect(rows.find((r) => r.category === "flowers")).toEqual({
      category: "flowers",
      from: 0,
      to: 300_000,
      delta: 300_000,
    });
  });
});

describe("summariseTimeline", () => {
  it("returns null when fewer than two points exist", () => {
    const points = buildTimelinePoints([mkEstimate(1, 4_000_000)]);
    expect(summariseTimeline(points)).toBeNull();
  });

  it("computes totalDelta and percent change over the full span", () => {
    const points = buildTimelinePoints([
      mkEstimate(1, 4_000_000),
      mkEstimate(2, 4_150_000),
      mkEstimate(3, 4_600_000),
    ]);
    const s = summariseTimeline(points)!;
    expect(s.firstVersion).toBe(1);
    expect(s.lastVersion).toBe(3);
    expect(s.totalDelta).toBe(600_000);
    expect(s.percentChange).toBeCloseTo(15, 5);
  });
});

describe("formatDeltaMan", () => {
  it("formats positive with + sign", () => {
    expect(formatDeltaMan(150_000)).toBe("+15万円");
  });
  it("formats negative with typographic minus", () => {
    expect(formatDeltaMan(-80_000)).toBe("\u22128万円");
  });
  it("formats zero as ±0万円", () => {
    expect(formatDeltaMan(0)).toBe("±0万円");
  });
});
