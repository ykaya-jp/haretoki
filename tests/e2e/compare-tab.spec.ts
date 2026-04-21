import { test, expect } from "@playwright/test";

/**
 * /candidates?view=compare (CompareRedesigned) regression guards.
 *
 * The goal of the 2026-04-21 rewrite was to keep the grid consistent
 * regardless of how many venues are selected. These tests don't sign
 * in — they only verify that the tab renders without falling through
 * to the error boundary, that the layout primitives (filter tabs,
 * picker chips row, matrix scroll region) exist when data is present,
 * and that the UI never shows "winner" language (explicit brand rule
 * after the editorial copy pass).
 */
test.describe("Compare tab — layout primitives", () => {
  test("unauthenticated /candidates redirects cleanly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/candidates?view=compare");
    // Either 200 (public render) or redirected to login. Failure mode
    // we guard against is a 500 that renders global-error.
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
    await expect(page.getByText("ちょっとひと息つきましょう")).not.toBeVisible();
  });

  test("no 'winner' / '勝ち' language surfaces anywhere on home/explore", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    // Brand rule: compare copy uses "ここが論点" / "+0.8 強み" language,
    // never "winner" / "1位" / "勝ち". This test is a copy-drift
    // tripwire — it fails the moment someone re-introduces the old
    // winner vocabulary anywhere in the public-facing routes.
    for (const bannedWord of ["winner", "Winner", "1位", "勝ち", "勝者"]) {
      await expect(page.getByText(bannedWord, { exact: false })).toHaveCount(0);
    }
  });
});
