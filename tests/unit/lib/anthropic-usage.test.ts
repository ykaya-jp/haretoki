import { describe, it, expect, beforeEach, vi } from "vitest";

// Sentry helper is mocked so we can assert on alert-firing without a DSN.
const captureMessageMock = vi.fn();
vi.mock("@/lib/sentry", () => ({
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
}));

import {
  estimateCostUsd,
  recordUsage,
  summarizeRecentUsage,
  evaluateBudgetAlert,
  forecastMonthlyCostUsd,
  detectDailyCostSpike,
  _resetUsageBuckets,
} from "@/lib/anthropic-usage";

describe("estimateCostUsd", () => {
  it("computes cost for known Haiku 4.5 model", () => {
    // Haiku: $0.80 / M input, $4 / M output.
    // 1M input + 1M output = $0.80 + $4 = $4.80
    expect(estimateCostUsd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000)).toBeCloseTo(
      4.8,
      5,
    );
  });

  it("computes cost for known Sonnet 4.6 model", () => {
    // Sonnet: $3 / M input, $15 / M output.
    expect(estimateCostUsd("claude-sonnet-4-6", 100_000, 50_000)).toBeCloseTo(
      0.3 + 0.75,
      5,
    );
  });

  it("returns 0 for an unknown model rather than guessing", () => {
    expect(estimateCostUsd("imaginary-model", 1_000_000, 1_000_000)).toBe(0);
  });

  it("scales linearly with token count (Opus)", () => {
    // Opus: $15 / M input, $75 / M output.
    const a = estimateCostUsd("claude-opus-4-7", 200_000, 50_000);
    const b = estimateCostUsd("claude-opus-4-7", 400_000, 100_000);
    expect(b).toBeCloseTo(a * 2, 5);
  });
});

describe("recordUsage / summarizeRecentUsage", () => {
  beforeEach(() => {
    _resetUsageBuckets();
    captureMessageMock.mockReset();
  });

  it("rolls per-model totals into the snapshot", () => {
    recordUsage({ model: "claude-haiku-4-5-20251001", inputTokens: 1000, outputTokens: 500 });
    recordUsage({ model: "claude-haiku-4-5-20251001", inputTokens: 2000, outputTokens: 800 });
    recordUsage({ model: "claude-sonnet-4-6", inputTokens: 500, outputTokens: 200 });

    const summary = summarizeRecentUsage(60_000);
    expect(summary.totalCalls).toBe(3);
    expect(summary.byModel["claude-haiku-4-5-20251001"]?.calls).toBe(2);
    expect(summary.byModel["claude-sonnet-4-6"]?.calls).toBe(1);
    // Haiku: 3000 input → $0.0024; 1300 output → $0.0052; total ≈ $0.0076
    // Sonnet: 500 input → $0.0015; 200 output → $0.003; total ≈ $0.0045
    expect(summary.totalCostUsd).toBeCloseTo(0.0076 + 0.0045, 4);
  });

  it("ignores garbage token counts (negative / NaN) without throwing", () => {
    recordUsage({ model: "claude-haiku-4-5-20251001", inputTokens: -10, outputTokens: 5 });
    recordUsage({ model: "claude-haiku-4-5-20251001", inputTokens: NaN, outputTokens: 5 });
    const s = summarizeRecentUsage(60_000);
    expect(s.totalCalls).toBe(0);
  });
});

describe("evaluateBudgetAlert", () => {
  beforeEach(() => {
    captureMessageMock.mockReset();
    delete process.env.ANTHROPIC_DAILY_BUDGET_USD;
    delete process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
  });

  it("does NOT alert when both spends are under threshold", () => {
    const r = evaluateBudgetAlert({ dailyUsedUsd: 1, monthlyUsedUsd: 50 });
    expect(r.shouldAlert).toBe(false);
    expect(r.daily.exceeded).toBe(false);
    expect(r.monthly.exceeded).toBe(false);
    expect(captureMessageMock).not.toHaveBeenCalled();
  });

  it("alerts at warning level when only the daily threshold trips", () => {
    process.env.ANTHROPIC_DAILY_BUDGET_USD = "5";
    process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "100";
    const r = evaluateBudgetAlert({ dailyUsedUsd: 6, monthlyUsedUsd: 50 });
    expect(r.shouldAlert).toBe(true);
    expect(r.daily.exceeded).toBe(true);
    expect(r.monthly.exceeded).toBe(false);
    expect(captureMessageMock).toHaveBeenCalledTimes(1);
    const call = captureMessageMock.mock.calls[0];
    expect(call[1]?.level).toBe("warning");
  });

  it("alerts at error level when the monthly threshold trips", () => {
    process.env.ANTHROPIC_DAILY_BUDGET_USD = "5";
    process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "100";
    const r = evaluateBudgetAlert({ dailyUsedUsd: 1, monthlyUsedUsd: 120 });
    expect(r.shouldAlert).toBe(true);
    expect(r.monthly.exceeded).toBe(true);
    const call = captureMessageMock.mock.calls[0];
    expect(call[1]?.level).toBe("error");
  });

  it("uses default budgets when env vars are unset", () => {
    // Defaults: daily $5, monthly $100. Used $4 daily / $90 monthly = no alert.
    const r = evaluateBudgetAlert({ dailyUsedUsd: 4, monthlyUsedUsd: 90 });
    expect(r.daily.budgetUsd).toBe(5);
    expect(r.monthly.budgetUsd).toBe(100);
    expect(r.shouldAlert).toBe(false);
  });

  it("includes percentage-of-budget in the result for ops dashboards", () => {
    process.env.ANTHROPIC_DAILY_BUDGET_USD = "10";
    process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "200";
    const r = evaluateBudgetAlert({ dailyUsedUsd: 7.5, monthlyUsedUsd: 100 });
    expect(r.daily.pct).toBe(75);
    expect(r.monthly.pct).toBe(50);
  });
});

describe("forecastMonthlyCostUsd", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
  });

  function snap(date: string, usd: number) {
    return { snapshotDate: new Date(date), dailyUsedUsd: usd };
  }

  it("projects month-end from a 7-day trailing average", () => {
    // 7 days × $2/day = $14 trailing avg → $2/day projection.
    // Now = 2026-05-10 (10th day of 31). monthToDate = $20 (10 days × $2
    // already in the monthly window). Remaining days = 31 - 10 = 21.
    // Forecast = $20 + $2 × 21 = $62.
    const snapshots = Array.from({ length: 7 }, (_, i) =>
      snap(`2026-05-${String(4 + i).padStart(2, "0")}`, 2),
    );
    const r = forecastMonthlyCostUsd({
      snapshots,
      monthToDateUsd: 20,
      now: new Date(Date.UTC(2026, 4, 10)),
    });
    expect(r.trailingDailyAvgUsd).toBeCloseTo(2, 5);
    expect(r.trailingDaysSampled).toBe(7);
    expect(r.remainingDays).toBe(21);
    expect(r.monthEndForecastUsd).toBeCloseTo(62, 5);
  });

  it("only consumes the most-recent windowDays snapshots even when more are passed", () => {
    // 14 snapshots all $1, but windowDays defaults to 7 — avg should be
    // $1, NOT smoothed across 14 (which would also be $1, so this guards
    // the slice() behaviour rather than the math).
    const snapshots = Array.from({ length: 14 }, (_, i) =>
      snap(`2026-05-${String(1 + i).padStart(2, "0")}`, 1),
    );
    const r = forecastMonthlyCostUsd({
      snapshots,
      monthToDateUsd: 14,
      now: new Date(Date.UTC(2026, 4, 14)),
    });
    expect(r.trailingDaysSampled).toBe(7);
  });

  it("respects custom windowDays", () => {
    // windowDays=3, snapshots [10, 5, 1] → avg ≈ 5.33
    const snapshots = [
      snap("2026-05-10", 1),
      snap("2026-05-09", 5),
      snap("2026-05-08", 10),
    ];
    const r = forecastMonthlyCostUsd({
      snapshots,
      monthToDateUsd: 16,
      windowDays: 3,
      now: new Date(Date.UTC(2026, 4, 10)),
    });
    expect(r.trailingDailyAvgUsd).toBeCloseTo(16 / 3, 4);
  });

  it("handles an empty snapshot list gracefully (zero avg)", () => {
    const r = forecastMonthlyCostUsd({
      snapshots: [],
      monthToDateUsd: 0,
      now: new Date(Date.UTC(2026, 4, 1)),
    });
    expect(r.trailingDaysSampled).toBe(0);
    expect(r.trailingDailyAvgUsd).toBe(0);
    expect(r.monthEndForecastUsd).toBe(0);
  });

  it("classifies pace=under when forecast ≤ 80% budget", () => {
    process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "100";
    const r = forecastMonthlyCostUsd({
      snapshots: [snap("2026-05-10", 2)],
      monthToDateUsd: 20,
      now: new Date(Date.UTC(2026, 4, 10)),
    });
    // forecast = 20 + 2*21 = 62 → 62% of $100 budget
    expect(r.forecastPct).toBe(62);
    expect(r.pace).toBe("under");
  });

  it("classifies pace=watch when forecast is 80-110% budget", () => {
    process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "100";
    // forecast = 50 + 2*21 = 92 → 92%
    const r = forecastMonthlyCostUsd({
      snapshots: [snap("2026-05-10", 2)],
      monthToDateUsd: 50,
      now: new Date(Date.UTC(2026, 4, 10)),
    });
    expect(r.forecastPct).toBe(92);
    expect(r.pace).toBe("watch");
  });

  it("classifies pace=over when forecast > 110% budget", () => {
    process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "100";
    // forecast = 80 + 5*21 = 185 → 185%
    const r = forecastMonthlyCostUsd({
      snapshots: [snap("2026-05-10", 5)],
      monthToDateUsd: 80,
      now: new Date(Date.UTC(2026, 4, 10)),
    });
    expect(r.forecastPct).toBe(185);
    expect(r.pace).toBe("over");
  });

  it("re-sorts unsorted snapshots and only takes the most recent window", () => {
    // Out-of-order input — recipe must pick the 7 most recent dates.
    const snapshots = [
      snap("2026-05-01", 1),
      snap("2026-05-08", 8),
      snap("2026-05-03", 3),
      snap("2026-05-10", 10),
      snap("2026-05-05", 5),
      snap("2026-05-09", 9),
      snap("2026-05-04", 4),
      snap("2026-05-07", 7),
      snap("2026-05-02", 2),
      snap("2026-05-06", 6),
    ];
    const r = forecastMonthlyCostUsd({
      snapshots,
      monthToDateUsd: 55,
      now: new Date(Date.UTC(2026, 4, 10)),
    });
    // Most recent 7 = May 4..10 → avg = (4+5+6+7+8+9+10)/7 = 7
    expect(r.trailingDailyAvgUsd).toBeCloseTo(7, 5);
  });
});

describe("forecastMonthlyCostUsd — monthStartForecastUsd (this PR)", () => {
  function snap(dateStr: string, daily: number) {
    return { snapshotDate: new Date(`${dateStr}T00:00:00Z`), dailyUsedUsd: daily };
  }
  it("equals trailingDailyAvgUsd × daysInMonth (linear projection from day 1)", () => {
    // 7 days at $4/day → trailing avg = 4. May = 31 days. Linear month
    // = 4 × 31 = 124. monthEndForecastUsd in contrast adds the actual
    // monthToDateUsd, so the two diverge by definition.
    const snapshots = [
      snap("2026-05-04", 4),
      snap("2026-05-05", 4),
      snap("2026-05-06", 4),
      snap("2026-05-07", 4),
      snap("2026-05-08", 4),
      snap("2026-05-09", 4),
      snap("2026-05-10", 4),
    ];
    const r = forecastMonthlyCostUsd({
      snapshots,
      monthToDateUsd: 28,
      now: new Date(Date.UTC(2026, 4, 10)),
    });
    expect(r.monthStartForecastUsd).toBeCloseTo(4 * 31, 5);
    // monthEnd is independently right: monthToDate + 21 future days × 4
    expect(r.monthEndForecastUsd).toBeCloseTo(28 + 21 * 4, 5);
  });

  it("monthStartForecastUsd is 0 when there are no snapshots (no rate to project)", () => {
    const r = forecastMonthlyCostUsd({
      snapshots: [],
      monthToDateUsd: 0,
      now: new Date(Date.UTC(2026, 4, 10)),
    });
    expect(r.monthStartForecastUsd).toBe(0);
  });
});

describe("detectDailyCostSpike — designer-warning thresholds", () => {
  function snap(dateStr: string, daily: number) {
    return { snapshotDate: new Date(`${dateStr}T00:00:00Z`), dailyUsedUsd: daily };
  }

  it("returns spiked=false + deltaPct=null when there are < 2 snapshots", () => {
    expect(detectDailyCostSpike([])).toMatchObject({
      spiked: false,
      deltaPct: null,
      todayUsd: 0,
      prevUsd: null,
    });
    expect(detectDailyCostSpike([snap("2026-05-10", 5)])).toMatchObject({
      spiked: false,
      deltaPct: null,
      todayUsd: 5,
      prevUsd: null,
    });
  });

  it("does NOT spike when delta is at or below the default 30% threshold", () => {
    expect(
      detectDailyCostSpike([
        snap("2026-05-10", 13), // today
        snap("2026-05-09", 10), // yesterday — +30% exactly
      ]).spiked,
    ).toBe(false);
    expect(
      detectDailyCostSpike([
        snap("2026-05-10", 12), // +20%
        snap("2026-05-09", 10),
      ]).spiked,
    ).toBe(false);
  });

  it("DOES spike when delta is just over 30% (designer warning trigger)", () => {
    const r = detectDailyCostSpike([
      snap("2026-05-10", 13.5), // +35%
      snap("2026-05-09", 10),
    ]);
    expect(r.spiked).toBe(true);
    expect(r.deltaPct).toBeCloseTo(35, 1);
    expect(r.todayUsd).toBe(13.5);
    expect(r.prevUsd).toBe(10);
  });

  it("returns honest deltaPct even when not spiking (= negative case)", () => {
    const r = detectDailyCostSpike([
      snap("2026-05-10", 8), // -20%
      snap("2026-05-09", 10),
    ]);
    expect(r.spiked).toBe(false);
    expect(r.deltaPct).toBeCloseTo(-20, 1);
  });

  it("ignores spike when yesterday is sub-floor (< $0.10) — avoids $0.05→$0.20 false alarm", () => {
    // The dispatcher's $0.10 floor guard prevents "yesterday near
    // zero" from making any positive number read as a +1000% spike.
    // Today $0.50 vs yesterday $0.05 = +900% raw, but the floor
    // guard says "yesterday's baseline isn't real, don't alert".
    const r = detectDailyCostSpike([
      snap("2026-05-10", 0.5),
      snap("2026-05-09", 0.05),
    ]);
    expect(r.spiked).toBe(false);
  });

  it("respects the spikeThresholdPct option override", () => {
    // 20% threshold catches what the default 30% would let pass.
    const r = detectDailyCostSpike(
      [snap("2026-05-10", 12), snap("2026-05-09", 10)],
      { spikeThresholdPct: 20 },
    );
    expect(r.spiked).toBe(false); // 20% exactly = at threshold, NOT over
    const r2 = detectDailyCostSpike(
      [snap("2026-05-10", 12.5), snap("2026-05-09", 10)],
      { spikeThresholdPct: 20 },
    );
    expect(r2.spiked).toBe(true); // 25% > 20%
  });

  it("re-sorts unsorted snapshots so order doesn't affect the answer", () => {
    const r = detectDailyCostSpike([
      snap("2026-05-09", 10), // older
      snap("2026-05-10", 14), // most recent
    ]);
    expect(r.todayUsd).toBe(14);
    expect(r.prevUsd).toBe(10);
    expect(r.spiked).toBe(true);
  });
});

describe("recordUsage — per-action accumulator (this PR)", () => {
  beforeEach(() => {
    _resetUsageBuckets();
  });

  it("records action label when present, else falls into __no-action", () => {
    recordUsage({
      model: "claude-haiku-4-5",
      inputTokens: 1000,
      outputTokens: 500,
      action: "coach",
    });
    recordUsage({
      model: "claude-haiku-4-5",
      inputTokens: 2000,
      outputTokens: 1000,
      action: "coach",
    });
    recordUsage({
      model: "claude-haiku-4-5",
      inputTokens: 1500,
      outputTokens: 750,
      action: "url-extraction",
    });
    recordUsage({
      model: "claude-haiku-4-5",
      inputTokens: 1500,
      outputTokens: 750,
      // no action — should fall into the synthetic __no-action key
    });

    const summary = summarizeRecentUsage(60_000);
    expect(summary.byAction).toBeDefined();
    expect(Object.keys(summary.byAction).sort()).toEqual([
      "__no-action",
      "coach",
      "url-extraction",
    ]);
    // coach got 2 calls — the per-action bucket should reflect that.
    expect(summary.byAction.coach.calls).toBeGreaterThan(0);
  });

  it("byAction calls do NOT exceed the global recent.length", () => {
    recordUsage({ model: "claude-haiku-4-5", inputTokens: 1, outputTokens: 1, action: "a" });
    recordUsage({ model: "claude-haiku-4-5", inputTokens: 1, outputTokens: 1, action: "b" });
    const summary = summarizeRecentUsage(60_000);
    const totalActionCalls = Object.values(summary.byAction).reduce(
      (acc, b) => acc + b.calls,
      0,
    );
    // Recent calls = 2; the per-action ratio shouldn't double-count.
    expect(totalActionCalls).toBeLessThanOrEqual(summary.totalCalls);
  });
});
