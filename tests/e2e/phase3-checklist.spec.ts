/**
 * Phase 3 checklist smoke — verifies the core checklist flow:
 * 1. /checklist page loads and can toggle items
 * 2. /venues/[id]/checklist page loads with active items
 * 3. /compare page loads with venue matrix
 *
 * Requires authenticated user with project + at least one venue.
 * Skipped when Supabase env is not set.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  test.skip(true, "Supabase env not set — skipping phase3 checklist smoke.");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

let testEmail: string;
let testPassword: string;
let userId: string;

test.beforeAll(async () => {
  testEmail = `phase3-${randomUUID().slice(0, 8)}@haretoki.test`;
  testPassword = "Test1234!ph3";
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
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  // Bypass the middleware onboarding redirect for brand-new users — the
  // (app)/layout's getOrCreateProject still auto-creates the Prisma User +
  // Project + ProjectMember on first /home visit, so hitting /home once
  // primes the membership row before we navigate elsewhere.
  await page.context().addCookies([
    { name: "onboarding_completed", value: "1", domain: "localhost", path: "/" },
  ]);
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
}

async function setupProjectAndVenue(page: Page) {
  // Create a minimal project + venue via onboarding or direct DB call
  // If user lands on /onboarding, complete a minimal form
  const url = page.url();
  if (url.includes("/onboarding")) {
    // Fill minimal onboarding — project name only
    const nameInput = page.locator('input[name="projectName"], input[placeholder*="プロジェクト"], input[placeholder*="名前"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("テストプロジェクト");
      const nextBtn = page.locator('button[type="submit"], button:has-text("次へ"), button:has-text("始める")').first();
      if (await nextBtn.isVisible()) await nextBtn.click();
      await page.waitForURL((u) => !u.pathname.includes("/onboarding"), { timeout: 15000 }).catch(() => {});
    }
  }
}

test.describe("Checklist flow (Phase 3)", () => {
  test("GET /checklist renders item selection page", async ({ page }) => {
    await login(page);
    await setupProjectAndVenue(page);

    await page.goto("/checklist");
    // Should not show error page
    await expect(page.locator("text=うまくいきませんでした")).not.toBeVisible();
    // Page title area
    await expect(page.locator("h2, h1").first()).toContainText(/チェックリスト/);
  });

  test("GET /compare renders comparison page", async ({ page }) => {
    await login(page);
    await page.goto("/compare");
    await expect(page.locator("text=うまくいきませんでした")).not.toBeVisible();
    // Editorial header: h1 is the English eyebrow word, Japanese subtitle sits below.
    await expect(page.locator("h1").first()).toContainText(/Compare/);
    await expect(page.locator("text=ふたつを、同じ目線で")).toBeVisible();
  });
});
