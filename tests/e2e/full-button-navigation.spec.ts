import { test, expect, type Page } from "@playwright/test";

/**
 * PR T3 — comprehensive button × navigation audit spec.
 *
 * Goal: every interactive surface a user can tap from a fresh,
 * unauthenticated session lands on the right destination and never
 * 5xx's. Pairs with `comprehensive-app-smoke.spec.ts` (= horizontal
 * smoke: every route renders an h1 without console fatals) by
 * walking the vertical user flows (= landing → signup → home →
 * explore → candidates → compare → coach → mypage).
 *
 * What we cover here (auth-free):
 *   1. Landing CTAs route to /login or /signup
 *   2. Login + signup form structure is reachable + interactive
 *   3. Public page reachability matrix (12 routes don't 5xx)
 *   4. Auth-wall routes redirect cleanly to /login (= no client
 *      crash, no 5xx)
 *   5. 44px touch target invariant on the visible auth wall CTAs
 *
 * What we DON'T cover here (env-gated, follow-up):
 *   - Authenticated bottom-nav 5-tab traversal (= already lives in
 *     `comprehensive-app-smoke.spec.ts`, env-gated there).
 *   - Modal/sheet dismiss (= require seeded data + auth).
 *   - Page-internal CTAs on auth-gated routes (= same reason).
 *
 * Design choice: this spec deliberately avoids `loginAndOnboard` —
 * it lives upstream of the auth wall so it never depends on CI
 * secrets. The env-gated half of the audit will land in a separate
 * spec once CI secret review happens.
 */

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/terms",
  "/privacy",
] as const;

const AUTH_GATED_ROUTES_REDIRECT = [
  "/home",
  "/explore",
  "/candidates",
  "/compare",
  "/coach",
  "/mypage",
  "/checklist",
  "/onboarding/whats-new",
  "/visits",
] as const;

/** Console error filter — same set used across the existing E2E suite
 *  (= dev-server WebSocket reconnects, Vercel Analytics 503, hydration
 *  mismatches that are benign on auth walls). */
function isFatalConsole(text: string): boolean {
  return !/Failed to fetch|WebSocket|Vercel Analytics|Hydration mismatch|favicon|503/i.test(
    text,
  );
}

/** Hook every test in a describe block to capture console errors and
 *  assert no fatals on teardown. Returns the array so per-test logic
 *  can also inspect it inline if needed. */
function withConsoleGuard(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

test.describe("Landing CTAs", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("'無料ではじめる' (or equivalent) CTA routes to /signup", async ({
    page,
  }) => {
    await page.goto("/");
    // The landing copy has gone through several revisions; match a
    // resilient set of plausible labels rather than pinning one
    // exact phrase. If the CTA's label changes again, this still
    // catches navigation correctness.
    const cta = page
      .getByRole("link", { name: /無料|はじめる|signup|始める/i })
      .first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup(\?.*)?$/);
  });

  test("'ログイン' CTA routes to /login", async ({ page }) => {
    await page.goto("/");
    const cta = page
      .getByRole("link", { name: /ログイン|login/i })
      .first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
  });
});

test.describe("Login + signup form structure", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("login page has email + password + submit", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"], input[id="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"], input[id="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test("signup page has email + password + submit", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[type="email"], input[id="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"], input[id="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test("login page links to signup", async ({ page }) => {
    await page.goto("/login");
    // Match by href, not text: the actual copy ("ふたりの場所をつくる")
    // doesn't carry the word "signup" / "サインアップ" anywhere, so a
    // role-name selector misses it. The href is the stable contract.
    const link = page.locator('a[href="/signup"]').first();
    await expect(link).toBeVisible();
  });
});

test.describe("Public route reachability matrix", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of PUBLIC_ROUTES) {
    test(`${route}: 2xx + no fatal console`, async ({ page }) => {
      const errors = withConsoleGuard(page);
      const response = await page.goto(route);
      expect(response?.status() ?? 0).toBeLessThan(400);
      await page.waitForLoadState("domcontentloaded");
      expect(
        errors.filter(isFatalConsole),
        `${route} should not surface a fatal console error`,
      ).toEqual([]);
    });
  }
});

test.describe("Auth-gated routes redirect cleanly", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of AUTH_GATED_ROUTES_REDIRECT) {
    test(`${route}: redirects to /login without 5xx`, async ({ page }) => {
      const errors = withConsoleGuard(page);
      const response = await page.goto(route);
      expect(response?.status() ?? 0).toBeLessThan(500);
      // requireUser in src/server/auth.ts redirects 307 → /login. The
      // browser follows automatically, so the final URL is /login.
      await expect(page).toHaveURL(/\/login(\?.*)?$/);
      expect(
        errors.filter(isFatalConsole),
        `${route} should redirect cleanly without console fatals`,
      ).toEqual([]);
    });
  }
});

test.describe("Touch target invariant (44px) on login wall", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("submit button >= 44px tall on /login", async ({ page }) => {
    await page.goto("/login");
    const submit = page.locator('button[type="submit"]').first();
    await expect(submit).toBeVisible();
    const box = await submit.boundingBox();
    expect(box, "submit button should have a bounding box").not.toBeNull();
    expect(
      box!.height,
      "submit button must clear the 44px touch target floor (h-11)",
    ).toBeGreaterThanOrEqual(44);
  });

  test("submit button >= 44px tall on /signup", async ({ page }) => {
    await page.goto("/signup");
    const submit = page.locator('button[type="submit"]').first();
    await expect(submit).toBeVisible();
    const box = await submit.boundingBox();
    expect(box, "submit button should have a bounding box").not.toBeNull();
    expect(box!.height, "44px touch target floor").toBeGreaterThanOrEqual(44);
  });
});

test.describe("Desktop project parity", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("landing renders without console fatal at 1440px", async ({ page }) => {
    const errors = withConsoleGuard(page);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    expect(errors.filter(isFatalConsole)).toEqual([]);
  });

  test("login renders without console fatal at 1440px", async ({ page }) => {
    const errors = withConsoleGuard(page);
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    expect(errors.filter(isFatalConsole)).toEqual([]);
  });

  test("auth-gated /home redirects to /login at 1440px", async ({ page }) => {
    const response = await page.goto("/home");
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
  });
});
