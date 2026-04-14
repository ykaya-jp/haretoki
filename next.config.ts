import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/home", permanent: true },
      { source: "/conditions", destination: "/onboarding", permanent: true },
      { source: "/compare", destination: "/candidates", permanent: true },
      { source: "/shortlist", destination: "/candidates", permanent: true },
      { source: "/decision", destination: "/candidates", permanent: true },
      { source: "/venues", destination: "/explore", permanent: true },
    ];
  },
};

// withSentryConfig injects the Sentry webpack plugin (source-map upload,
// release tagging) and a proxy for the Sentry API to avoid ad-blockers.
// Upload is only triggered when SENTRY_AUTH_TOKEN is set — the wrapper is
// safe to apply unconditionally. silent:true + telemetry:false keep dev
// builds quiet and private.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG || "haretoki",
  project: process.env.SENTRY_PROJECT || "haretoki-web",
  telemetry: false,
  widenClientFileUpload: false,
  // Serves the Sentry ingest endpoint through our own origin to dodge
  // ad-blockers that strip third-party beacon requests.
  tunnelRoute: "/monitoring",
});
