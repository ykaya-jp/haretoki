import { test, expect } from "@playwright/test";

/**
 * Full anon journey smoke — landing → signup → back → logo → footer links.
 * Complements existing user-journey.spec.ts with end-to-end chain coverage.
 */

test.describe("Full anon journey — landing → signup → footer", () => {
  test("landing → 「無料ではじめる」 → /signup", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const cta = page.getByRole("link", { name: /無料ではじめる/ }).first();
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await page.waitForURL("**/signup", { timeout: 10000 });
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="name"]')).toBeVisible();
  });

  test("/signup → logo click → / に戻る", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "networkidle" });
    // Find a visible logo link (multiple may exist with different visibility)
    const logos = page.locator('a[href="/"]').filter({ hasText: "Haretoki" });
    const logoCount = await logos.count();
    let clicked = false;
    for (let i = 0; i < logoCount; i++) {
      const link = logos.nth(i);
      if (await link.isVisible()) {
        await link.click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBe(true);
    await page.waitForURL("/", { timeout: 10000 });
    await expect(page.locator("text=その直感").first()).toBeVisible();
  });

  test("landing footer links lead to live pages (not 404/500)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const footerLinks = page.locator("footer a");
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);

    // Collect href values for first 8 footer links
    const hrefs: string[] = [];
    for (let i = 0; i < Math.min(count, 8); i++) {
      const href = await footerLinks.nth(i).getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !href.startsWith("/api/")
      ) {
        hrefs.push(href);
      }
    }
    expect(hrefs.length).toBeGreaterThan(0);

    // Each footer route must respond (non-5xx). 404 is also fail signal —
    // public footer should only link to live routes.
    for (const href of hrefs) {
      const res = await page.request.get(href, { maxRedirects: 0 });
      const status = res.status();
      expect(
        status,
        `footer link ${href} returned ${status}`,
      ).toBeLessThan(500);
      // 200 / 307 (redirect to login for some legal pages?) / 308 OK; 404 NG
      expect([200, 301, 302, 307, 308]).toContain(status);
    }
  });

  test("legal pages (/terms /privacy) are reachable when present in footer", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const footerHtml = await page.locator("footer").innerHTML();
    // Conditionally test only if these links exist in footer
    const hasTerms = footerHtml.includes("/terms");
    const hasPrivacy = footerHtml.includes("/privacy");

    if (hasTerms) {
      const res = await page.request.get("/terms", { maxRedirects: 5 });
      expect(res.status()).toBeLessThan(500);
      expect(res.status()).toBeLessThan(404);
    }
    if (hasPrivacy) {
      const res = await page.request.get("/privacy", { maxRedirects: 5 });
      expect(res.status()).toBeLessThan(500);
      expect(res.status()).toBeLessThan(404);
    }
    // If neither exists, the test still passes — public-only smoke
    expect(true).toBe(true);
  });

  test("/ → /login → / chain (round-trip)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator("text=ログイン").first().click();
    await page.waitForURL("**/login", { timeout: 10000 });
    await expect(page.locator('input[id="email"]')).toBeVisible();

    // Logo back to /
    const logos = page.locator('a[href="/"]').filter({ hasText: "Haretoki" });
    const logoCount = await logos.count();
    for (let i = 0; i < logoCount; i++) {
      const link = logos.nth(i);
      if (await link.isVisible()) {
        await link.click();
        break;
      }
    }
    await page.waitForURL("/", { timeout: 10000 });
    await expect(page.locator("text=その直感").first()).toBeVisible();
  });
});
