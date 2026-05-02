import { test, expect } from "@playwright/test";

/**
 * Bride's complete journey — unauthenticated smoke tests.
 * These tests simulate the public-facing parts of the bride's flow
 * without requiring authentication.
 */

test.describe("花嫁のユースケース — 認証不要", () => {
  test("ランディングページで全セクションが表示される", async ({ page }) => {
    await page.goto("/");

    // Hero
    await expect(page.locator("text=Haretoki").first()).toBeVisible();
    await expect(page.locator("text=その直感").first()).toBeVisible();

    // Stats section
    await expect(page.locator("text=80%").first()).toBeVisible();
    await expect(page.locator("text=+84〜110万円").first()).toBeVisible();

    // Features section
    await expect(page.locator("text=見積もりの先を読む")).toBeVisible();
    await expect(page.locator("text=見学で見落とさない")).toBeVisible();

    // How it works (new in Phase 2B)
    await expect(page.locator("text=はじめかた")).toBeVisible();
  });

  test("ランディング → 新規登録 → 戻る", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="/signup"]').first().click();
    await page.waitForURL("**/signup");
    await expect(page.locator('input[id="email"]')).toBeVisible();

    // Logo click (find visible one among multiple) returns to landing
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
    await page.waitForURL("/");
    await expect(page.locator("text=その直感").first()).toBeVisible();
  });

  test("ランディング → ログイン → 戻る", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=ログイン").first().click();
    await page.waitForURL("**/login");
    await expect(page.locator('input[id="email"]')).toBeVisible();

    // Logo click (find visible one among multiple) returns to landing
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
    await page.waitForURL("/");
  });

  test("未認証で保護ページにアクセス → ログインへリダイレクト", async ({ page }) => {
    for (const path of ["/home", "/explore", "/candidates", "/coach", "/settings"]) {
      await page.goto(path);
      await page.waitForURL("**/login**");
      expect(page.url()).toContain("/login");
    }
  });

  test("ランディングページの全ボタン・リンクが機能する", async ({ page }) => {
    await page.goto("/");

    // Primary CTA
    const primaryCta = page.locator("text=無料ではじめる").first();
    await expect(primaryCta).toBeVisible();
    await primaryCta.click();
    await page.waitForURL("**/signup");

    await page.goto("/");

    // Footer links
    const footerLinks = page.locator("footer a");
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("ランディング: 375pxモバイル表示で横スクロールしない", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test("サインアップフォームのバリデーション", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();

    // Submit empty form — HTML5 validation should block
    const submit = page.locator('button[type="submit"]');
    await submit.click();

    // Should still be on signup page
    expect(page.url()).toContain("/signup");
  });

  test("ログインフォームの誤入力時にエラー表示", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[id="email"]', "nonexistent@example.com");
    await page.fill('input[id="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(
      page.locator("text=メールアドレスまたはパスワードが正しくありません"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("OGP メタタグが正しく設定されている", async ({ page }) => {
    await page.goto("/");

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");

    expect(ogTitle).toContain("Haretoki");
    // Phase 2.C C-0 で Next.js dynamic OG (`/opengraph-image`) に移行済。
    // 旧 static `/og-image.png` も含む両 pattern に match させる。
    expect(ogImage).toMatch(/opengraph-image|og-image/);
  });

  test("ファビコンが設定されている", async ({ page }) => {
    await page.goto("/");
    // Wait for HTML to be fully parsed
    const iconLink = page.locator('link[rel="icon"]');
    const count = await iconLink.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("アクセシビリティ - 基本チェック", () => {
  test("全ページで h1/h2 見出しが存在", async ({ page }) => {
    for (const path of ["/", "/login", "/signup"]) {
      await page.goto(path);
      const headings = await page.locator("h1, h2").count();
      expect(headings).toBeGreaterThan(0);
    }
  });

  test("フォーム input に label が関連付いている", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('label[for="name"]')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
  });

  test("タッチターゲットが44px以上 - ランディングCTA", async ({ page }) => {
    await page.goto("/");
    // CTA は <Link> の中に "無料ではじめる" + <ChevronRight icon> が並ぶ
    // 構造。`text=` の strict match では mixed content で null 返るので
    // role + name regex で安定 locate。framer-motion stagger 完了を待つ
    // ため visible 待機を 1 段挟む。
    const cta = page.getByRole("link", { name: /無料ではじめる/ }).first();
    await expect(cta).toBeVisible({ timeout: 5000 });
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
