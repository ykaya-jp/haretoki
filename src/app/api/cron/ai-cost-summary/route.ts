import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import {
  evaluateBudgetAlert,
  estimateCostUsd,
  detectDailyCostSpike,
} from "@/lib/anthropic-usage";
import { captureError, captureMessage } from "@/lib/sentry";
import { recordCronRun } from "@/lib/cron-audit";

/**
 * GET|POST /api/cron/ai-cost-summary
 *
 * Daily Anthropic spend summary + budget alert. Vercel Cron entry,
 * scheduled in vercel.json.
 *
 * Approach (intentionally simple, single round-trip):
 *  - The per-instance bucket in src/lib/anthropic-usage.ts is NOT durable
 *    across function instances, so we don't read it here. Instead we look
 *    at the durable AiCache table — every Claude round-trip that resulted
 *    in a cache write is one paid call. cache hits are zero-cost.
 *  - For each model class (haiku / sonnet) we approximate input + output
 *    token counts with a fixed AVERAGE — this is a budget guardrail, not
 *    a finance ledger, so a 30% drift in the estimate is fine. The
 *    Anthropic admin dashboard remains the source of truth for billing.
 *  - Apply estimateCostUsd() per model class, sum, hand to
 *    evaluateBudgetAlert() which fires Sentry captureMessage when over
 *    threshold and emits an `ai_cost_summary` structured log either way.
 *
 * Auth: requires Bearer CRON_SECRET (matches the other cron routes).
 *
 * Known limits:
 *  - cache writes that overwrote a prior row count as 1 each — over-counts
 *    if the same prompt_hash got rewritten in 24h (rare on production).
 *  - PDF analysis (estimate-extract.ts) does NOT pass through AiCache, so
 *    its calls are added separately from the Estimate.createdAt count.
 *  - the per-model averages live in this file — bump them if logs reveal
 *    consistent under/over-estimation.
 */

export const maxDuration = 60;

/**
 * JST-aligned date-only Date object for the `snapshot_date` upsert key.
 * Postgres DATE truncates the time, but if we pass a UTC Date the day
 * boundary slides relative to the operator's local clock; this keeps
 * the snapshot keyed on the JST calendar day the cron observed.
 */
function jstDateOnly(now: Date): Date {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
  );
}

// Per-model average tokens. Derived from a sample week of structured
// `ai_call` logs in 2026-04. Conservative side (slightly over).
const MODEL_AVG_TOKENS: Record<string, { input: number; output: number }> = {
  // Haiku — coach turn, fit-reason, ritual, vibe-suggest, matrix-insight,
  // url-extraction. Highly variable; ~5k input is the median driven by
  // url-extraction + coach context.
  "claude-haiku-4-5-20251001": { input: 5000, output: 800 },
  // Sonnet — onboarding rec, comparison, review-summary. Smaller input,
  // more output (structured JSON).
  "claude-sonnet-4-6": { input: 2000, output: 1500 },
  // estimate-extract uses Sonnet via document-block — much heavier input.
  // Treated as a separate bucket below.
  "claude-sonnet-4-6/estimate-pdf": { input: 12000, output: 2500 },
};

interface DailySummary {
  windowStart: string;
  windowEnd: string;
  byBucket: Record<
    string,
    { calls: number; estInputTokens: number; estOutputTokens: number; estCostUsd: number }
  >;
  totalCalls: number;
  totalEstCostUsd: number;
}

async function buildSummary(windowMs: number): Promise<DailySummary> {
  const end = new Date();
  const start = new Date(end.getTime() - windowMs);

  // Each AiCache row created in the window represents a paid Claude call
  // (cache miss → write). We don't have a `model` column on AiCache so
  // attribute everything to Haiku — most callers via askClaude default to
  // Haiku. If your model mix shifts, add a `model` column (P3) and split
  // here.
  const aiCacheCalls = await prisma.aiCache
    .count({
      where: { createdAt: { gte: start, lte: end } },
    })
    .catch(() => 0);

  // AiAnalysis is the cache surface for matrix-insight (Haiku) /
  // fit-reason (Haiku) / comparison (Sonnet). createdAt of the row =
  // generation time. Same approximation as above.
  const aiAnalysisCalls = await prisma.aiAnalysis
    .count({
      where: { createdAt: { gte: start, lte: end } },
    })
    .catch(() => 0);

  // PDF estimate extractions are 1-to-1 with Estimate rows that have a
  // pdfUrl (caller sets pdfUrl only after extractEstimateItems succeeds).
  const pdfCalls = await prisma.estimate
    .count({
      where: {
        createdAt: { gte: start, lte: end },
        pdfUrl: { not: null },
      },
    })
    .catch(() => 0);

  const haikuAvg = MODEL_AVG_TOKENS["claude-haiku-4-5-20251001"];
  const sonnetAvg = MODEL_AVG_TOKENS["claude-sonnet-4-6"];
  const pdfAvg = MODEL_AVG_TOKENS["claude-sonnet-4-6/estimate-pdf"];

  const byBucket: DailySummary["byBucket"] = {
    haiku_general: {
      calls: aiCacheCalls,
      estInputTokens: aiCacheCalls * haikuAvg.input,
      estOutputTokens: aiCacheCalls * haikuAvg.output,
      estCostUsd: estimateCostUsd(
        "claude-haiku-4-5-20251001",
        aiCacheCalls * haikuAvg.input,
        aiCacheCalls * haikuAvg.output,
      ),
    },
    sonnet_analysis: {
      calls: aiAnalysisCalls,
      estInputTokens: aiAnalysisCalls * sonnetAvg.input,
      estOutputTokens: aiAnalysisCalls * sonnetAvg.output,
      estCostUsd: estimateCostUsd(
        "claude-sonnet-4-6",
        aiAnalysisCalls * sonnetAvg.input,
        aiAnalysisCalls * sonnetAvg.output,
      ),
    },
    sonnet_pdf: {
      calls: pdfCalls,
      estInputTokens: pdfCalls * pdfAvg.input,
      estOutputTokens: pdfCalls * pdfAvg.output,
      estCostUsd: estimateCostUsd(
        "claude-sonnet-4-6",
        pdfCalls * pdfAvg.input,
        pdfCalls * pdfAvg.output,
      ),
    },
  };

  const totalCalls = aiCacheCalls + aiAnalysisCalls + pdfCalls;
  const totalEstCostUsd = Object.values(byBucket).reduce(
    (acc, b) => acc + b.estCostUsd,
    0,
  );

  return {
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    byBucket,
    totalCalls,
    totalEstCostUsd,
  };
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const dailyMs = 24 * 60 * 60 * 1000;
  const monthlyMs = 30 * dailyMs;
  const [daily, monthly, tierStats] = await Promise.all([
    buildSummary(dailyMs),
    buildSummary(monthlyMs),
    buildTierStats(dailyMs),
  ]);

  const alert = evaluateBudgetAlert({
    dailyUsedUsd: daily.totalEstCostUsd,
    monthlyUsedUsd: monthly.totalEstCostUsd,
    context: {
      dailyByBucket: daily.byBucket,
      monthlyTotalCalls: monthly.totalCalls,
    },
  });

  // Persist a daily snapshot the /admin/cost dashboard reads. Upsert
  // by snapshot_date (UNIQUE) so re-running the cron same day refreshes
  // the row instead of duplicating. Best-effort — a write failure is
  // logged but doesn't fail the cron (the alert pipeline already ran
  // and the JSON response below is still useful to the operator).
  const snapshotDate = jstDateOnly(new Date());
  try {
    await prisma.aiCostSnapshot.upsert({
      where: { snapshotDate },
      update: {
        dailyUsedUsd: daily.totalEstCostUsd,
        dailyBudgetUsd: alert.daily.budgetUsd,
        monthlyUsedUsd: monthly.totalEstCostUsd,
        monthlyBudgetUsd: alert.monthly.budgetUsd,
        dailyByBucket: daily.byBucket,
        shouldAlert: alert.shouldAlert,
        // Prisma's Json column rejects literal null; use Prisma.JsonNull
        // so the column's nullable storage gets a real SQL NULL on quiet
        // days (vs the JSON value `"null"`, which would silently parse
        // as a non-null object on read).
        tierStats: tierStats ?? Prisma.JsonNull,
      },
      create: {
        snapshotDate,
        dailyUsedUsd: daily.totalEstCostUsd,
        dailyBudgetUsd: alert.daily.budgetUsd,
        monthlyUsedUsd: monthly.totalEstCostUsd,
        monthlyBudgetUsd: alert.monthly.budgetUsd,
        dailyByBucket: daily.byBucket,
        shouldAlert: alert.shouldAlert,
        tierStats: tierStats ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    captureError(err, {
      component: "cron.ai-cost",
      alertRoute: "p3-digest",
      extra: { action: "ai-cost-summary:snapshot-upsert" },
    });
  }

  // Daily cost spike detection — pull the most-recent 2 snapshots
  // (today just upserted + yesterday) and compare. > +30% triggers a
  // Sentry warning at p2-email so the operator notices a sudden burn-
  // rate jump (e.g. a feature shipping a new caller without batching)
  // before it eats the monthly budget. Best-effort — a missing yesterday
  // snapshot just yields spiked=false and no alert.
  try {
    const recentSnapshots = await prisma.aiCostSnapshot.findMany({
      orderBy: { snapshotDate: "desc" },
      take: 2,
      select: { snapshotDate: true, dailyUsedUsd: true },
    });
    const spike = detectDailyCostSpike(
      recentSnapshots.map((s) => ({
        snapshotDate: s.snapshotDate,
        dailyUsedUsd: Number(s.dailyUsedUsd),
      })),
    );
    if (spike.spiked) {
      captureMessage("[cron.ai-cost] daily spend spike detected", {
        level: "warning",
        component: "cron.ai-cost",
        alertRoute: "p2-email",
        extra: {
          deltaPct: spike.deltaPct,
          todayUsd: spike.todayUsd,
          prevUsd: spike.prevUsd,
          spikeThresholdPct: spike.spikeThresholdPct,
        },
      });
    }
  } catch (err) {
    captureError(err, {
      component: "cron.ai-cost",
      alertRoute: "p3-digest",
      extra: { action: "ai-cost-summary:spike-check" },
    });
  }

  const durationMs = Date.now() - startedAt;
  await recordCronRun("ai-cost-summary", { ok: true, durationMs });
  return NextResponse.json({
    ok: true,
    durationMs,
    daily,
    monthly,
    alert,
    tierStats,
  });
}

/**
 * Round 22: per-action tier hit-rate snapshot.
 *
 * Today only the estimate-pdf path emits tier metadata via
 * `event:"estimate_extract_tier"`. Until log-drain parsing wires that
 * directly, we approximate from durable DB rows:
 *
 *   calls       = COUNT(Estimate where sourceType="ai_extracted" in window)
 *   cacheWrites = COUNT(AiCache where model="claude-sonnet-4-6" in window)
 *   cacheHits   = max(0, calls - cacheWrites)
 *   hitRate     = cacheHits / calls (rounded to 1 decimal)
 *
 * Limitation: signed-URL fallback (round 14's tier=signed-url) ALSO
 * writes to AiCache (the buffer hash recipe is the same), so this
 * count cannot split files-api vs signed-url. Once a Vercel log drain
 * is wired the structured event emits the real tier and we can replace
 * the recipe below with a precise per-tier count. Until then, the
 * dashboard renders a 2-bucket cache/non-cache split with a clear note
 * about the approximation.
 *
 * Returns null when both counts are zero (the snapshot column tolerates
 * null cleanly, and rendering "(no data)" is more honest than 0%
 * for a quiet day).
 */
async function buildTierStats(
  windowMs: number,
): Promise<Prisma.InputJsonObject | null> {
  const end = new Date();
  const start = new Date(end.getTime() - windowMs);

  const [estimateCalls, sonnetCacheWrites] = await Promise.all([
    prisma.estimate
      .count({
        where: {
          createdAt: { gte: start, lte: end },
          sourceType: "ai_extracted",
        },
      })
      .catch(() => 0),
    prisma.aiCache
      .count({
        where: {
          createdAt: { gte: start, lte: end },
          model: "claude-sonnet-4-6",
        },
      })
      .catch(() => 0),
  ]);

  if (estimateCalls === 0 && sonnetCacheWrites === 0) return null;

  const cacheHits = Math.max(0, estimateCalls - sonnetCacheWrites);
  const hitRate =
    estimateCalls > 0
      ? Number(((cacheHits / estimateCalls) * 100).toFixed(1))
      : 0;

  return {
    "estimate-pdf": {
      calls: estimateCalls,
      cacheHits,
      cacheWrites: sonnetCacheWrites,
      hitRate,
    },
  };
}
