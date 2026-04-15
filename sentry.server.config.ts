// Sentry Node SDK init for Server Components, Route Handlers, and Server
// Actions. Same guard pattern as the client config — no DSN means no-op.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: dsn || undefined,
  tracesSampleRate: 0.1,
  enabled: Boolean(dsn),
});
