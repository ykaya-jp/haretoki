import * as Sentry from "@sentry/nextjs";

/**
 * Capture an error on the server side with optional structured context.
 *
 * Guarded on NEXT_PUBLIC_SENTRY_DSN — when the DSN is unset (dev, CI, or any
 * environment before a Sentry project is provisioned) this is a fast no-op.
 * That keeps the Sentry SDK passive: no initialisation, no transport, no
 * console warnings. Production builds with the DSN set get full capture.
 *
 * Pair with existing console.error calls rather than replacing them — logs
 * remain the primary debugging surface; Sentry is for aggregated alerting.
 */
export function captureError(
  err: unknown,
  context?: Record<string, unknown>,
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}
