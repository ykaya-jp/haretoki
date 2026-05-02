/**
 * Vercel Observability — structured-log helper.
 *
 * Wraps `console.info(JSON.stringify({ event: "<name>", ... }))` so every
 * structured log line shares an event taxonomy that the Vercel Log Drain
 * (or `vercel logs --json`) can filter on. The Sentry side
 * (`src/lib/sentry.ts`) handles "alert me"; this module handles "let me
 * grep / dashboard".
 *
 * Why a helper instead of letting each caller write its own JSON:
 *
 *  - One place to add fields every event should carry (timestamp, env,
 *    deployment id) without scavenging across the codebase.
 *  - TypeScript narrows `event` so a typo at the call site fails tsc
 *    instead of silently splitting the event stream into two buckets.
 *  - Cheap to add new event types — extend the union, document the
 *    field shape in `docs/harness/sentry-alerts.md`.
 *
 * Performance budget: this is a sync `console.info` call. Vercel's
 * function runtime fans these to the log stream asynchronously, so the
 * call site cost is just the JSON.stringify. Keep field counts <20 so a
 * burst doesn't dominate latency.
 */

/**
 * Discriminated event names. Keep this list in sync with the
 * `docs/harness/sentry-alerts.md` event catalog (the doc is the SoT
 * for which Sentry alert rule fires off which event).
 */
export type LogEventName =
  /** Per Claude round-trip, emitted from `recordUsage()`. */
  | "ai_call"
  /** Daily Anthropic budget summary, from `evaluateBudgetAlert()`. */
  | "ai_cost_summary"
  /** Generic AiCache lookup outcome, from `getCachedResponse()`. */
  | "ai_cache_lookup"
  /** Project-scoped AiAnalysis lookup, from `getCachedAnalysis()`. */
  | "ai_analysis_cache_lookup"
  /** Visit-reminder cron run summary (one per cron tick). */
  | "visit_reminder_cron"
  /** Resend webhook event applied (or ignored). */
  | "resend_webhook"
  /** BotID flagged a request — paired with a Sentry warning. */
  | "botid_block"
  /** Generic rate-limit kicked in — caller decides whether to also alert. */
  | "rate_limit_exceeded"
  /** Support form submission outcome (delivered / queued / dropped). */
  | "support_message"
  /** GDPR data export bundle delivered. */
  | "user_export"
  /** GDPR data deletion completed. */
  | "user_delete"
  /** Daily soft-bounce email re-enable cron summary. */
  | "email_suppression_retry"
  /** Daily AiCostSnapshot + AuditLog rolling deletion summary. */
  | "data_retention_sweep"
  /**
   * Track B-2: per-user push fan-out abort signal (currently only
   * `vapid-missing`, logged once per user per cron tick — operator
   * misconfig surface).
   */
  | "push_send_skipped";

interface LogEventInput {
  /** Event taxonomy name. Must be a known `LogEventName`. */
  event: LogEventName;
  /** Free-form structured fields. Avoid PII — log the shape, not the
   *  value (e.g. `email_domain` instead of `email`). */
  fields?: Record<string, unknown>;
}

/**
 * Emit a structured log line. The shape is always a single JSON object
 * with `event` as the discriminator — Vercel Log Drain consumers parse
 * the payload and route by `event`, so don't break that contract.
 *
 * Usage:
 *   logEvent({ event: "visit_reminder_cron", fields: { phase: "day_before",
 *     candidates: 3, notified: 6, errored: 0 } });
 */
export function logEvent(input: LogEventInput): void {
  const { event, fields = {} } = input;
  // Avoid spread surprises: discard a caller's `event` field if they
  // happen to put one in `fields`.
  const { event: _ignored, ...safeFields } = fields as { event?: unknown };
  void _ignored;
  console.info(
    JSON.stringify({
      event,
      ...safeFields,
    }),
  );
}

/**
 * Convenience wrapper — emit a log line AND stamp the same payload onto
 * Sentry as a breadcrumb so a subsequent captureError event has the
 * recent log context attached. Use sparingly: every breadcrumb costs
 * a small amount of buffer space in the Sentry SDK.
 */
export function logEventWithBreadcrumb(input: LogEventInput): void {
  logEvent(input);
  // Lazy import to avoid eager Sentry init in test envs that mock the log
  // helper but not the Sentry module.
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // Dynamic import is async; fire-and-forget so we don't block the
    // call site. Failure is silent — breadcrumbs are nice-to-have.
    import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.addBreadcrumb({
          category: input.event,
          level: "info",
          data: input.fields,
        });
      })
      .catch(() => {
        // ignored — breadcrumb is non-critical
      });
  }
}
