/**
 * QA Run 2026-04-15-1600
 * Target: http://localhost:3000 (dev server)
 * Scope: Feature verification for R-2, E-10, Q-07, E-4/5/7/8, R-6, R-7
 *
 * Uses Supabase admin API to create a fresh test user, then verifies:
 * 1. Onboarding intro: お名前 input → はじめる → /home → /mypage shows name
 * 2. /explore: vibe chip tap → URL ?vibe= → venue list filtered
 * 3. /explore: save search button → sheet → save → /mypage/saved-searches visible
 * 4. /mypage/saved-searches: delete button works
 * 5. /journey: 5 milestones rendered
 * 6. /coach: AgreementsSection + 話し合いを追加 → input → 追加 → chip visible
 */

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// All tests share one user created in beforeAll — must run serially to avoid
// cross-test interference (login sessions, cookie state, DB state).
// NOTE: top-level test.describe.configure is unreliable with nested describes.
// Serial mode + lifecycle hooks are managed via the outer describe block below.

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SCREENSHOT_DIR = "/tmp/haretoki-qa";

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = async (page: Page, name: string) => {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `qa1600-${name}.png`),
    fullPage: false,
  });
};

// Shared test user credentials
const testEmail = `qa-1600-${Date.now()}@haretoki.test`;
const testPassword = "Test1234!qa";
let testUserId = "";

// Login helper: fills credentials and waits for redirect
async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(home|onboarding)/, { timeout: 20000 });
}

// Complete onboarding: skips through all 4 questions so saveOnboardingAnswers
// sets the httpOnly onboarding_completed cookie, then navigates to /home.
async function completeOnboarding(page: Page) {
  if (!page.url().includes("/onboarding")) return;

  // Wait for the intro screen (はじめる button) or for the gate to auto-redirect
  // returning users to /home (whichever comes first).
  const startBtn = page.locator('button:has-text("はじめる")').first();
  try {
    await Promise.race([
      startBtn.waitFor({ state: "visible", timeout: 6000 }),
      page.waitForURL(/\/home/, { timeout: 6000 }),
    ]);
  } catch {
    // Neither condition met — proceed anyway
  }

  if (!page.url().includes("/onboarding")) return;

  // Click はじめる to proceed past the intro screen
  if (await startBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(400);
  }

  // Loop: click スキップ on each question, then wait for ホームへ進む.
  // 4 questions + up to 4 safety iterations = 8 max.
  for (let i = 0; i < 8; i++) {
    if (!page.url().includes("/onboarding")) break;

    // First check if we reached the recommendations screen
    const homeBtn = page.locator('button:has-text("ホームへ進む")').first();
    if (await homeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await homeBtn.click();
      break;
    }

    const skip = page.locator('button:has-text("スキップ")').first();
    if (await skip.isVisible({ timeout: 1200 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(400);
    } else {
      // No skip button and no home button — wait briefly and retry
      await page.waitForTimeout(800);
    }
  }

  // If still on onboarding, wait up to 15s for ホームへ進む (server action may be slow)
  if (page.url().includes("/onboarding")) {
    const homeBtn = page.locator('button:has-text("ホームへ進む")').first();
    if (await homeBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
      await homeBtn.click();
    }
  }

  // Wait for /home navigation
  await page.waitForURL(/\/home/, { timeout: 20000 }).catch(() => {});
}

// Login + complete onboarding + set cookie
async function loginAndOnboard(page: Page, email: string, password: string) {
  await loginAs(page, email, password);
  if (page.url().includes("/onboarding")) {
    await completeOnboarding(page);
  }
}

// ─────────────────────────────────────────────
// Outer suite — serial mode ensures beforeAll/afterAll scope covers all tests
// ─────────────────────────────────────────────
test.describe("QA-2026-04-15 Suite", () => {
  test.describe.configure({ mode: "serial" });

  // ─────────────────────────────────────────────
  // Setup: create test user once for the suite
  // ─────────────────────────────────────────────
  test.beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error("Missing SUPABASE env vars — check .env.local");
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (error) throw error;
    testUserId = data.user.id;
    console.log(`[QA] Test user created: ${testEmail} (${testUserId})`);
  });

  test.afterAll(async () => {
    if (!testUserId || !SUPABASE_URL || !SERVICE_ROLE) return;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
    console.log(`[QA] Test user deleted: ${testUserId}`);
  });

// ─────────────────────────────────────────────
// 1. Onboarding: お名前 input → はじめる → /mypage name反映
// ─────────────────────────────────────────────
test.describe("Q-07: Onboarding name input", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("onboarding intro shows お名前 input and navigates to /home after submit", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      // Console "Failed to load resource" entries don't carry the URL in the
      // message body itself — pull it from the structured location() so the
      // downstream filter can drop noisy /_vercel/* analytics misses.
      const loc = msg.location();
      const url = loc?.url ?? "";
      consoleErrors.push(url ? `${msg.text()} (${url})` : msg.text());
    });
    page.on("response", (res) => {
      if (res.url().startsWith(BASE) && res.status() >= 500) {
        consoleErrors.push(`5xx: ${res.status()} ${res.url()}`);
      }
    });

    await loginAs(page, testEmail, testPassword);

    // Should land on /onboarding for a new user (before setting cookie)
    const url = page.url();
    console.log(`[Q-07] Post-login URL: ${url}`);
    await shot(page, "01-post-login");

    if (!url.includes("/onboarding")) {
      // Already onboarded (e.g. cookie set) — skip
      test.skip();
      return;
    }

    // Wait for the intro screen (step -1)
    // The intro has an <Input id="display-name"> with placeholder "例: ゆうすけ"
    await page.waitForSelector('#display-name, input[placeholder*="例:"]', { timeout: 8000 });
    await shot(page, "02-onboarding-intro");

    const nameInput = page.locator('#display-name, input[placeholder*="例:"]').first();
    await expect(nameInput).toBeVisible();

    // Fill in a name
    await nameInput.fill("QAテスト太郎");

    // Click 「はじめる」
    const startBtn = page.locator('button:has-text("はじめる")');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Should now be on step 0 (questions)
    await shot(page, "03-onboarding-step0");

    // Skip through the remaining 4 questions by clicking スキップ or 次へ
    for (let i = 0; i < 6; i++) {
      const skip = page.locator('button:has-text("スキップ")').first();
      const next = page.locator('button:has-text("次へ"), button:has-text("おすすめを見る")').first();
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
        await skip.click();
      } else if (await next.isVisible({ timeout: 1500 }).catch(() => false)) {
        await next.click();
      }
      await page.waitForTimeout(600);
      if (page.url().includes("/home")) break;
      // Check if we're on recommendations screen
      const homeBtn = page.locator('button:has-text("ホームへ進む")');
      if (await homeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await homeBtn.click();
        break;
      }
    }

    await shot(page, "04-onboarding-done");

    // Wait for /home
    await page.waitForURL(/\/home/, { timeout: 15000 });
    expect(page.url()).toContain("/home");

    // Navigate to /mypage and verify name is shown
    await page.goto(`${BASE}/mypage`);
    await page.waitForLoadState("domcontentloaded");
    await shot(page, "05-mypage-after-onboarding");

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("QAテスト太郎");

    // No critical errors. Vercel Analytics/Speed Insights endpoints 404 under
    // `next start` locally (they are only proxied by the Vercel edge in prod),
    // so those noise entries are filtered out alongside 503 / WebSocket churn.
    const critical = consoleErrors.filter(
      (e) =>
        !e.includes("503") &&
        !e.includes("WebSocket") &&
        !e.includes("/_vercel/insights") &&
        !e.includes("/_vercel/speed-insights"),
    );
    expect(critical, `Console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// 2. /explore: vibe chip → URL ?vibe= → list responds
// ─────────────────────────────────────────────
test.describe("R-2: VibeFilterChips", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("vibe chip tap updates URL with ?vibe= parameter", async ({ page }) => {
    await loginAndOnboard(page, testEmail, testPassword);

    await page.goto(`${BASE}/explore`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    await shot(page, "06-explore-loaded");

    // Find vibe chip buttons (e.g. 自然光, ガーデン)
    // Chips use min-h-11 rounded-full with emoji + text
    const chipSelector = 'button:has-text("自然光"), button:has-text("ガーデン")';
    await expect(page.locator(chipSelector).first()).toBeVisible({ timeout: 5000 });

    // Click the chip — router.replace updates the URL client-side
    await page.locator(chipSelector).first().click();
    await page.waitForTimeout(800);
    await shot(page, "07-explore-vibe-active");

    // URL should contain ?vibe=
    const currentUrl = page.url();
    console.log(`[R-2] URL after vibe click: ${currentUrl}`);
    expect(currentUrl).toContain("vibe=");

    // Wait for DOM to settle after the server-component re-render triggered by
    // the URL change, then re-acquire the chip and click to deselect.
    await expect(page.locator(chipSelector).first()).toBeVisible({ timeout: 5000 });
    await page.locator(chipSelector).first().click();
    await page.waitForTimeout(600);
    const urlAfterDeselect = page.url();
    console.log(`[R-2] URL after deselect: ${urlAfterDeselect}`);
    // vibe param removed or empty
    expect(urlAfterDeselect).not.toMatch(/vibe=[^&]+/);
  });

  test("multiple vibe chips combine as comma-separated ?vibe=", async ({ page }) => {
    await loginAndOnboard(page, testEmail, testPassword);

    await page.goto(`${BASE}/explore`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const chips = page.locator('button:has-text("自然光"), button:has-text("ガーデン"), button:has-text("ガラス張り")');
    const count = await chips.count();
    if (count < 2) {
      test.skip();
      return;
    }

    await chips.nth(0).click();
    await page.waitForTimeout(400);
    await chips.nth(1).click();
    await page.waitForTimeout(600);

    const url = page.url();
    console.log(`[R-2] Multi-vibe URL: ${url}`);
    expect(url).toContain("vibe=");
    // Should contain comma for multiple selection
    const vibeParam = new URL(url).searchParams.get("vibe");
    expect(vibeParam?.includes(",")).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 3. E-10: Save search button → sheet → save → /mypage/saved-searches
// ─────────────────────────────────────────────
test.describe("E-10: SaveSearchButton", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("save search: button appears when filters active, sheet opens, saves to mypage", async ({ page }) => {
    const httpErrors: string[] = [];
    page.on("response", (res) => {
      if (res.url().startsWith(BASE) && res.status() >= 400 && !res.url().includes("favicon")) {
        httpErrors.push(`${res.status()} ${res.url().replace(BASE, "")}`);
      }
    });

    await loginAndOnboard(page, testEmail, testPassword);

    // Navigate to explore with a search query to trigger hasAnyFilter=true
    await page.goto(`${BASE}/explore?q=テスト`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1200);
    await shot(page, "08-explore-with-filter");

    // "この条件を保存" button should be visible when hasAnyFilter=true
    const saveBtn = page.locator('button:has-text("この条件を保存")');
    await expect(saveBtn).toBeVisible({ timeout: 5000 });

    // Click to open sheet
    await saveBtn.click();
    await page.waitForTimeout(800);
    await shot(page, "09-save-search-sheet-open");

    // Sheet should open with an input for label
    const labelInput = page.locator('input[id="search-label"], input[placeholder*="条件の名前"], input[placeholder*="東京"]');
    await expect(labelInput).toBeVisible({ timeout: 5000 });

    // Enter a name
    await labelInput.fill("QA検索条件テスト");
    await shot(page, "10-save-search-filled");

    // Click 保存する
    const submitBtn = page.locator('button:has-text("保存する")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, "11-save-search-done");

    // Navigate to /mypage/saved-searches
    await page.goto(`${BASE}/mypage/saved-searches`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    await shot(page, "12-saved-searches-page");

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("QA検索条件テスト");

    // HTTP error check (exclude 503 coach/AI endpoints, and Vercel
    // Analytics/Speed Insights scripts that 404 under local `next start`).
    const critical = httpErrors.filter(
      (e) =>
        !e.includes("/api/coach") &&
        !e.includes("/_vercel/insights") &&
        !e.includes("/_vercel/speed-insights"),
    );
    expect(critical, `HTTP errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("save search: delete button removes item", async ({ page }) => {
    await loginAndOnboard(page, testEmail, testPassword);

    await page.goto(`${BASE}/mypage/saved-searches`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    // Check if saved search exists in visible page content
    const hasSavedSearch = await page.locator('text=QA検索条件テスト').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasSavedSearch) {
      // Nothing to delete — skip (depends on previous test)
      test.skip();
      return;
    }

    // Find and click delete button (Trash2 icon, aria-label="削除")
    const deleteBtn = page.locator('button[aria-label="削除"]').first();
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, "13-saved-search-deleted");

    // Item should be gone from the visible page content.
    // Use a specific element locator rather than body.textContent() which
    // includes RSC inline script payloads and may contain stale encoded data.
    await expect(page.locator('text=QA検索条件テスト').first()).not.toBeVisible({ timeout: 3000 });
  });
});

// ─────────────────────────────────────────────
// 4. /journey: 5 milestones rendered (E-7)
// ─────────────────────────────────────────────
test.describe("E-7: Journey Timeline", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("/journey renders 5 milestone items", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const loc = msg.location();
      const url = loc?.url ?? "";
      consoleErrors.push(url ? `${msg.text()} (${url})` : msg.text());
    });

    await loginAndOnboard(page, testEmail, testPassword);

    await page.goto(`${BASE}/journey`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1200);
    await shot(page, "14-journey-page");

    // Check h1 is visible
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const h1Text = await h1.textContent();
    console.log(`[E-7] Journey page h1: "${h1Text}"`);
    expect(h1Text).toContain("晴れまでの道");

    // 5 milestones are rendered as <li> elements in the timeline <ol>
    const milestoneItems = page.locator('ol[aria-label="晴れまでの道のり"] li, section[aria-label="マイルストーン一覧"] li');
    const count = await milestoneItems.count();
    console.log(`[E-7] Milestone count: ${count}`);
    expect(count).toBe(5);

    // Labels for the 5 milestones
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("はじまり");
    expect(bodyText).toContain("候補を集める");
    expect(bodyText).toContain("見学する");
    expect(bodyText).toContain("見積もりを見る");
    expect(bodyText).toContain("決める");

    const critical = consoleErrors.filter(
      (e) =>
        !e.includes("503") &&
        !e.includes("WebSocket") &&
        !e.includes("/_vercel/insights") &&
        !e.includes("/_vercel/speed-insights"),
    );
    expect(critical, `Console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// 5. /coach: AgreementsSection 追加フロー (R-7)
// ─────────────────────────────────────────────
test.describe("R-7: AgreementsSection on /coach", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // d0777cb で AgreementsSection は /coach 初期 empty state から意図的に削除された
  // （情報過多を避けるため NightQuestion + QuickStart のみ表示）。
  // コンポーネント自体は残っているが現状 mount されていないため、本テストは skip。
  test.skip("＋ 話し合いを追加 opens input, submit shows chip", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const loc = msg.location();
      const url = loc?.url ?? "";
      consoleErrors.push(url ? `${msg.text()} (${url})` : msg.text());
    });

    await loginAndOnboard(page, testEmail, testPassword);

    await page.goto(`${BASE}/coach`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    await shot(page, "15-coach-page");

    // Find the + 話し合いを追加 button
    const addBtn = page.locator('button:has-text("話し合いを追加")');
    await expect(addBtn).toBeVisible({ timeout: 5000 });

    // Click to open input
    await addBtn.click();
    await page.waitForTimeout(400);
    await shot(page, "16-agreements-input-open");

    // Text input should be visible
    const input = page.locator('input[placeholder*="話し合いの内容"]');
    await expect(input).toBeVisible();

    // Type an agreement text
    await input.fill("ゲスト人数は80名にする");

    // Click 追加
    const submitBtn = page.locator('button:has-text("追加")').last();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await page.waitForTimeout(1200);
    await shot(page, "17-agreement-added");

    // The chip should now be visible (optimistic update)
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("ゲスト人数は80名にする");

    // Status chip label should be visible (💭 話してる = discussing initial state)
    expect(bodyText).toContain("話してる");

    const critical = consoleErrors.filter(
      (e) =>
        !e.includes("503") &&
        !e.includes("WebSocket") &&
        !e.includes("/_vercel/insights") &&
        !e.includes("/_vercel/speed-insights"),
    );
    expect(critical, `Console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// 6. Console / HTTP health check across all primary routes
// ─────────────────────────────────────────────
test.describe("Global: HTTP error & console check", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const routes = ["/home", "/explore", "/candidates", "/coach", "/mypage", "/journey"];

  for (const route of routes) {
    test(`${route}: no 4xx/5xx and no console errors`, async ({ page }) => {
      const httpErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on("response", (res) => {
        if (
          res.url().startsWith(BASE) &&
          res.status() >= 400 &&
          !res.url().includes("favicon") &&
          !res.url().includes("/api/coach") &&
          !res.url().includes("/_vercel/insights") &&
          !res.url().includes("/_vercel/speed-insights")
        ) {
          httpErrors.push(`${res.status()} ${res.url().replace(BASE, "")}`);
        }
      });
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const loc = msg.location();
        const url = loc?.url ?? "";
        const combined = url ? `${msg.text()} (${url})` : msg.text();
        if (
          combined.includes("WebSocket") ||
          combined.includes("/_vercel/insights") ||
          combined.includes("/_vercel/speed-insights")
        ) {
          return;
        }
        consoleErrors.push(combined);
      });

      await loginAndOnboard(page, testEmail, testPassword);

      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
      await shot(page, `health-${route.replace(/\//g, "-")}`);

      expect(httpErrors, `HTTP errors on ${route}: ${httpErrors.join("; ")}`).toHaveLength(0);
      expect(consoleErrors, `Console errors on ${route}: ${consoleErrors.join("; ")}`).toHaveLength(0);
    });
  }
});

}); // end QA-2026-04-15 Suite
