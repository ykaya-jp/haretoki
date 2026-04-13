import { test, expect } from "@playwright/test";

test.describe("Mobile UX (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("login page fits within 375px without horizontal scroll", async ({ page }) => {
    await page.goto("/login");

    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test("signup page fits within 375px without horizontal scroll", async ({ page }) => {
    await page.goto("/signup");

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test("touch targets are at least 40px on login page", async ({ page }) => {
    await page.goto("/login");

    // Check form submit button and inputs within the login form
    // Exclude dev tools buttons injected by Next.js
    const form = page.locator("form");
    const interactives = form.locator("button, input");
    const count = await interactives.count();

    for (let i = 0; i < count; i++) {
      const el = interactives.nth(i);
      if (await el.isVisible()) {
        const box = await el.boundingBox();
        if (box && box.height > 0) {
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });
});
