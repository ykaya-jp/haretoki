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
