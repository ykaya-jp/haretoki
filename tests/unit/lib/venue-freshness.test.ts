import { describe, it, expect } from "vitest";
import {
  daysAgo,
  formatRelativeJa,
  venueFreshness,
  VENUE_STALE_DAYS,
} from "@/lib/utils";

// Deterministic anchor — freezing "now" for every assertion keeps the
// file CI-safe (no wall-clock flake) and matches the freshness chip's
// expected behavior at a known reference point.
const NOW = new Date("2026-04-21T12:00:00.000Z");

describe("daysAgo", () => {
  it("returns 0 when the timestamp is in the future", () => {
    const future = new Date(NOW.getTime() + 60_000);
    expect(daysAgo(future, NOW)).toBe(0);
  });

  it("floors to whole days", () => {
    const twoAndHalfDaysAgo = new Date(NOW.getTime() - 2.5 * 24 * 3_600_000);
    expect(daysAgo(twoAndHalfDaysAgo, NOW)).toBe(2);
  });

  it("accepts ISO strings", () => {
    const iso = new Date(NOW.getTime() - 7 * 24 * 3_600_000).toISOString();
    expect(daysAgo(iso, NOW)).toBe(7);
  });
});

describe("formatRelativeJa", () => {
  it("uses 'たった今' under one minute", () => {
    const t = new Date(NOW.getTime() - 30_000);
    expect(formatRelativeJa(t, NOW)).toBe("たった今");
  });

  it("returns minutes when under an hour", () => {
    const t = new Date(NOW.getTime() - 5 * 60_000);
    expect(formatRelativeJa(t, NOW)).toBe("5分前");
  });

  it("returns hours when under a day", () => {
    const t = new Date(NOW.getTime() - 3 * 3_600_000);
    expect(formatRelativeJa(t, NOW)).toBe("3時間前");
  });

  it("returns days when under two months", () => {
    const t = new Date(NOW.getTime() - 10 * 24 * 3_600_000);
    expect(formatRelativeJa(t, NOW)).toBe("10日前");
  });

  it("falls back to YYYY/M/D beyond two months", () => {
    const t = new Date(NOW.getTime() - 90 * 24 * 3_600_000);
    // Old timestamps should show an absolute date rather than "90日前"
    // which reads as noise.
    expect(formatRelativeJa(t, NOW)).toMatch(/^\d{4}\/\d{1,2}\/\d{1,2}$/);
  });
});

describe("venueFreshness", () => {
  it("classifies recent timestamps as fresh", () => {
    const t = new Date(NOW.getTime() - 5 * 24 * 3_600_000);
    expect(venueFreshness(t, NOW)).toEqual({ state: "fresh", daysOld: 5 });
  });

  it("classifies anything >= 30d as stale", () => {
    const t = new Date(
      NOW.getTime() - VENUE_STALE_DAYS * 24 * 3_600_000,
    );
    expect(venueFreshness(t, NOW).state).toBe("stale");
  });

  it("treats one-day-under-threshold as fresh", () => {
    const t = new Date(
      NOW.getTime() - (VENUE_STALE_DAYS - 1) * 24 * 3_600_000,
    );
    expect(venueFreshness(t, NOW).state).toBe("fresh");
  });
});
