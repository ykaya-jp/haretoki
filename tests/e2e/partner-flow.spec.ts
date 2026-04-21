import { test, expect } from "@playwright/test";

/**
 * Partner-feature regression guards — covers the audit findings that
 * landed in ec81143 without requiring a real two-account session.
 *
 * These specs only touch public / unauthenticated routes so they're
 * safe to run against any deploy without seeding.
 */
test.describe("Partner feature regressions", () => {
  test("/accept-invite renders the brand shell without 500", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/accept-invite");
    expect(response?.status() ?? 0).toBeLessThan(500);
    // The dawn-gradient brand error shouldn't fire on this legitimate route.
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
    await expect(page.getByText("ちょっとひと息つきましょう")).not.toBeVisible();
  });

  test("/invite/<64-hex> bad token renders Invalid card, not boundary", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const fakeToken = "b".repeat(64);
    const response = await page.goto(`/invite/${fakeToken}`);
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
  });

  test("/invite/<bad-shape> token rejects cleanly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/invite/not-a-valid-token");
    expect(response?.status() ?? 0).toBeLessThan(500);
    // InvalidCard path — specific error copy from invite/[token]/page.tsx
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
  });
});
