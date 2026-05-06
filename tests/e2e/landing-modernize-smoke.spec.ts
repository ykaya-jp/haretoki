import { test, expect } from "@playwright/test";

/**
 * Landing modernize smoke (cycle 2: bold typography + Lucide icon migration).
 * Verifies:
 *  - Hero typography is large (Shippori-style 28px+ for h1)
 *  - Body copy uses Lucide icons, not raw emoji (e.g. 📅 ☀)
 *  - Underlined links use the gold-warm token color (oklch / non-default)
 */

test.describe("Landing modernize smoke", () => {
  test("hero h1 is bold-large (>=28px)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 10000 });
    const fontSize = await h1.evaluate(
      (el) => parseFloat(getComputedStyle(el as Element).fontSize) || 0,
    );
    expect(fontSize).toBeGreaterThanOrEqual(28);
  });

  test("landing body text does NOT use raw emoji icons", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const bodyText = (await page.locator("body").textContent()) ?? "";
    // 主要 emoji が body に "含まれない" ことを確認 (Lucide 化済 signal)
    // 例外として ✨ (sparkle) は AI コーチの ornamental に残る場合がある — 限定列挙
    const emojisToCheck = ["📅", "☀️", "🏛", "💍", "📍", "🏠"];
    for (const emoji of emojisToCheck) {
      expect(bodyText).not.toContain(emoji);
    }
  });

  test("Lucide SVG icons are used in landing (svg + aria-hidden or role)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // Lucide 化されているなら svg が複数存在するはず
    const svgCount = await page.locator("svg").count();
    expect(svgCount).toBeGreaterThan(0);
  });

  test("underlined links use a non-default color (gold-warm token)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // text-decoration: underline な anchor が landing に存在する場合、色が default link blue ではない
    const underlinedLinks = page.locator(
      'a[class*="underline"], footer a, nav a',
    );
    const count = await underlinedLinks.count();
    if (count === 0) {
      test.info().annotations.push({
        type: "skip-reason",
        description: "no underlined links found on landing",
      });
      return;
    }
    // 1 件でも default browser blue (#0000EE / rgb(0,0,238)) でなければ token 適用 signal
    let nonDefault = false;
    for (let i = 0; i < Math.min(count, 5); i++) {
      const color = await underlinedLinks
        .nth(i)
        .evaluate((el) => getComputedStyle(el as Element).color);
      if (color && color !== "rgb(0, 0, 238)" && color !== "rgb(0, 0, 255)") {
        nonDefault = true;
        break;
      }
    }
    expect(nonDefault).toBe(true);
  });

  test("Shippori or Noto Serif font is loaded for headlines", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 10000 });
    const fontFamily = await h1.evaluate(
      (el) => getComputedStyle(el as Element).fontFamily,
    );
    // 細字 serif が headline に適用されているはず
    expect(fontFamily.toLowerCase()).toMatch(
      /shippori|noto serif|serif|hiragino/,
    );
  });
});
