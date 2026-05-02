import { captureMessage } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";

/**
 * Anthropic Claude usage tracking + cost estimation.
 *
 * Two surfaces:
 *
 *  1. `recordUsage(model, inputTokens, outputTokens, context?)` — called
 *     from `src/lib/anthropic.ts` after every Claude round-trip. Emits a
 *     structured `console.info({event:"ai_call", ...})` line that Vercel
 *     log aggregation can pick up, plus a Sentry breadcrumb so the user-
 *     attached error scope shows recent AI calls when something blows up.
 *     This is sync, in-memory, and cheap — no DB write per call.
 *
 *  2. `summarizeRecentUsage(windowMs)` — called from the daily cost-alert
 *     cron. Snapshots the in-process counter map for the requested time
 *     window so the cron can hash the totals against budget thresholds.
 *     Best-effort: serverless function instances don't share state, so
 *     this is an estimate of "what this instance saw," not a global truth.
 *     Production will want a Redis-backed sink (P3 — see Known Limits).
 *
 * Pricing constants live here so a model rate change is a one-line edit
 * (and a redeploy) rather than scavenging across the codebase.
 */

// Pricing in USD per million tokens. Source: Anthropic pricing page,
// 2026-05 snapshot. Update both this map AND docs/ai/models.md when a
// rate moves. Keys are the model IDs from src/lib/models.ts (MODEL.HAIKU
// / SONNET / OPUS) plus their bare-family fallbacks for forward-compat
// when a new dated revision lands before this constant catches up.
const PRICING_USD_PER_MTOKEN: Record<
  string,
  { input: number; output: number }
> = {
  // Haiku 4.5 — coach chat, URL extract, summary, fit-reason, ritual,
  // vibe-suggest, matrix-insight (most of our calls)
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
  // Sonnet 4.6 — onboarding rec, comparison, review-summary, estimate-extract
  "claude-sonnet-4-6": { input: 3, output: 15 },
  // Opus 4.7 — currently unused, listed so accidental adoption still costs
  // out cleanly instead of silently logging zero.
  "claude-opus-4-7": { input: 15, output: 75 },
};

/** Bucket totals — keyed by model. Reset whenever the function instance
 *  cold-starts (which on Vercel is at-most-every-few-minutes for this
 *  app's traffic). Acceptable resolution because the cron alert cares
 *  about "are we burning $X today" not "exact penny per call." */
interface ModelBucket {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

const buckets = new Map<string, ModelBucket>();
const callTimestamps: Array<{ model: string; t: number; costUsd: number }> = [];
// Cap the per-instance call log so a hot loop can't OOM us. Anything
// older than the daily-cost summary window (24h + slack) is irrelevant.
const MAX_CALL_LOG = 5000;

function getPricing(model: string) {
  return PRICING_USD_PER_MTOKEN[model] ?? null;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = getPricing(model);
  if (!p) return 0;
  return (
    (inputTokens / 1_000_000) * p.input +
    (outputTokens / 1_000_000) * p.output
  );
}

/**
 * Record a single Claude round-trip. Called from askClaude / streamClaude
 * inside src/lib/anthropic.ts. Always sync, never throws — the caller's
 * happy path must not be slowed or broken by accounting.
 */
export function recordUsage(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Free-form label (e.g. "coach", "url-extraction") so logs / sentry
   *  breadcrumbs can be filtered per feature. Optional. */
  action?: string;
}): void {
  const { model, inputTokens, outputTokens, action } = params;
  if (
    !Number.isFinite(inputTokens) ||
    !Number.isFinite(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0
  ) {
    return;
  }
  const costUsd = estimateCostUsd(model, inputTokens, outputTokens);

  const bucket = buckets.get(model) ?? {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
  bucket.calls += 1;
  bucket.inputTokens += inputTokens;
  bucket.outputTokens += outputTokens;
  bucket.costUsd += costUsd;
  buckets.set(model, bucket);

  callTimestamps.push({ model, t: Date.now(), costUsd });
  if (callTimestamps.length > MAX_CALL_LOG) {
    // Drop the oldest 20% — cheaper than splice(0, 1) per call when we hit
    // the cap during a burst.
    callTimestamps.splice(0, Math.floor(MAX_CALL_LOG * 0.2));
  }

  // Structured log — Vercel Log Drain picks this up as JSON and lets ops
  // filter by event="ai_call" for ad-hoc cost queries. The helper enforces
  // the event taxonomy so a typo here would fail tsc.
  logEvent({
    event: "ai_call",
    fields: {
      model,
      inputTokens,
      outputTokens,
      costUsd: Number(costUsd.toFixed(6)),
      action: action ?? null,
    },
  });
}

export interface UsageSummary {
  windowMs: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byModel: Record<
    string,
    {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    }
  >;
}

/**
 * Snapshot of usage seen by THIS function instance over the given window.
 * Note the per-instance scope — see Known Limits in the cron route doc.
 */
export function summarizeRecentUsage(windowMs: number): UsageSummary {
  const cutoff = Date.now() - windowMs;
  const recent = callTimestamps.filter((c) => c.t >= cutoff);
  const summary: UsageSummary = {
    windowMs,
    totalCalls: recent.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    byModel: {},
  };
  for (const m of buckets.keys()) {
    summary.byModel[m] = {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }
  // The per-call log doesn't carry input/output split — for that we lean
  // on bucket totals, scaled by the recent-call ratio. Good enough for a
  // budget alert (which cares about $ orders of magnitude, not 1% drift).
  for (const m of buckets.keys()) {
    const totalCallsInBucket = buckets.get(m)?.calls ?? 0;
    const recentCallsInBucket = recent.filter((c) => c.model === m).length;
    if (totalCallsInBucket === 0 || recentCallsInBucket === 0) {
      summary.byModel[m].calls = recentCallsInBucket;
      continue;
    }
    const ratio = recentCallsInBucket / totalCallsInBucket;
    const b = buckets.get(m)!;
    summary.byModel[m] = {
      calls: recentCallsInBucket,
      inputTokens: Math.round(b.inputTokens * ratio),
      outputTokens: Math.round(b.outputTokens * ratio),
      costUsd: b.costUsd * ratio,
    };
    summary.totalInputTokens += summary.byModel[m].inputTokens;
    summary.totalOutputTokens += summary.byModel[m].outputTokens;
    summary.totalCostUsd += summary.byModel[m].costUsd;
  }
  return summary;
}

/** Daily / monthly budget thresholds (USD). Env-overridable so ops can
 *  tighten or loosen without a code deploy. Defaults are conservative —
 *  trip a Sentry alert on day 1 if the app is generating real traffic. */
function getDailyBudgetUsd(): number {
  const raw = process.env.ANTHROPIC_DAILY_BUDGET_USD;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function getMonthlyBudgetUsd(): number {
  const raw = process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 100;
}

export interface BudgetAlertResult {
  daily: { usedUsd: number; budgetUsd: number; pct: number; exceeded: boolean };
  monthly: {
    usedUsd: number;
    budgetUsd: number;
    pct: number;
    exceeded: boolean;
  };
  /** True if at least one threshold tripped — used by the cron to decide
   *  whether to fire a Sentry captureMessage. */
  shouldAlert: boolean;
}

/**
 * Check if today's / this-month's spend tripped a budget threshold and
 * fire a Sentry warning when it did. The summary is also dropped as a
 * `console.info({event:"ai_cost_summary"})` line so non-Sentry envs still
 * have something to grep.
 */
export function evaluateBudgetAlert(input: {
  dailyUsedUsd: number;
  monthlyUsedUsd: number;
  context?: Record<string, unknown>;
}): BudgetAlertResult {
  const dailyBudget = getDailyBudgetUsd();
  const monthlyBudget = getMonthlyBudgetUsd();

  const daily = {
    usedUsd: input.dailyUsedUsd,
    budgetUsd: dailyBudget,
    pct: dailyBudget > 0 ? (input.dailyUsedUsd / dailyBudget) * 100 : 0,
    exceeded: input.dailyUsedUsd > dailyBudget,
  };
  const monthly = {
    usedUsd: input.monthlyUsedUsd,
    budgetUsd: monthlyBudget,
    pct: monthlyBudget > 0 ? (input.monthlyUsedUsd / monthlyBudget) * 100 : 0,
    exceeded: input.monthlyUsedUsd > monthlyBudget,
  };
  const shouldAlert = daily.exceeded || monthly.exceeded;

  logEvent({
    event: "ai_cost_summary",
    fields: {
      dailyUsedUsd: Number(daily.usedUsd.toFixed(4)),
      dailyBudgetUsd: dailyBudget,
      dailyPct: Number(daily.pct.toFixed(1)),
      monthlyUsedUsd: Number(monthly.usedUsd.toFixed(4)),
      monthlyBudgetUsd: monthlyBudget,
      monthlyPct: Number(monthly.pct.toFixed(1)),
      shouldAlert,
      ...input.context,
    },
  });

  if (shouldAlert) {
    // Monthly overrun is a P1 (we're actively burning runway), daily is
    // P2 (likely a single bursty day, not necessarily a trend). Routing
    // tags are read by the Sentry alert rules documented in
    // `docs/harness/sentry-alerts.md`.
    captureMessage(
      `Anthropic spend exceeded budget — daily $${daily.usedUsd.toFixed(2)} / $${dailyBudget} (${daily.pct.toFixed(0)}%), monthly $${monthly.usedUsd.toFixed(2)} / $${monthlyBudget} (${monthly.pct.toFixed(0)}%)`,
      {
        level: monthly.exceeded ? "error" : "warning",
        component: "cron.ai-cost",
        alertRoute: monthly.exceeded ? "p1-page" : "p2-email",
        extra: { daily, monthly, ...input.context },
      },
    );
  }

  return { daily, monthly, shouldAlert };
}

/** Test-only escape hatch — reset in-memory buckets between specs so one
 *  test's accounting doesn't leak into the next. */
export function _resetUsageBuckets(): void {
  buckets.clear();
  callTimestamps.length = 0;
}

// =====================================================================
// Cost forecasting (Round 15 — Phase 2.D commercial readiness)
// =====================================================================

export interface MonthlyForecast {
  /** USD spent so far this month (the cron's monthly window). */
  monthToDateUsd: number;
  /** Mean daily spend over the trailing window (default 7 days) used as
   *  the per-day projection rate. */
  trailingDailyAvgUsd: number;
  /** Days observed in the trailing window. Lower than `windowDays` when
   *  the table doesn't yet have that many snapshots — affects how much
   *  weight to put on the projection. */
  trailingDaysSampled: number;
  /** Days remaining in the current calendar month (today is day 0 — the
   *  forecast assumes today's spend is already in monthToDateUsd). */
  remainingDays: number;
  /** Projected total at month end = monthToDateUsd + trailingDailyAvgUsd
   *  × remainingDays. This is the headline number for the dashboard. */
  monthEndForecastUsd: number;
  /** Configured monthly budget (env or default — same accessor that
   *  evaluateBudgetAlert uses). */
  monthlyBudgetUsd: number;
  /** monthEndForecastUsd / monthlyBudgetUsd × 100, capped to a sane
   *  display range (>= 0). */
  forecastPct: number;
  /** Three-bucket signal for the dashboard pill colour. */
  pace: "under" | "watch" | "over";
}

/** Snapshot-row shape consumed by forecast(). Decimal columns from
 *  prisma.aiCostSnapshot.findMany are coerced to plain numbers by the
 *  caller before passing in — this module stays Prisma-free so it can be
 *  unit-tested without a DB. */
export interface CostSnapshotInput {
  snapshotDate: Date;
  dailyUsedUsd: number;
}

/**
 * Project the current calendar month's total spend from a trailing
 * average of daily snapshots.
 *
 * Recipe:
 *   1. Sort the supplied snapshots by date desc, take the most recent N
 *      (default 7).
 *   2. Mean of `dailyUsedUsd` over those N days = trailingDailyAvgUsd.
 *   3. Compute `daysInMonth - dayOfMonth` for the supplied `now` (default
 *      = current time) — that's the remaining-days multiplier.
 *   4. forecast = monthToDateUsd + trailingDailyAvgUsd * remainingDays.
 *   5. pace bucket: ≤80% budget = "under", 80-110% = "watch", >110% =
 *      "over". Lets the dashboard render a colour pill without inline
 *      threshold logic.
 *
 * The forecast is intentionally NOT seasonality-adjusted — we don't have
 * enough months of data to fit weekday / weekend curves yet. Treat it
 * as a linear projection that's accurate enough to catch a budget breach
 * mid-month with the daily cron snapshot as the trigger.
 */
export function forecastMonthlyCostUsd(input: {
  snapshots: CostSnapshotInput[];
  monthToDateUsd: number;
  /** Default = 7. Lower with very fresh deploys; higher only smooths
   *  weekday spikes (we don't yet have enough data to pick a value
   *  empirically — 7 matches the grain of an A/B-able calendar week). */
  windowDays?: number;
  /** Override for testing — defaults to current Date(). */
  now?: Date;
}): MonthlyForecast {
  const windowDays = Math.max(1, input.windowDays ?? 7);
  const now = input.now ?? new Date();

  // Pull the most-recent N snapshots (already createdAt-desc by default
  // from caller, but re-sort here to make the function order-agnostic
  // against the caller).
  const sorted = [...input.snapshots].sort(
    (a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime(),
  );
  const recent = sorted.slice(0, windowDays);
  const trailingDaysSampled = recent.length;
  const trailingSum = recent.reduce((acc, r) => acc + r.dailyUsedUsd, 0);
  const trailingDailyAvgUsd =
    trailingDaysSampled > 0 ? trailingSum / trailingDaysSampled : 0;

  // Remaining-days math: days in month - current day-of-month.
  // Example: 2026-05-02 → daysInMonth=31, dayOfMonth=2 → remainingDays=29.
  // We don't subtract 1 because today's spend is already counted inside
  // monthToDateUsd — the projection covers ONLY future days.
  //
  // Construct via Date.UTC(...) — `new Date(year, month, day)` is *local*
  // time, which on a JST host shifts the "0th of next month" trick back
  // a day (UTC 31st becomes UTC 30th) and the forecast comes out one day
  // short. UTC math gives the right answer in any timezone.
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const dayOfMonth = now.getUTCDate();
  const remainingDays = Math.max(0, daysInMonth - dayOfMonth);

  const monthEndForecastUsd =
    input.monthToDateUsd + trailingDailyAvgUsd * remainingDays;

  const monthlyBudgetUsd = (() => {
    const raw = process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 100;
  })();

  const forecastPct =
    monthlyBudgetUsd > 0
      ? Math.max(0, (monthEndForecastUsd / monthlyBudgetUsd) * 100)
      : 0;

  const pace: MonthlyForecast["pace"] =
    forecastPct <= 80 ? "under" : forecastPct <= 110 ? "watch" : "over";

  return {
    monthToDateUsd: input.monthToDateUsd,
    trailingDailyAvgUsd,
    trailingDaysSampled,
    remainingDays,
    monthEndForecastUsd,
    monthlyBudgetUsd,
    forecastPct,
    pace,
  };
}
