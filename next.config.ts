import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import nextBundleAnalyzer from "@next/bundle-analyzer";

// Phase 4 launch readiness — opt-in bundle analyzer. `ANALYZE=true npm
// run build:local` writes interactive HTML reports under .next/analyze/
// (one per bundle: client / server / edge). Disabled by default so a
// regular CI/prod build skips the analyzer overhead entirely.
const withBundleAnalyzer = nextBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  // Next 16.2: top-level flag enabling "use cache" directive + PPR (P1-6)
  cacheComponents: true,
  // Inline server env vars at build time. ANTHROPIC_API_KEY is only imported
  // by src/lib/anthropic.ts (server-only), so tree-shaking excludes it from
  // client bundles. This fixes Vercel server-action runtime not seeing
  // dashboard env vars in Next 16.2 + cacheComponents.
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  },
  images: {
    // Allow any HTTPS source. We accept that this widens the
    // image-proxy surface, but the source of URLs is our own extraction
    // pipeline (not arbitrary user input), and the alternative — a
    // strict host allow-list — was throwing "hostname is not configured"
    // runtime errors on the detail page whenever a venue carried a URL
    // from a host we hadn't added yet (e.g. zexy promo banners served
    // from a CDN outside `*.zexy.net`). Listing every possible wedding
    // CDN is a moving target we keep losing.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
    // viewTransition disabled: both-page DOM coexistence during transition
    // caused net-negative latency on mobile tab switches (body thrash).
    viewTransition: false,
    // Default Server Actions body limit is 1MB. A single iPhone photo is
    // often 3-8MB, so uploads via "写真を追加" silently failed with
    // "アップロードできませんでした" before the 10MB per-file server-side
    // guard could run. Raise to 20MB — generous enough for a couple of
    // full-res photos per call while the per-file size guard still trims
    // anything over 10MB inside uploadVenuePhotos.
    serverActions: {
      bodySizeLimit: "20mb",
    },
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
   * for inline-style/script during the React 19 migration; it can be
   * tightened in a follow-up once hashes are generated.
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
              // Mirror the images.remotePatterns: any HTTPS image for the
              // same reason the Next/Image config widened.
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-insights.com https://*.vercel-scripts.com https://va.vercel-scripts.com https://eu.i.posthog.com https://*.posthog.com https://*.sentry.io https://api.anthropic.com https://line.me",
              "media-src 'self' blob: https://*.supabase.co",
              // Allow OpenStreetMap iframe embeds used by VenueFactSheet.
              // Without an explicit frame-src the directive falls through to
              // default-src 'self' and blocks the map, leaving a broken-image
              // icon in the middle of every venue detail page.
              "frame-src 'self' https://www.openstreetmap.org",
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

// withSentryConfig adds source-map upload + tunnel, safe to apply
// unconditionally (it no-ops when SENTRY_AUTH_TOKEN is unset).
// withBundleAnalyzer wraps the inner config first so its `webpack`
// hook composes inside Sentry's outer wrapper (Sentry's own webpack
// plugin must run last to see the final compiled module map).
export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG || "haretoki",
  project: process.env.SENTRY_PROJECT || "haretoki-web",
  telemetry: false,
  widenClientFileUpload: false,
  // Serves the Sentry ingest endpoint through our own origin to dodge
  // ad-blockers that strip third-party beacon requests.
  tunnelRoute: "/monitoring",
});
