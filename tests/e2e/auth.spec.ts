import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page renders with form fields", async ({ page }) => {
    await page.goto("/login");
    // Harenohi branding — may be in desktop panel (hidden on mobile) or mobile header
    const logos = page.locator("text=Harenohi");
    const count = await logos.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      if (await logos.nth(i).isVisible()) { found = true; break; }
    }
    expect(found).toBe(true);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("signup page renders with form fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("login page has link to signup", async ({ page }) => {
    await page.goto("/login");
    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible();
  });

  test("signup page has link to login", async ({ page }) => {
    await page.goto("/signup");
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });

  test("unauthenticated user accessing /explore is redirected to login", async ({
    page,
  }) => {
    await page.goto("/explore");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });

  test("landing page (/) is accessible without auth", async ({ page }) => {
    await page.goto("/");
    // Should NOT redirect to login — landing is public
    await expect(page).toHaveURL("/");
    await expect(page.locator("text=Harenohi").first()).toBeVisible();
  });
});
