import { test, expect } from "@playwright/test";

const PAGES_REQUIRING_AUTH = [
  { path: "/", name: "Home" },
  { path: "/explore", name: "Explore" },
  { path: "/candidates", name: "Candidates" },
  { path: "/coach", name: "Coach" },
  { path: "/onboarding", name: "Onboarding" },
];

test.describe("Page Loading", () => {
  for (const { path, name } of PAGES_REQUIRING_AUTH) {
    test(`${name} (${path}) loads without 500 error`, async ({ page }) => {
      const response = await page.goto(path);
      // Should be 200 (page renders) or 307/302 (redirect to login)
      expect(response?.status()).toBeLessThan(500);
    });
  }

  test("login page returns 200", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
  });

  test("signup page returns 200", async ({ page }) => {
    const response = await page.goto("/signup");
    expect(response?.status()).toBe(200);
  });

  test("404 page for unknown route", async ({ page }) => {
    await page.goto("/nonexistent-route-xyz");
    // Next.js App Router returns 200 with custom not-found page,
    // or redirects unauthenticated users to /login.
    // Either way, the app should not crash (no 500 error).
    const url = page.url();
    const isLoginRedirect = url.includes("/login");
    const isNotFound = await page.locator("text=404").isVisible().catch(() => false);
    const isNotFoundAlt = await page.locator("text=not found").isVisible().catch(() => false);
    // Accept: redirected to login OR showing a not-found indicator
    expect(isLoginRedirect || isNotFound || isNotFoundAlt).toBe(true);
  });
});
