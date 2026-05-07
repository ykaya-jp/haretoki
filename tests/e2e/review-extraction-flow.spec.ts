/**
 * Review extraction E2E — verifies the user-reported broken flow end-to-end:
 *
 *   1. Add a venue via URL (mwed /hall/{id}/rev/ — known to serve 25
 *      reviews in static HTML)
 *   2. Open the venue detail page
 *   3. Either (a) individuals were extracted automatically, OR
 *      (b) the gold-warm backfill banner is visible and clicking it
 *      produces individual review rows
 *   4. Home page progress numbers stay consistent with the bottom-nav
 *      badge (= same query, must agree)
 *
 * Targets prod (BASE_URL=https://haretoki.vercel.app) so it catches
 * the kind of soft-delete / cache leakage that unit tests miss.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const hasEnv = Boolean(SUPABASE_URL && SERVICE_ROLE);

const admin = hasEnv
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  : null;

const MWED_REV_URL = "https://www.mwed.jp/hall/10428/rev/";

let testEmail: string;
let testPassword: string;
let userId: string;

test.beforeAll(async () => {
  test.skip(!hasEnv, "Supabase env not set — skipping review extraction E2E.");
  testEmail = `revex-${randomUUID().slice(0, 8)}@haretoki.test`;
  testPassword = "Test1234!rx";
  const { data, error } = await admin!.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
});

test.afterAll(async () => {
  if (userId && admin) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
});

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[id="email"]', testEmail);
  await page.fill('input[id="password"]', testPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(onboarding|home)/, { timeout: 20000 });

  if (!page.url().includes("/onboarding")) return;

  // Auto-redirect path (returning user with conditions saved already).
  const autoRedirected = await page
    .waitForURL(/\/home/, { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (autoRedirected) return;

  // Manual skip path — same flow phase0-hotfix-smoke.spec.ts walks:
  // はじめる → スキップ × N → ホームへ進む.
  const startBtn = page.locator('button:has-text("はじめる")').first();
  if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(300);
  }

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

  if (page.url().includes("/onboarding")) {
    const homeBtn = page.locator('button:has-text("ホームへ進む")').first();
    if (await homeBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
      await homeBtn.click();
    }
  }

  await page.waitForURL(/\/home/, { timeout: 15000 }).catch(() => {});
}

test("mwed URL → individual reviews surface end-to-end (after() architecture)", async ({ page }) => {
  // With the after() defer pattern: URL submit returns instantly,
  // venue page renders without reviews, then 60-90s later the
  // background job completes and revalidates. Test timeout has to
  // cover login (~20-30s) + URL submit response (~10-15s) + bg job
  // (~90-120s) + reload+assert (~10s) = ≤ 180s total.
  test.setTimeout(300_000);
  await login(page);

  // Step 1 — go to /explore and open the URL-import flow.
  await page.goto("/explore");
  await expect(page).toHaveURL(/\/explore/);

  const addButton = page.locator('button[aria-label="式場を追加"]').first();
  await addButton.waitFor({ state: "visible", timeout: 15000 });
  await addButton.click();

  const urlInput = page
    .locator('textarea[placeholder*="式場の URL"]')
    .first();
  await urlInput.waitFor({ state: "visible", timeout: 10000 });
  await urlInput.fill(MWED_REV_URL);

  const submit = page
    .locator('button:has-text("URL から取り込む"), button:has-text("まとめて取り込む")')
    .first();
  await submit.click();

  // Step 2 — wait for navigation to the venue detail page. Inline
  // await on runReviewSummary means /explore POST takes ~60-120s
  // (multi-page crawl + Sonnet on merged corpus + addVenueFromUrl).
  // Generous timeout.
  await page.waitForURL(/\/venues\//, { timeout: 180_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});

  // Summary card must be present on first venue page render — Review
  // row was created synchronously inside confirmVenueFromUrl.
  await expect(
    page.getByText("みんなのウェディング のまとめ").first(),
  ).toBeVisible({ timeout: 30_000 });

  // Individual review header should also be there when extraction
  // worked. If only the summary saved, this would be missing — that's
  // a separate bug worth catching.
  await expect(
    page.locator('h3:has-text("先輩カップルの声")').first(),
  ).toBeVisible({ timeout: 30_000 });

  // Assert at least 5 individual review cards (mwed has 25; we accept
  // anything above 5 as evidence the pipeline is working end-to-end).
  const individualCards = page.locator('ul > li:has(time), ul > li:has(p)');
  const count = await individualCards.count();
  expect(count, "expected ≥ 5 individual reviews after extraction").toBeGreaterThanOrEqual(5);
});

test("home progress dial matches bottom-nav badge for 候補", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await page.goto("/home");
  // Don't wait for networkidle — the home page polls realtime/SSE which
  // never goes idle. Wait for the journey ring instead.
  await page
    .locator(':text("JOURNEY"), :text("候補")')
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });

  // Both numbers should match. Use precise structural locators rather
  // than fuzzy text-near-text patterns that need deep DOM walking.
  // Home pulse renders 候補 as: <button … aria-label="候補一覧を見る">…数字…候補…</button>
  const dialBlock = page.locator('[aria-label*="候補"]').first();
  const dialText = (await dialBlock.textContent({ timeout: 10_000 })) ?? "";
  const dialMatch = dialText.match(/(\d+)/);
  const dialNum = dialMatch ? Number(dialMatch[1]) : null;

  // Bottom-nav: badge inside the 候補 tab link
  const navText =
    (await page
      .locator('a[href*="/candidates"]')
      .first()
      .textContent({ timeout: 10_000 })) ?? "";
  const navMatch = navText.match(/(\d+)/);
  const navNum = navMatch ? Number(navMatch[1]) : 0;

  // Both must agree. Fresh user = 0/0 (no badge text → 0). After
  // adding favorites both should rise in lockstep.
  expect(dialNum ?? 0, "home dial 候補 must match bottom-nav badge").toBe(
    navNum,
  );
});
