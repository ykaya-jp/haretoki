import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("renders hero section with brand identity", async ({ page }) => {
    await page.goto("/");

    // Harenohi logo text
    const logos = page.locator("text=Harenohi");
    const count = await logos.count();
    expect(count).toBeGreaterThan(0);
    let logoVisible = false;
    for (let i = 0; i < count; i++) {
      if (await logos.nth(i).isVisible()) { logoVisible = true; break; }
    }
    expect(logoVisible).toBe(true);

    // Main headline
    await expect(
      page.locator("text=ふたりで選ぶ").first()
    ).toBeVisible();

    // CTAs
    await expect(page.locator("text=無料ではじめる")).toBeVisible();
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
      page.locator("text=見積もりの裏側を知る")
    ).toBeVisible();
    await expect(page.locator("text=データで比較する")).toBeVisible();
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
