import { describe, it, expect } from "vitest";
import {
  computeActivityWindows,
  computeAvgVenuesPerProject,
  computeDecisionRate,
  computeFunnel,
  computePartnerAdoptionRate,
  countDistinctUsers,
  isFirstOfUtcMonth,
  previousMonthWindow,
} from "@/lib/metrics-aggregations";

/**
 * Phase 4 metrics dashboard helpers — pin every divisor edge so the
 * dashboard never displays NaN or Infinity, and pin the
 * previous-month-window math so the monthly-report cron always
 * targets the right calendar month regardless of the day-1 fire
 * time.
 */

describe("computePartnerAdoptionRate", () => {
  it("returns 0% when totalProjects = 0 (no NaN on fresh deploy)", () => {
    const r = computePartnerAdoptionRate({
      totalProjects: 0,
      projectsWithPartner: 0,
    });
    expect(r.ratePct).toBe(0);
    expect(Number.isFinite(r.ratePct)).toBe(true);
  });

  it("rounds to 1 decimal", () => {
    // 1 / 3 = 33.333...% → 33.3
    expect(
      computePartnerAdoptionRate({
        totalProjects: 3,
        projectsWithPartner: 1,
      }).ratePct,
    ).toBe(33.3);
  });

  it("100% when all projects have a partner", () => {
    expect(
      computePartnerAdoptionRate({
        totalProjects: 7,
        projectsWithPartner: 7,
      }).ratePct,
    ).toBe(100);
  });
});

describe("computeDecisionRate", () => {
  it("returns 0% when totalProjects = 0", () => {
    expect(
      computeDecisionRate({ totalProjects: 0, totalDecisions: 0 }).ratePct,
    ).toBe(0);
  });

  it("rounds to 1 decimal", () => {
    expect(
      computeDecisionRate({ totalProjects: 7, totalDecisions: 1 }).ratePct,
    ).toBe(14.3);
  });

  it("can exceed 100 if data is broken (= more decisions than projects)", () => {
    // Defensive: don't clamp at 100. If this ever happens, the
    // dashboard should show the broken state visibly so the
    // operator notices.
    expect(
      computeDecisionRate({ totalProjects: 5, totalDecisions: 7 }).ratePct,
    ).toBe(140);
  });
});

describe("computeAvgVenuesPerProject", () => {
  it("returns 0 when totalProjects = 0 (no Infinity)", () => {
    expect(
      computeAvgVenuesPerProject({ totalProjects: 0, totalVenues: 5 })
        .avgPerProject,
    ).toBe(0);
  });

  it("rounds to 1 decimal", () => {
    // 13 venues / 4 projects = 3.25 → 3.3
    expect(
      computeAvgVenuesPerProject({ totalProjects: 4, totalVenues: 13 })
        .avgPerProject,
    ).toBe(3.3);
  });
});

describe("countDistinctUsers", () => {
  it("returns 0 + empty Set on empty input", () => {
    const r = countDistinctUsers([]);
    expect(r.count).toBe(0);
    expect(r.ids.size).toBe(0);
  });

  it("dedupes (same id appearing twice = count 1)", () => {
    expect(countDistinctUsers(["a", "b", "a", "c", "b"]).count).toBe(3);
  });

  it("ignores empty strings (defensive against missing actor_id)", () => {
    expect(countDistinctUsers(["a", "", "b", ""]).count).toBe(2);
  });
});

describe("computeActivityWindows", () => {
  it("returns 0 / 0 / 0 / 0% on empty input (no NaN stickiness)", () => {
    const r = computeActivityWindows({
      dayUserIds: [],
      weekUserIds: [],
      monthUserIds: [],
    });
    expect(r).toEqual({ dau: 0, wau: 0, mau: 0, stickinessPct: 0 });
  });

  it("computes stickiness = dau/mau correctly", () => {
    const r = computeActivityWindows({
      dayUserIds: ["a", "b"], // dau=2
      weekUserIds: ["a", "b", "c", "d"], // wau=4
      monthUserIds: ["a", "b", "c", "d", "e", "f", "g", "h"], // mau=8
    });
    expect(r.dau).toBe(2);
    expect(r.wau).toBe(4);
    expect(r.mau).toBe(8);
    expect(r.stickinessPct).toBe(25);
  });

  it("dedupes within each window independently", () => {
    const r = computeActivityWindows({
      dayUserIds: ["a", "a", "b"],
      weekUserIds: ["a", "a", "a", "b", "c"],
      monthUserIds: ["x", "y", "z"],
    });
    expect(r.dau).toBe(2);
    expect(r.wau).toBe(3);
    expect(r.mau).toBe(3);
  });
});

describe("computeFunnel", () => {
  it("returns 5 steps with first step always 100% of users", () => {
    const steps = computeFunnel({
      totalUsers: 100,
      totalProjects: 80,
      projectsWithVenue: 60,
      projectsWithVisit: 40,
      projectsWithDecision: 20,
    });
    expect(steps).toHaveLength(5);
    expect(steps[0].pctOfUsers).toBe(100);
    expect(steps[0].count).toBe(100);
    expect(steps[1].pctOfUsers).toBe(80);
    expect(steps[2].pctOfUsers).toBe(60);
    expect(steps[3].pctOfUsers).toBe(40);
    expect(steps[4].pctOfUsers).toBe(20);
  });

  it("returns 0% on every step when totalUsers = 0 (= no NaN)", () => {
    const steps = computeFunnel({
      totalUsers: 0,
      totalProjects: 0,
      projectsWithVenue: 0,
      projectsWithVisit: 0,
      projectsWithDecision: 0,
    });
    expect(steps[0].pctOfUsers).toBe(100); // first step always 100
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].pctOfUsers).toBe(0);
    }
  });
});

describe("isFirstOfUtcMonth — monthly-report cron gate", () => {
  it("true when UTC date = 1", () => {
    expect(isFirstOfUtcMonth(new Date(Date.UTC(2026, 5, 1, 6, 0, 0)))).toBe(true);
    expect(isFirstOfUtcMonth(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)))).toBe(true);
  });

  it("false on every other UTC date", () => {
    expect(isFirstOfUtcMonth(new Date(Date.UTC(2026, 5, 2, 6, 0, 0)))).toBe(false);
    expect(isFirstOfUtcMonth(new Date(Date.UTC(2026, 5, 15, 6, 0, 0)))).toBe(false);
    expect(isFirstOfUtcMonth(new Date(Date.UTC(2026, 5, 30, 6, 0, 0)))).toBe(false);
  });

  it("true even at 23:59 UTC (whole UTC date counts)", () => {
    expect(isFirstOfUtcMonth(new Date(Date.UTC(2026, 5, 1, 23, 59, 59)))).toBe(true);
  });
});

describe("previousMonthWindow", () => {
  it("returns the prior calendar month given day-1 fire", () => {
    // Cron fires 2026-06-01 06:00 UTC → previous month = May
    const w = previousMonthWindow(new Date(Date.UTC(2026, 5, 1, 6, 0, 0)));
    expect(w.start).toEqual(new Date(Date.UTC(2026, 4, 1)));
    expect(w.end).toEqual(new Date(Date.UTC(2026, 5, 1)));
    expect(w.monthLabel).toBe("2026-05");
  });

  it("rolls year boundary (Jan 1 → previous = December of prior year)", () => {
    const w = previousMonthWindow(new Date(Date.UTC(2027, 0, 1, 6, 0, 0)));
    expect(w.start).toEqual(new Date(Date.UTC(2026, 11, 1)));
    expect(w.end).toEqual(new Date(Date.UTC(2027, 0, 1)));
    expect(w.monthLabel).toBe("2026-12");
  });

  it("handles arbitrary mid-month `now` correctly (window still reflects PREVIOUS month)", () => {
    // Defensive: if the cron hits mid-month (e.g. ad-hoc retry), the
    // window should still be the calendar month before `now`.
    // 2026-06-15 → window = 2026-05.
    const w = previousMonthWindow(new Date(Date.UTC(2026, 5, 15, 12, 0, 0)));
    expect(w.monthLabel).toBe("2026-05");
  });

  it("month label is zero-padded", () => {
    // March = month index 2 → previous = February → "2026-02"
    const w = previousMonthWindow(new Date(Date.UTC(2026, 2, 1, 6, 0, 0)));
    expect(w.monthLabel).toBe("2026-02");
  });
});
