import { test, expect } from "@playwright/test";

/**
 * /visits month calendar smoke — guards the W1-B route landing in
 * 5aa8a44. Month grid + upcoming/past list must render without
 * boundary fallthrough even when the couple has 0 visits.
 */
test.describe("Visit calendar route", () => {
  test("/visits renders without 500", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/visits");
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
    await expect(page.getByText("ちょっとひと息つきましょう")).not.toBeVisible();
  });
});
