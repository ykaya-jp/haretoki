import { prisma } from "@/server/db";
import type { AiAnalysisType } from "@/generated/prisma/client";
import { logEvent } from "@/lib/observability";

/**
 * Per-type TTL for AiAnalysis-backed caching. Keep this map as the single
 * source of truth — callers must not inline their own `createdAt: { gte: ...
 * }` cutoffs, otherwise cache semantics drift across call sites and the
 * hit-rate target becomes impossible to reason about.
 *
 * `coach_chat` is intentionally absent — every turn is per-user and per-
 * thread, so the marginal hit rate would be ~0.
 */
const TTL_DAYS: Partial<Record<AiAnalysisType, number>> = {
  review_summary: 30,
  estimate_prediction: 7,
  comparison: 3,
  visit_prep: 1,
  rating_comparison: 1,
  fit_reason: 14,
  matrix_insight: 3,
  // coach_chat: no cache
};

/**
 * Lookup a cached AiAnalysis row by (project, type, inputHash) within the
 * type's TTL. Returns the stored `output` string or null on miss / expiry.
 *
 * Inputs to `inputHash` MUST include model id and prompt version so a model
 * upgrade or prompt revision invalidates stale rows automatically — without
 * that, callers will silently serve pre-upgrade outputs after a deploy.
 */
export async function getCachedAnalysis(
  projectId: string,
  type: AiAnalysisType,
  inputHash: string,
): Promise<string | null> {
  const ttlDays = TTL_DAYS[type];
  if (!ttlDays) return null;

  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);

  const cached = await prisma.aiAnalysis.findFirst({
    where: {
      projectId,
      type,
      inputHash,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });

  // Lightweight hit/miss telemetry. Vercel Log Drain consumers filter on
  // event="ai_analysis_cache_lookup" to estimate hit rate per type
  // without wiring a dashboard. Avoid logging the inputHash payload —
  // it can leak signal about user content via length / distribution.
  logEvent({
    event: "ai_analysis_cache_lookup",
    fields: { type, outcome: cached ? "hit" : "miss" },
  });

  return cached?.output ?? null;
}

/**
 * Persist a Claude response under (project, type, inputHash). Pair this
 * with `getCachedAnalysis` so the read/write contract stays symmetric and
 * callers don't have to know about the underlying table layout.
 *
 * `venueId` is optional but recommended — when present it lets
 * `invalidateAiCache(venueId, ...)` purge venue-scoped rows after the venue
 * is edited or 手放した, without nuking project-wide caches.
 *
 * Failures are swallowed (best-effort), matching the existing AiCache
 * setter behavior — a cache write that 500s should never break the calling
 * action's user-visible response.
 */
export async function setCachedAnalysis(input: {
  projectId: string;
  type: AiAnalysisType;
  inputHash: string;
  output: string;
  venueId?: string | null;
}): Promise<void> {
  try {
    await prisma.aiAnalysis.create({
      data: {
        projectId: input.projectId,
        type: input.type,
        inputHash: input.inputHash,
        output: input.output,
        venueId: input.venueId ?? null,
      },
    });
  } catch {
    // Cache write is non-fatal. A unique-constraint conflict would mean a
    // concurrent caller already won the race; either way the stored output
    // is good enough for the next reader.
  }
}

export async function invalidateAiCache(
  venueId: string,
  types: AiAnalysisType[],
): Promise<number> {
  const result = await prisma.aiAnalysis.deleteMany({
    where: {
      venueId,
      type: { in: types },
    },
  });
  return result.count;
}

/** Read-only TTL accessor for tests + diagnostic UIs. */
export function getCacheTtlDays(type: AiAnalysisType): number | null {
  return TTL_DAYS[type] ?? null;
}
