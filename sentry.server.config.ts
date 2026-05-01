// Sentry Node SDK init for Server Components, Route Handlers, and Server
// Actions. Same guard pattern as the client config — no DSN means no-op.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Performance trace sampling — env-overridable for per-release tuning.
// `SENTRY_TRACES_SAMPLE_RATE` defaults to 0.1 (10%); set higher when
// investigating a regression, lower when burning the quota too fast.
function parseSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.1;
}

Sentry.init({
  dsn: dsn || undefined,
  tracesSampleRate: parseSampleRate(),
  enabled: Boolean(dsn),
});
