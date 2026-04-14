import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://haretoki.vercel.app";

/**
 * Sitemap — only static public surfaces. Authenticated routes are private
 * per robots.ts and should not appear here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
