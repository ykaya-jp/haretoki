// Sentry edge runtime init (middleware + edge route handlers). The edge SDK
// is intentionally minimal — no replays, no profiling — because edge bundles
// are size-constrained.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: dsn || undefined,
  tracesSampleRate: 0.1,
  enabled: Boolean(dsn),
});
