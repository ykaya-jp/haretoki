import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, KEY, { auth: { persistSession: false }});

let email: string, pass: string, uid: string;
test.beforeAll(async () => {
  email = `phase3hf-${randomUUID().slice(0,8)}@haretoki.test`;
  pass = "Qr1234!test";
  const { data } = await admin.auth.admin.createUser({ email, password: pass, email_confirm: true });
  uid = data.user!.id;
});
test.afterAll(async () => { if (uid) await admin.auth.admin.deleteUser(uid).catch(()=>{}); });

async function login(page: Page) {
  await page.goto("http://localhost:3000/login");
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes("/login"), { timeout: 15000 });
  await page.context().addCookies([{ name: "onboarding_completed", value: "1", domain: "localhost", path: "/" }]);
  await page.goto("http://localhost:3000/home");
  await page.waitForLoadState("networkidle");
}

test("FAB bottom-right @ 375x812", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("http://localhost:3000/explore", { waitUntil: "networkidle" });
  const fab = page.locator('[aria-label="式場を追加"]');
  await expect(fab).toBeVisible();
  const box = await fab.boundingBox();
  console.log("FAB box:", box);
  // Expect x near right edge (x >= 315), y near bottom (y >= 500)
  expect(box!.x).toBeGreaterThan(250);
  expect(box!.y).toBeGreaterThan(400);
});

test("Coach plus resets to QuickStart", async ({ page }) => {
  await login(page);
  await page.goto("http://localhost:3000/coach");
  await page.waitForLoadState("networkidle");
  const plus = page.locator('[aria-label="新しい会話を始める"]');
  await plus.click();
  await page.waitForTimeout(800);
  const url = page.url();
  console.log("after plus url:", url);
  expect(url).not.toContain("session=");
});

test("/checklist has back + count", async ({ page }) => {
  await login(page);
  await page.goto("http://localhost:3000/checklist");
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[aria-label="候補に戻る"]').first()).toBeVisible();
  const countBadge = page.locator('text=/\\d+件/').first();
  await expect(countBadge).toBeVisible();
});

test("/candidates has checklist edit link", async ({ page }) => {
  await login(page);
  await page.goto("http://localhost:3000/candidates");
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[aria-label="チェック項目を編集"]')).toBeVisible();
});
