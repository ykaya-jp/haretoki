import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// Points the plugin at our App Router request config.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Next 16.2: top-level flag enabling "use cache" directive + PPR (P1-6)
  cacheComponents: true,
  // Explicitly forward server-side env vars to the runtime.
  // Vercel dashboard env vars are sometimes not picked up by server actions
  // unless declared here or in serverRuntimeConfig.
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  },
  images: {
    remotePatterns: [
      // Supabase Storage — venue photos, avatars, PDFs
      { protocol: "https", hostname: "*.supabase.co" },
      // Seed / demo venue photos hosted on Unsplash. Kept narrow to the
      // single host so we don't regress to a wildcard that allows open
      // image-proxy abuse.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
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
  /**
   * B-4 security headers. Applied to every response unless overridden by a
   * route handler's own Response.headers. CSP is intentionally permissive
   * for inline-style/script during the React 19 + next-intl migration; it
   * can be tightened in a follow-up once hashes are generated.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(self), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // CSP — 最小限の allow-list。Supabase / Unsplash / PostHog /
            // Sentry / Vercel-analytics を許可。inline は当面許可 (migration)
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-insights.com https://*.vercel-scripts.com https://va.vercel-scripts.com https://*.posthog.com https://eu.i.posthog.com https://*.sentry.io",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-insights.com https://*.vercel-scripts.com https://va.vercel-scripts.com https://eu.i.posthog.com https://*.posthog.com https://*.sentry.io https://api.anthropic.com https://line.me",
              "media-src 'self' blob: https://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "manifest-src 'self'",
            ].join("; "),
          },
        ],
      },
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
