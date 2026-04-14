import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// Points the plugin at our App Router request config.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Next 16.2: top-level flag enabling "use cache" directive + PPR (P1-6)
  cacheComponents: true,
  images: {
    remotePatterns: [
      // Supabase Storage — venue photos, avatars, PDFs
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
    // viewTransition disabled: both-page DOM coexistence during transition
    // caused net-negative latency on mobile tab switches (body thrash).
    viewTransition: false,
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/home", permanent: true },
      { source: "/conditions", destination: "/onboarding", permanent: true },
      // /compare is now a real route (Phase 3 cross-venue checklist matrix),
      // so no redirect. /shortlist and /decision remain legacy → /candidates.
      { source: "/shortlist", destination: "/candidates", permanent: true },
      { source: "/decision", destination: "/candidates", permanent: true },
      { source: "/venues", destination: "/explore", permanent: true },
    ];
  },
};

// Wrap order matters per next-intl docs: withNextIntl must be the OUTERMOST
// wrapper. withSentryConfig adds source-map upload + tunnel, safe to apply
// unconditionally (it no-ops when SENTRY_AUTH_TOKEN is unset).
export default withNextIntl(
  withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG || "haretoki",
    project: process.env.SENTRY_PROJECT || "haretoki-web",
    telemetry: false,
    widenClientFileUpload: false,
    // Serves the Sentry ingest endpoint through our own origin to dodge
    // ad-blockers that strip third-party beacon requests.
    tunnelRoute: "/monitoring",
  }),
);
