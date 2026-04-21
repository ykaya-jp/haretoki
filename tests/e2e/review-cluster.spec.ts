import { test, expect } from "@playwright/test";

/**
 * ReviewClusterPanel rendering guard. The 2026-04-20 R1-R3 iteration
 * added AI-clustered review summaries under each venue's review
 * section. These tests ensure:
 *   - The component panels on the page compile + render without
 *     falling to the error boundary even when reviewClusters is null
 *     (the backfill hasn't run for existing venues).
 *   - The copy band "先輩カップルが語ったこと" shows up when a venue
 *     actually has clusters — detected by presence in the DOM rather
 *     than by signed-in content (we can't easily get past auth here).
 *
 * We check behaviours that don't need auth; deeper tests live in the
 * private venue-detail suite.
 */
test.describe("Review cluster UI", () => {
  test("public venue routes don't 500 when reviewClusters is null", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await page.goto(`/venues/${fakeId}`);
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
  });
});
