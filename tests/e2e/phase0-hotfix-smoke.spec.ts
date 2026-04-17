/**
 * Phase 0 hotfix smoke — verifies the broken-feature fixes from problems_01.md.
 * Creates an authenticated test user via Supabase admin, completes the minimum
 * onboarding state, and asserts that error.tsx (うまくいきませんでした) is
 * NOT rendered on the routes the user reported as broken.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  test.skip(true, "Supabase env not set — skipping hotfix smoke.");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

let testEmail: string;
let testPassword: string;
let userId: string;

test.beforeAll(async () => {
  testEmail = `phase0-${randomUUID().slice(0, 8)}@haretoki.test`;
  testPassword = "Test1234!ph0";
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
});

test.afterAll(async () => {
  if (userId) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
});

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[id="email"]', testEmail);
  await page.fill('input[id="password"]', testPassword);
  await page.click('button[type="submit"]');
  // Wait for onboarding gate or home
  await page.waitForURL(/\/(onboarding|home)/, { timeout: 15000 });

  if (!page.url().includes("/onboarding")) return;

  // The OnboardingGate will auto-redirect to /home if the user already has
  // conditions saved (from a previous parallel test). Wait for that first.
  // If not redirected within 3s, manually skip through questions.
  const autoRedirected = await page.waitForURL(/\/home/, { timeout: 3000 }).then(() => true).catch(() => false);
  if (autoRedirected) return;

  // Manual onboarding skip — click はじめる then スキップ × 4, then ホームへ進む.
  // Keep wait times short to stay within 30s test timeout.
  const startBtn = page.locator('button:has-text("はじめる")').first();
  if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(300);
  }

  // Click スキップ up to 6 times (4 questions + 2 safety)
  for (let i = 0; i < 6; i++) {
    if (!page.url().includes("/onboarding")) break;
    const homeBtn = page.locator('button:has-text("ホームへ進む")').first();
    if (await homeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await homeBtn.click();
      break;
    }
    const skip = page.locator('button:has-text("スキップ")').first();
    if (await skip.isVisible({ timeout: 600 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(250);
    } else {
      await page.waitForTimeout(400);
    }
  }

  // Wait for ホームへ進む if not yet clicked (server action may be in flight)
  if (page.url().includes("/onboarding")) {
    const homeBtn = page.locator('button:has-text("ホームへ進む")').first();
    if (await homeBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
      await homeBtn.click();
    }
  }

  await page.waitForURL(/\/home/, { timeout: 8000 }).catch(() => {});
}

async function expectNoErrorBoundary(page: Page) {
  await expect(
    page.locator("text=うまくいきませんでした"),
  ).not.toBeVisible({ timeout: 5000 });
}

test.describe("Phase 0 — broken features must not render error.tsx", () => {
  // Serial mode: all tests share one user — run one at a time to avoid
  // race conditions in onboarding completion and cookie state.
  test.describe.configure({ mode: "serial" });
  // 60s to account for onboarding completion (server actions + AI) on first test.
  test.setTimeout(60000);
  test("/home renders without error boundary", async ({ page }) => {
    await login(page);
    await page.goto("/home");
    await expectNoErrorBoundary(page);
  });

  test("/candidates renders without error boundary", async ({ page }) => {
    await login(page);
    await page.goto("/candidates");
    await expectNoErrorBoundary(page);
    await expect(page.locator("h2, h1").first()).toBeVisible();
  });

  test("/mypage renders without error boundary (H0-4 partner null guard)", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/mypage");
    await expectNoErrorBoundary(page);
    await expect(page.locator("text=プロフィール").first()).toBeVisible();
  });

  test("/coach renders without error boundary", async ({ page }) => {
    await login(page);
    await page.goto("/coach");
    await expectNoErrorBoundary(page);
  });

  test("/settings renders without error boundary", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await expectNoErrorBoundary(page);
  });

  test("/explore renders without error boundary (AI rec block resilient)", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/explore");
    await expectNoErrorBoundary(page);
    // The AI recommendations block should render in some state — never throw.
    // Acceptable: insufficient_data | unavailable | error | ready | seed.
    // We just assert the page itself stayed up.
  });

  test("home → 候補 navigation does not surface error boundary (problems_01 #3)", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/home");
    // Direct navigation simulates the NBA "比べる" CTA href="/candidates"
    await page.goto("/candidates");
    await expectNoErrorBoundary(page);
  });
});
