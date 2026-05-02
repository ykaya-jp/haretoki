import { recordAudit } from "@/server/audit";

/**
 * Phase 4 launch-readiness — one-line cron audit recorder.
 *
 * Wraps `recordAudit({ action: "cron.run", ... })` so every cron
 * route can drop a single `await recordCronRun(...)` at the end of
 * its handler and `/admin/health` can render a "last run + status
 * per cron" table without a new schema migration.
 *
 * Why not extract this into a `withCronAudit` higher-order wrapper?
 * Each cron route's handler body has a very different return shape
 * (NextResponse with mixed payloads), and wrapping invokes a
 * generic-types juggling that obscures the route logic for marginal
 * gain. A single extra line at the end of each handler is the right
 * cost-benefit.
 *
 * Best-effort by design: `recordAudit` itself is best-effort
 * (Sentry-on-failure), so this never throws. The cron's own success
 * status is unaffected by an audit-write failure.
 *
 * Usage:
 * ```ts
 * const start = Date.now();
 * try {
 *   // ... cron work ...
 *   await recordCronRun("supabase-health", { ok: true, durationMs: Date.now() - start });
 *   return NextResponse.json({ ok: true });
 * } catch (err) {
 *   await recordCronRun("supabase-health", {
 *     ok: false,
 *     durationMs: Date.now() - start,
 *     error: err instanceof Error ? err.message : "unknown",
 *   });
 *   throw err;
 * }
 * ```
 */
export async function recordCronRun(
  cron: string,
  payload: { ok: boolean; durationMs: number; error?: string },
): Promise<void> {
  await recordAudit({
    action: "cron.run",
    actorId: `cron:${cron}`,
    actorRole: "cron",
    detail: {
      cron,
      ok: payload.ok,
      durationMs: payload.durationMs,
      ...(payload.error ? { error: payload.error } : {}),
    },
  });
}

/**
 * Canonical cron name list. Mirrors `vercel.json` 1:1 — when a new
 * cron is added there, append it here too so `/admin/health` knows
 * to expect a row for it (and can flag "missing last run" when the
 * scheduled job has been silent).
 *
 * Order is alphabetical so the dashboard table reads predictably.
 */
export const CRON_NAMES = [
  "ai-cost-summary",
  "data-retention-sweep",
  "decision-followup",
  "email-suppression-retry",
  "generate-rituals",
  "monthly-report",
  "saved-search-notify",
  "supabase-health",
  "visit-reminders-day-before",
  "visit-reminders-morning-of",
  "visit-reminders-way-home",
] as const;

export type CronName = (typeof CRON_NAMES)[number];
