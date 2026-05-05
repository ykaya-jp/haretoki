import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("renders hero section with brand identity", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Brand logo — page has multiple Haretoki references, one must be visible
    await expect(page.locator("text=Haretoki").first()).toBeVisible({
      timeout: 10000,
    });

    // Main headline
    await expect(page.locator("text=その直感").first()).toBeVisible();

    // CTAs — primary CTA mixes ChevronRight icon with text, getByRole avoids
    // strict-mode null on framer-motion stagger races.
    await expect(
      page.getByRole("link", { name: /無料ではじめる/ }).first(),
    ).toBeVisible();
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  });

  test("shows statistics section", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("text=80%").first()).toBeVisible();
    await expect(page.locator("text=2.8件").first()).toBeVisible();
  });

  test("shows feature cards", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator("text=見積もりの先を読む")
    ).toBeVisible();
    await expect(page.locator("text=数字で選ぶ").first()).toBeVisible();
  });

  test("CTA links to signup", async ({ page }) => {
    await page.goto("/");

    const cta = page.locator('a[href="/signup"]').first();
    await expect(cta).toBeVisible();
  });

  test("has no horizontal scroll on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });
});

test.describe("Landing → Auth Flow", () => {
  test("signup link from landing navigates to signup page", async ({
    page,
  }) => {
    await page.goto("/");

    await page.locator('a[href="/signup"]').first().click();
    await page.waitForURL("**/signup");

    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test("login link from landing navigates to login page", async ({
    page,
  }) => {
    await page.goto("/");

    await page.locator("text=ログイン").first().click();
    await page.waitForURL("**/login");

    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });
});
