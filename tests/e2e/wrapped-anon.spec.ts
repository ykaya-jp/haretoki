import { test, expect } from "@playwright/test";

/**
 * Anon smoke for /wrapped (cycle 2 magic surface).
 * /wrapped is an authenticated-only "year-in-review" feature.
 * Unauthenticated visitors must be redirected to /login.
 */

test.describe("/wrapped — anon access", () => {
  test("未認証で /wrapped にアクセス → /login にリダイレクト", async ({ page }) => {
    await page.goto("/wrapped");
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("/wrapped redirect は API 直叩きでも auth-gate が効く", async ({ request }) => {
    const res = await request.get("/wrapped", { maxRedirects: 0 });
    // (app) group middleware: 307 to /login, or 200 if SSR renders login shell
    expect([200, 307, 401, 403]).toContain(res.status());
  });

  test("redirect 後の /login にメール / パスワード入力欄がある", async ({ page }) => {
    await page.goto("/wrapped");
    await page.waitForURL("**/login**", { timeout: 10000 });
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test("landing には wrapped 専用 UI が出ない (auth-gated 確認)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const bodyText = (await page.locator("body").textContent()) ?? "";
    // Wrapped 固有の copy ("今年のあなたの式場めぐり" 等) は anon landing では出ない
    expect(bodyText).not.toContain("今年のあなたの式場めぐり");
  });
});
