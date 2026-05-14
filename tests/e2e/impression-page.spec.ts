import { test, expect } from "@playwright/test";

/**
 * PR T2 — coverage for the focused-rating page added in PR #40
 * (`src/app/(app)/venues/[id]/impression/page.tsx`).
 *
 * The PR also fixed the Phase 0 "RatingSection vanished" bug by
 * splitting the input UI out of the Suspense boundary that the
 * `getCoupleRatings` partner fetch sat on. That fix is verified in
 * the venue detail spec (`venue-detail-shape.spec.ts` already
 * exercises the detail page render path) — this file focuses on the
 * NEW route.
 *
 * Auth-free verifications:
 *   1. /venues/<some-id>/impression for an unauthenticated visitor
 *      redirects to /login (= sits in `(app)/`).
 *   2. The route doesn't 500 on the auth wall.
 *
 * Authenticated verifications (env-gated, follow-up): seed a venue,
 * log in, navigate to /venues/<seeded-id>/impression, assert hero
 * + RatingSection mount, exercise the "詳細へ戻る" link.
 */

test.describe("Focused impression page (/venues/[id]/impression)", () => {
  test("redirects to /login when unauthenticated", async ({ page }) => {
    const response = await page.goto(
      "/venues/00000000-0000-4000-8000-000000000000/impression",
    );
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
  });

  test("non-existent venue id never throws on the auth wall", async ({
    page,
  }) => {
    // The `notFound()` call lives behind `requireUser`, so an
    // unauthenticated request can't reach it — but a malformed id
    // segment still has to route cleanly through Next.js dynamic
    // segment parsing. The bar is "no 5xx, no client-side crash".
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    const response = await page.goto(
      "/venues/not-a-real-uuid/impression",
    );
    expect(response?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("domcontentloaded");
    const fatal = consoleErrors.filter(
      (m) => !/Failed to fetch|WebSocket|Hydration mismatch/i.test(m),
    );
    expect(fatal, "no fatal console errors on malformed venue impression route").toEqual([]);
  });
});
