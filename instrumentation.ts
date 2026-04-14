// Next.js 16 instrumentation hook. This file is the single entry point Next
// calls once per server runtime. It conditionally loads the Node or Edge
// Sentry config based on NEXT_RUNTIME so neither pulls the other's deps.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward React Server Component render errors to Sentry. No-op when the
// DSN is unset (withScope / captureException short-circuit with no transport).
export { captureRequestError as onRequestError } from "@sentry/nextjs";
