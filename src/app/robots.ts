import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://haretoki.vercel.app";

/**
 * Robots policy.
 *
 * Only marketing surfaces (landing, login, signup) are crawlable. Everything
 * behind auth — home, explore, candidates, coach, mypage, per-venue pages,
 * invitation acceptance, and API routes — is disallowed because the content
 * is personal and requires a session.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/signup", "/login"],
        disallow: [
          "/home",
          "/explore",
          "/candidates",
          "/coach",
          "/mypage",
          "/venues",
          "/api",
          "/accept-invite",
          "/invite", // E-11 招待リンク: token URLs should never be indexed
          "/demo", // デモ環境 — SEO からは除外
          "/visits",
          "/checklist",
          "/compare",
          "/onboarding",
          "/settings",
          "/callback",
          "/monitoring",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
