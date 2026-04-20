import { test, expect } from "@playwright/test";

/**
 * Venue detail page smoke — the page that held the majority of the
 * wife-review fixes. These tests hit a non-existent UUID so the route
 * renders `notFound()` (the Next 404 boundary) without needing an
 * authenticated session; the goal is to confirm routing + the shell
 * renders, not to exercise protected data.
 *
 * Guards we care about:
 *   - The route doesn't fall through to the 500 error boundary for a
 *     valid-shape but non-existent id.
 *   - The middleware doesn't redirect authenticated-only paths to a
 *     broken state when hit unauthenticated (should gate at /login).
 */
test.describe("Venue detail route", () => {
  test("non-existent venue id does not 500", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // Well-formed UUID that won't match any row in production.
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await page.goto(`/venues/${fakeId}`);
    // Unauthenticated → middleware should redirect to /login (302) or
    // the request should return < 500 either way. The failure mode is
    // a 500 that renders global-error.
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
    await expect(page.getByText("ちょっとひと息つきましょう")).not.toBeVisible();
  });
});
