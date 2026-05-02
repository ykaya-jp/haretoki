import * as Sentry from "@sentry/nextjs";

/**
 * Sentry capture helpers + tag taxonomy.
 *
 * Two helpers (`captureError` for thrown exceptions, `captureMessage` for
 * structured warnings/info), both:
 *
 *  - DSN-guarded — when `NEXT_PUBLIC_SENTRY_DSN` is unset (dev / CI / any
 *    environment before a Sentry project is provisioned) the call is a
 *    fast no-op. No initialisation, no transport, no console warnings.
 *
 *  - Tag-aware — every event carries `component` (which subsystem) and
 *    `alert_route` (which Sentry alert rule should fan out) tags that the
 *    operator wires in the Sentry dashboard. Documented in
 *    `docs/harness/sentry-alerts.md`.
 *
 * Pair these with the structured-log helper in `src/lib/observability.ts`
 * — Sentry is for "alert me", logs are for "let me grep / dashboard". Most
 * call sites do both.
 */

/**
 * Subsystem identifier. Add a new value here AND a row in
 * `docs/harness/sentry-alerts.md` so the alert routing table stays the
 * single source of truth.
 */
export type SentryComponent =
  | "cron.visit-reminder"
  | "cron.ai-cost"
  | "cron.daily-ritual"
  | "cron.saved-search"
  | "cron.decision-followup"
  | "webhook.resend"
  | "botid"
  | "ai.claude"
  | "ai.cache"
  | "auth"
  | "db"
  | "support"
  | "rate-limit"
  /** Track B-2 web-push send pipeline (per-endpoint failures + VAPID setup). */
  | "push.send"
  /** Cron health probe of upstream services (Supabase, etc). */
  | "cron.health";

/**
 * Operator-facing routing key. The Sentry alert rule filters on this tag
 * to decide where to fan out:
 *   - `p1-page`  → Slack #ops-p1 + PagerDuty (data loss / auth bypass /
 *     full outage)
 *   - `p2-email` → Slack #ops + email digest (degradation / cost
 *     overrun / repeated failures)
 *   - `p3-digest` → daily digest only (informational signals: bot
 *     blocks, single bounce, drift detection)
 */
export type SentryAlertRoute = "p1-page" | "p2-email" | "p3-digest";

export interface SentryCaptureOptions {
  /** Subsystem the event came from. Sets the `component` tag. */
  component?: SentryComponent;
  /** Routing key for the operator. Sets the `alert_route` tag. */
  alertRoute?: SentryAlertRoute;
  /** Free-form structured context attached as `extra`. */
  extra?: Record<string, unknown>;
}

function applyScope(
  scope: Sentry.Scope,
  opts: SentryCaptureOptions | undefined,
): void {
  if (!opts) return;
  if (opts.component) scope.setTag("component", opts.component);
  if (opts.alertRoute) scope.setTag("alert_route", opts.alertRoute);
  if (opts.extra) scope.setExtras(opts.extra);
}

/**
 * Capture a thrown exception. The legacy positional-extra signature is
 * still supported (`captureError(err, { foo: "bar" })`) so existing
 * call sites keep working until the rolling migration is complete.
 */
export function captureError(
  err: unknown,
  options?: SentryCaptureOptions | Record<string, unknown>,
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const opts = normaliseOptions(options);
  Sentry.withScope((scope) => {
    applyScope(scope, opts);
    Sentry.captureException(err);
  });
}

/**
 * Capture a structured message at the given severity level. Same legacy
 * signature compatibility as `captureError`.
 */
export function captureMessage(
  message: string,
  options?:
    | (SentryCaptureOptions & { level?: "info" | "warning" | "error" })
    | { level?: "info" | "warning" | "error"; extra?: Record<string, unknown> },
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const opts = normaliseOptions(options);
  const level = (options as { level?: "info" | "warning" | "error" } | undefined)?.level;
  Sentry.withScope((scope) => {
    applyScope(scope, opts);
    Sentry.captureMessage(message, level ?? "warning");
  });
}

/**
 * Accept either the new structured options shape or the legacy
 * "anything goes" extras-bag and return a normalised
 * `SentryCaptureOptions`. Distinguishes by checking for known keys —
 * if the caller passed `component` / `alertRoute` / `extra` we treat it
 * as the new shape, otherwise we move the entire bag into `extra`.
 *
 * This keeps the migration zero-risk: untouched call sites still produce
 * captured events with their context preserved as extras.
 */
function normaliseOptions(
  options:
    | SentryCaptureOptions
    | (Record<string, unknown> & { level?: unknown })
    | undefined,
): SentryCaptureOptions | undefined {
  if (!options) return undefined;
  const o = options as Record<string, unknown>;
  const hasStructuredKey =
    "component" in o || "alertRoute" in o || "extra" in o;
  if (hasStructuredKey) {
    return {
      component: o.component as SentryComponent | undefined,
      alertRoute: o.alertRoute as SentryAlertRoute | undefined,
      extra: o.extra as Record<string, unknown> | undefined,
    };
  }
  // Legacy: `level` is a SentryLevel for captureMessage and isn't part of
  // extras; strip it before bundling the rest into extras.
  const { level: _level, ...rest } = o;
  void _level;
  return Object.keys(rest).length > 0 ? { extra: rest } : undefined;
}
