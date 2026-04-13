import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("renders hero section with brand identity", async ({ page }) => {
    await page.goto("/");

    // Harenohi logo text (multiple instances possible — hero + footer)
    const logos = page.locator("text=Harenohi");
    const count = await logos.count();
    expect(count).toBeGreaterThan(0);
    let logoVisible = false;
    for (let i = 0; i < count; i++) {
      if (await logos.nth(i).isVisible()) { logoVisible = true; break; }
    }
    expect(logoVisible).toBe(true);

    // Main headline (may appear in hero + meta)
    await expect(
      page.locator("text=二人で自然に、迷わず、後悔なく式場を選べる").first()
    ).toBeVisible();

    // CTAs
    await expect(page.locator("text=無料ではじめる")).toBeVisible();
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  });

  test("shows statistics section", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("text=80%").first()).toBeVisible();
    await expect(page.locator("text=2.6件")).toBeVisible();
    await expect(page.locator("text=68.5%")).toBeVisible();
  });

  test("shows feature cards", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator("text=AIが見積もりの落とし穴を先回り")
    ).toBeVisible();
    await expect(page.locator("text=データで納得できる比較")).toBeVisible();
    await expect(page.locator("text=二人の意見を見える化")).toBeVisible();
    await expect(page.locator("text=中立な立場で支援")).toBeVisible();
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

    // Signup page should have name, email, password fields
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
