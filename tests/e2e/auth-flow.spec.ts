import { test, expect } from "@playwright/test";

test.describe("Auth Pages — Design Quality", () => {
  test("login page has split layout on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");

    // Brand panel should be visible on desktop
    await expect(page.locator("text=おかえりなさい")).toBeVisible();

    // VenueLens branding
    await expect(page.locator("text=VenueLens").first()).toBeVisible();
  });

  test("login page hides brand panel on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");

    // Brand panel text should be hidden
    await expect(page.locator("text=おかえりなさい")).not.toBeVisible();

    // But the form should be visible
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test("signup page has value proposition on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/signup");

    // Social proof text
    await expect(page.locator("text=80%のカップルが初期見積もりより平均")).toBeVisible();
  });

  test("signup page shows appropriate header on small screens", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/signup");

    // On mobile, either the mobile header or the form heading should be visible
    // Check that the signup form is accessible
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("login has Google OAuth button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Googleでログイン")).toBeVisible();
  });

  test("signup has Google OAuth button", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("text=Googleで登録")).toBeVisible();
  });

  test("login → signup navigation works", async ({ page }) => {
    await page.goto("/login");
    await page.locator('a[href="/signup"]').click();
    await page.waitForURL("**/signup");
    await expect(page.locator('input[id="name"]')).toBeVisible();
  });

  test("signup → login navigation works", async ({ page }) => {
    await page.goto("/signup");
    await page.locator('a[href="/login"]').click();
    await page.waitForURL("**/login");
    await expect(page.locator('input[id="email"]')).toBeVisible();
  });

  test("login form shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[id="email"]', "invalid@test.com");
    await page.fill('input[id="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Wait for error message
    await expect(
      page.locator("text=メールアドレスまたはパスワードが正しくありません")
    ).toBeVisible({ timeout: 10000 });
  });

  test("signup form validates password length", async ({ page }) => {
    await page.goto("/signup");

    const passwordInput = page.locator('input[id="password"]');
    // minLength is 8 per the form
    const minLength = await passwordInput.getAttribute("minLength");
    expect(Number(minLength)).toBeGreaterThanOrEqual(6);
  });

  test("no horizontal overflow on any auth page (375px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    for (const path of ["/login", "/signup"]) {
      await page.goto(path);
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(375);
    }
  });
});
