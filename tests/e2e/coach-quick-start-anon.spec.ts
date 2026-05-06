import { test, expect } from "@playwright/test";

/**
 * Anon smoke for /coach quick-start (cycle 2 magic surface).
 * /coach hosts the AI coach with quick-start prompts; auth-gated.
 */

test.describe("/coach quick-start — anon access", () => {
  test("未認証で /coach → /login redirect", async ({ page }) => {
    await page.goto("/coach");
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("redirect 後 login screen に入力欄が表示", async ({ page }) => {
    await page.goto("/coach");
    await page.waitForURL("**/login**", { timeout: 10000 });
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("coach API stream は anon で 307/401/403/501", async ({ request }) => {
    const res = await request.get("/api/coach/stream", { maxRedirects: 0 });
    expect([307, 401, 403, 501]).toContain(res.status());
  });

  test("/coach HTTP status は 500 系を返さない", async ({ request }) => {
    const res = await request.get("/coach", { maxRedirects: 0 });
    expect(res.status()).toBeLessThan(500);
  });

  test("landing には coach quick-start 専用 UI が露出しない", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const bodyText = (await page.locator("body").textContent()) ?? "";
    // Quick-start 固有 copy ("AIに聞いてみる" / quick-start prompts) は anon に出ない
    // landing 側には "AIコーチ" の説明はあるが quick-start prompt 自体は出さない
    expect(bodyText).not.toContain("見積もりの落とし穴を教えて");
  });
});
