import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://haretoki.vercel.app";

/**
 * Sitemap — only static public surfaces. Authenticated routes are private
 * per robots.ts and should not appear here.
 *
 * Legal pages (/terms, /privacy) are explicitly listed: search engines
 * surfacing the privacy policy directly is a positive signal for trust /
 * compliance review. Both update on the order of months at most, so the
 * lower changeFrequency / priority match the marketing pages but stay
 * visible to crawlers.
 *
 * /support is intentionally excluded — it lives under (app) and requires
 * auth; the canonical contact path for the public web is the form on the
 * authenticated surface, not an indexable page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
