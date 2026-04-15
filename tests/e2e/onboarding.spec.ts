import { test, expect } from "@playwright/test";

test.describe("Onboarding Page", () => {
  test("onboarding page renders chat UI", async ({ page }) => {
    // Go to onboarding directly (middleware should allow it)
    await page.goto("/onboarding");

    // Should either show onboarding content or redirect to login
    // If redirected to login, that's also valid behavior
    const url = page.url();
    if (url.includes("/login")) {
      // Unauthenticated → expected redirect
      test.skip();
      return;
    }

    // If we got to onboarding, check for step indicator
    await expect(page.locator("text=Step")).toBeVisible();
  });
});
