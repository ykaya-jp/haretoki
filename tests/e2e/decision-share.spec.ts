import { test, expect } from "@playwright/test";

/**
 * Decision flow + OGP share-image smoke.
 *
 * The 2026-04-21 sprint opened Decision to both owner and partner
 * (previously owner-only), added an OGP share image, and updated the
 * candidates?view=decision flow. These tests just confirm the routes
 * render + the OGP image file path resolves without throwing at build
 * time (Next.js generates opengraph-image.tsx at request time in dev
 * / at build time in prod; we hit the HTML route which references it).
 */
test.describe("Decision + OGP", () => {
  test("candidates?view=decision does not 500 for unauthenticated users", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/candidates?view=decision");
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
  });

  test("decision OGP route for a non-existent project does not 500", async ({
    page,
  }) => {
    // Well-formed uuid, almost certainly not a real project — still must
    // render or 404 cleanly, never 500.
    const fakeProjectId = "00000000-0000-0000-0000-000000000000";
    const response = await page.goto(
      `/decision/${fakeProjectId}/opengraph-image`,
    );
    // 404 or a valid image are both fine; 500 is the failure we guard.
    expect(response?.status() ?? 0).toBeLessThan(500);
  });
});
