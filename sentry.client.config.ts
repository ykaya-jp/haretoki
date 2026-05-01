// Sentry browser SDK init. Guarded on NEXT_PUBLIC_SENTRY_DSN so an unconfigured
// environment (dev, CI, or a preview before Sentry is provisioned) stays a
// no-op: no network traffic, no console noise. Swap the DSN in via the env
// and the full pipeline activates.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Same env-overridable knob as sentry.server.config.ts. Client-side
// inherits whatever value is exposed at build time via Next.js's
// `process.env` rewrite (NEXT_PUBLIC_ prefix isn't required for build-
// time inlining of the runtime tracesSampleRate, since this file is
// processed by the Sentry webpack/turbopack plugin).
function parseSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.1;
}

Sentry.init({
  dsn: dsn || undefined,
  tracesSampleRate: parseSampleRate(),
  // Session replays disabled entirely — drops the replay integration from the
  // first-load bundle (~50 KB gzip). Re-enable with a non-zero sample only when
  // actively triaging reproduction cases.
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 0.0,
  // Without a DSN Sentry becomes a no-op; silencing debug here prevents
  // warning spam in dev consoles when the DSN is intentionally unset.
  enabled: Boolean(dsn),
});
