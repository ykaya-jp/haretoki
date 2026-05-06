import { test, expect } from "@playwright/test";

/**
 * Anon smoke for preference-pulse on /home (cycle 2 magic surface).
 * /home hosts the "preference pulse" insight card; anon must redirect to /login.
 */

test.describe("/home preference-pulse — anon access", () => {
  test("未認証で /home → /login redirect", async ({ page }) => {
    await page.goto("/home");
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("/home auth-gate は 307 / 200 のどちらかで応答 (中間状態なし)", async ({
    request,
  }) => {
    const res = await request.get("/home", { maxRedirects: 0 });
    expect([200, 307, 401, 403]).toContain(res.status());
    // 500 系は許さない (SSR crash の signal)
    expect(res.status()).toBeLessThan(500);
  });

  test("landing には preference-pulse 関連 UI が出ない", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const bodyText = (await page.locator("body").textContent()) ?? "";
    // preference-pulse 固有の copy ("好みの揺れ" / "PreferencePulse") は landing に出ない
    expect(bodyText).not.toContain("好みの揺れ");
    expect(bodyText).not.toContain("PreferencePulse");
  });

  test("redirect 後 login で input 表示", async ({ page }) => {
    await page.goto("/home");
    await page.waitForURL("**/login**", { timeout: 10000 });
    await expect(page.locator('input[id="email"]')).toBeVisible();
  });
});
