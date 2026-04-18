// Sentry browser SDK init. Guarded on NEXT_PUBLIC_SENTRY_DSN so an unconfigured
// environment (dev, CI, or a preview before Sentry is provisioned) stays a
// no-op: no network traffic, no console noise. Swap the DSN in via the env
// and the full pipeline activates.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: dsn || undefined,
  // Performance tracing at 10% sample — enough to spot regressions without
  // burning the quota. Bump per-release if we need finer-grained data.
  tracesSampleRate: 0.1,
  // Session replays disabled entirely — drops the replay integration from the
  // first-load bundle (~50 KB gzip). Re-enable with a non-zero sample only when
  // actively triaging reproduction cases.
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 0.0,
  // Without a DSN Sentry becomes a no-op; silencing debug here prevents
  // warning spam in dev consoles when the DSN is intentionally unset.
  enabled: Boolean(dsn),
});
