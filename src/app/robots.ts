import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://haretoki.vercel.app";

/**
 * Robots policy.
 *
 * Crawlable surfaces are limited to marketing + legal documents:
 *   - / (landing), /signup, /login — discovery / acquisition surfaces
 *   - /terms, /privacy — legal documents that should be reachable from
 *     external search and from compliance review tools without an account
 *
 * Everything behind auth — home, explore, candidates, coach, mypage,
 * per-venue pages, invitation acceptance, /support (auth-gated FAQ +
 * contact form), and API routes — is disallowed because the content is
 * personal and requires a session.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/signup", "/login", "/terms", "/privacy"],
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
          // Operator-only dashboards (cost, audit, ...). Each page also
          // sets `robots: { index: false }` per-page metadata + 404s
          // non-admins via requireAdmin(); this disallow is the third
          // locked door.
          "/admin",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
