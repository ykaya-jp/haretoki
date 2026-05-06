import { test, expect } from "@playwright/test";

/**
 * Anon smoke for comparison enhancement (cycle 2 + modernize).
 * /compare hosts disagreement spotlight + pros/cons; both auth-gated.
 * Anon must redirect to /login regardless of URL state (?venueIds=...).
 */

test.describe("/compare comparison enhancement — anon access", () => {
  test("未認証で /compare → /login redirect", async ({ page }) => {
    await page.goto("/compare");
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("/compare?venueIds=... の URL state でも auth-gate が効く", async ({
    page,
  }) => {
    await page.goto("/compare?venueIds=foo,bar");
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("/compare HTTP status は 200/307/401/403 のいずれか (500 系を許さない)", async ({
    request,
  }) => {
    const res = await request.get("/compare?venueIds=foo,bar", {
      maxRedirects: 0,
    });
    expect([200, 307, 401, 403]).toContain(res.status());
    expect(res.status()).toBeLessThan(500);
  });

  test("landing には disagreement spotlight が出ない (authenticated 専用)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const bodyText = (await page.locator("body").textContent()) ?? "";
    // Disagreement spotlight 固有 copy ("意見の分かれ" / "Disagreement") は anon に露出しない
    expect(bodyText).not.toContain("意見の分かれ");
  });
});
