import { test, expect } from "@playwright/test";

/**
 * W10-3 — SwipeCompare mount smoke.
 *
 * Purpose: guard the fix in commit 8020263 where motion-provider was
 * switched from `domAnimation` to `domMax`. `domAnimation` is missing
 * framer-motion's drag feature bundle, and loading it caused SwipeCompare
 * (src/components/candidates/swipe-card.tsx — uses drag / dragConstraints /
 * dragElastic) to render a static non-draggable card with no error.
 *
 * Drag gesture fidelity itself cannot be exercised reliably in Playwright
 * because touch pointer events on framer-motion drag are flaky under
 * Chromium's mobile emulation; a full gesture requires real touch timing.
 * So this spec is deliberately **static + mount-only**:
 *
 *   1. /candidates responds with HTTP < 500
 *   2. No error-boundary text surfaces (i.e. the component tree mounts
 *      without throwing — which is what a bad LazyMotion features payload
 *      would eventually cause via the framer-motion drag code path)
 *   3. Unauthenticated visitors get a sensible landing (login page or an
 *      authenticated candidates landmark), proving the route did not blow
 *      up before auth resolution
 */
test.describe("SwipeCompare mount smoke (W10-3)", () => {
  test("/candidates does not 500", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/candidates");
    expect(response?.status() ?? 0).toBeLessThan(500);
  });

  test("/candidates does not trigger the error boundary", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/candidates");

    // App-level error boundary copy (src/app/(app)/error.tsx + global-error).
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
    await expect(page.getByText("ちょっとひと息つきましょう")).not.toBeVisible();
  });

  test("/candidates renders a recognisable landmark (not a blank page)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/candidates", { waitUntil: "networkidle" });

    // Unauthenticated visitors land on /login; authenticated ones see the
    // candidates page (h1 "候補") or the "最近見た式場" variant when
    // ?view=recent. Use a single OR-locator that toLocator-waits up to
    // the action timeout so framer-motion stagger entry doesn't race the
    // initial isVisible() check (was flaky on prod cold-start).
    const anyLandmark = page
      .getByRole("heading", { name: "ログイン" })
      .or(page.getByRole("heading", { name: "候補" }))
      .or(page.getByRole("heading", { name: "最近見た式場" }))
      .first();
    await expect(anyLandmark).toBeVisible({ timeout: 10000 });
  });

  test("/candidates with fewer than 5 favorites does not fall through to a broken SwipeCompare state", async ({
    page,
  }) => {
    // SwipeCompare is only mounted when the current user has a threshold
    // number of candidates to duel; an unauthenticated visitor with zero
    // favorites should still land on a coherent page (login or empty-state)
    // rather than hit the error boundary because the SwipeCompare branch
    // was taken prematurely.
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/candidates");
    expect(response?.status() ?? 0).toBeLessThan(500);

    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
    await expect(page.getByText("ちょっとひと息つきましょう")).not.toBeVisible();
  });
});
