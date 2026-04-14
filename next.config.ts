import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Points the plugin at our App Router request config. If another engineer
// later adds Sentry's `withSentryConfig`, wrap this `nextConfig` with it
// BEFORE applying `withNextIntl` — i.e. `withNextIntl(withSentryConfig(...))`
// — so the intl plugin is the outermost wrapper (see next-intl docs).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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

export default withNextIntl(nextConfig);
