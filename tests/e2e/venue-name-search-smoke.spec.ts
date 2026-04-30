import { test, expect } from "@playwright/test";

/**
 * F1 venue-name-search smoke — verifies the new name-search input shows up
 * inside the AddVenueSheet on /explore. Scope is deliberately minimal:
 *   1. /explore loads (no 500 / boundary)
 *   2. The add-venue FAB is present
 *   3. Tapping the FAB opens the sheet and the NAME SEARCH label + input are visible
 *
 * End-to-end search results hit Google Places / Claude which we don't want
 * to call in CI — the "it actually returns hits" test lives in a manual
 * smoke gate with real env vars set.
 */
test.describe("Venue name search smoke", () => {
  test("search input renders inside AddVenueSheet", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/explore");
    expect(response?.status() ?? 0).toBeLessThan(500);

    // No error boundary.
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();

    // Open the add-venue sheet. The FAB is a visible "+" button fixed
    // bottom-right on explore.
    const fab = page
      .getByRole("button")
      .filter({ hasText: /(追加|add)/i })
      .first();
    // Fallback: any button with a Plus icon sibling.
    const fabFallback = page.locator("button:has(svg)").first();
    const target = (await fab.count()) > 0 ? fab : fabFallback;
    await target.click();

    // The sheet header is set by AddVenueSheet: "新しい式場を、迎える"
    await expect(page.getByText("新しい式場を、迎える")).toBeVisible({
      timeout: 10_000,
    });

    // NAME SEARCH eyebrow label + placeholder from VenueNameSearch component.
    await expect(page.getByText("NAME SEARCH")).toBeVisible();
    await expect(
      page.getByPlaceholder("式場の名前を入れてみてください"),
    ).toBeVisible();
  });
});
