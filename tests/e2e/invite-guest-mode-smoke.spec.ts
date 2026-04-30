/**
 * F4 Dynamic Smoke — invite guest-mode (Level 1) E2E.
 *
 * Primary purpose: automatically detect reviewer C1 regression
 * (Server Component cookies().set() crash in Next.js 16). If that bug
 * is present, the /invite/<token>/view Server Component throws and Next
 * falls back to the error boundary ("うまく表示できませんでした"). The
 * assertion in test 2 catches this without any manual smoke.
 *
 * Tests:
 *   1. /invite/<valid-token> renders welcome screen (owner name + 「ここだけ見る」)
 *   2. 「ここだけ見る」tap → /invite/<token>/view renders Level 1 guest view
 *      (C1 cookie crash would surface as error boundary — caught here)
 *   3. htk_guest cookie is set in the response after tapping 「ここだけ見る」
 *   4. /invite/<token>/view direct reload with existing cookie renders guest view
 *
 * Prereqs: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 * must be present in .env.local (or env). If any is absent the suite skips.
 *
 * Seed strategy: Supabase admin auth API creates the owner user; the
 * public.users / projects / project_invitations rows are inserted via
 * the Supabase service-role REST client (bypasses RLS) — no Prisma import
 * needed from within the Playwright runner environment.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import crypto from "node:crypto";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
// GUEST_COOKIE_SECRET_K1 must be set so /guest-start can sign the htk_guest
// cookie. Without it the route throws 500 and tests 2-4 would time-out on the
// waitForURL('/view') assertion. Test 1 (welcome screen render) does not need
// the secret but still requires the DB-backed seed, so we gate it on the same
// hasEnv flag and separately gate tests 2-4 on hasGuestSecret.
const GUEST_SECRET = process.env.GUEST_COOKIE_SECRET_K1 ?? "";
// hasEnv: basic DB seed is possible (tests 1–4 all need this).
const hasEnv = Boolean(SUPABASE_URL && SERVICE_ROLE && DATABASE_URL);
// When BASE_URL points at a remote deploy (preview / prod), the secret only
// needs to live on the server. The local test runner's env doesn't matter
// — `/guest-start` reads `process.env.GUEST_COOKIE_SECRET_K1` server-side.
// For local dev runs (BASE_URL unset or localhost) we still gate on the
// runner-local env so we don't loop on a 500.
const TARGETS_REMOTE = Boolean(
  process.env.BASE_URL && !process.env.BASE_URL.includes("localhost"),
);
// hasGuestSecret: /guest-start Route Handler can sign the cookie (tests 2–4).
const hasGuestSecret = hasEnv && (TARGETS_REMOTE || Boolean(GUEST_SECRET));

// Lazy-init guard: createClient throws when secrets are empty strings.
const admin = hasEnv
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  : null;

// State shared across tests.
let ownerId: string;
let ownerEmail: string;
let invitationToken: string;
let projectId: string;

test.beforeAll(async () => {
  test.skip(!hasEnv, "Supabase/DB env not set — skipping F4 guest-mode smoke.");

  // 1. Create Supabase auth user (owner).
  ownerEmail = `smoke-guest-owner-${randomUUID().slice(0, 8)}@haretoki.test`;
  const { data: authData, error: authError } = await admin!.auth.admin.createUser({
    email: ownerEmail,
    password: "Test1234!smoke",
    email_confirm: true,
  });
  if (authError) throw new Error(`createUser failed: ${authError.message}`);
  ownerId = authData.user.id;

  // 2. Seed public.users via Supabase service-role REST client.
  //    public.users is NOT auto-created by Supabase trigger in this project.
  //    getOrCreateProject() normally upserts it on first /home visit.
  //    We seed it directly so the invitation FK resolves.
  const now = new Date().toISOString();
  const { error: userError } = await admin!
    .from("users")
    .upsert({ id: ownerId, email: ownerEmail, name: "テスト招待者", created_at: now, updated_at: now });
  if (userError) throw new Error(`upsert users failed: ${userError.message}`);

  // 3. Create project row.
  const { data: projectData, error: projectError } = await admin!
    .from("projects")
    .insert({ name: "ゲストスモークプロジェクト", created_at: now, updated_at: now })
    .select("id")
    .single();
  if (projectError) throw new Error(`insert project failed: ${projectError.message}`);
  projectId = projectData.id;

  // 4. Create owner project_member row.
  const { error: memberError } = await admin!
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: ownerId,
      role: "owner",
      accepted_at: now,
      invited_at: now,
    });
  if (memberError) throw new Error(`insert member failed: ${memberError.message}`);

  // 5. Create invitation row.
  invitationToken = crypto.randomBytes(32).toString("hex");
  const { error: inviteError } = await admin!
    .from("project_invitations")
    .insert({
      project_id: projectId,
      token: invitationToken,
      created_by: ownerId,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });
  if (inviteError) throw new Error(`insert invitation failed: ${inviteError.message}`);
});

test.afterAll(async () => {
  if (!admin) return;
  // Clean up in reverse FK order. Cascade handles children of project.
  // Delete project first (cascades project_members, project_invitations).
  if (projectId) {
    await admin.from("projects").delete().eq("id", projectId).then(() => {}, () => {});
  }
  // Delete public.users row.
  if (ownerId) {
    await admin.from("users").delete().eq("id", ownerId).then(() => {}, () => {});
  }
  // Delete Supabase auth user.
  if (ownerId) {
    await admin.auth.admin.deleteUser(ownerId).catch(() => {});
  }
});

// ── helpers ──────────────────────────────────────────────────────────────

/** Shared error boundary text from src/app/global-error.tsx and error.tsx. */
const ERROR_BOUNDARY_TEXTS = [
  "うまく表示できませんでした",
  "ちょっとひと息つきましょう",
];

async function assertNoErrorBoundary(page: import("@playwright/test").Page) {
  for (const text of ERROR_BOUNDARY_TEXTS) {
    await expect(page.getByText(text)).not.toBeVisible();
  }
}

// ── tests ─────────────────────────────────────────────────────────────────

test.describe("F4 guest-mode smoke — Level 1 invite journey", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  // Clear any leftover guest cookie before each test so flows are independent.
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("1. /invite/<valid-token> renders welcome screen without error", async ({
    page,
  }) => {
    test.skip(!hasEnv, "Supabase/DB env not set.");

    const response = await page.goto(`/invite/${invitationToken}`);
    expect(response?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("networkidle");

    await assertNoErrorBoundary(page);

    // Welcome card: h1 contains "こんにちは、" followed by the owner name.
    // getByRole targets only the <h1> element, avoiding strict-mode violation
    // when the owner name also appears in the body copy.
    await expect(
      page.getByRole("heading", { level: 1, name: /こんにちは/ })
    ).toBeVisible({ timeout: 15000 });

    // Primary guest-mode CTA must be present.
    await expect(page.getByText("ここだけ見る")).toBeVisible();
  });

  test("2. 「ここだけ見る」tap → /view renders Level 1 guest view (C1 cookie crash detection)", async ({
    page,
  }) => {
    test.skip(!hasGuestSecret, "GUEST_COOKIE_SECRET_K1 not set — /guest-start would 500.");

    await page.goto(`/invite/${invitationToken}`);
    await page.waitForLoadState("networkidle");

    // Tap the guest-mode CTA. This submits the form to /guest-start which
    // sets the htk_guest cookie and redirects to /view.
    const guestBtn = page.getByText("ここだけ見る");
    await expect(guestBtn).toBeVisible({ timeout: 15000 });
    await guestBtn.click();

    // Wait for navigation to /view. If C1 (Server Component cookies().set())
    // crash is present, Next falls into the error boundary instead — the
    // assertion below will catch it.
    await page.waitForURL((url) => url.pathname.includes("/view"), {
      timeout: 30000,
    });
    await page.waitForLoadState("networkidle");

    // ── Critical: error boundary must NOT appear (C1 regression gate) ──
    await assertNoErrorBoundary(page);

    // Level 1 guest view specific copy (from /invite/[token]/(guest)/view/page.tsx).
    // h1 renders "テスト招待者さんの相棒さん。"
    await expect(page.getByText("相棒さん")).toBeVisible({ timeout: 15000 });

    // Read-only mode badge.
    await expect(page.getByText("読み取り専用")).toBeVisible();
  });

  test("3. htk_guest cookie is set after 「ここだけ見る」", async ({
    page,
    context,
  }) => {
    test.skip(!hasGuestSecret, "GUEST_COOKIE_SECRET_K1 not set — /guest-start would 500.");

    await page.goto(`/invite/${invitationToken}`);
    await page.waitForLoadState("networkidle");

    const guestBtn = page.getByText("ここだけ見る");
    await expect(guestBtn).toBeVisible({ timeout: 15000 });
    await guestBtn.click();

    await page.waitForURL((url) => url.pathname.includes("/view"), {
      timeout: 30000,
    });

    // Cookie must be present after the /guest-start redirect.
    const cookies = await context.cookies();
    const guestCookie = cookies.find((c) => c.name === "htk_guest");
    expect(guestCookie, "htk_guest cookie should be set after guest-start").toBeTruthy();
    expect(guestCookie!.value.length).toBeGreaterThan(20);
  });

  test("4. /invite/<valid-token>/view direct reload with cookie renders guest view", async ({
    page,
  }) => {
    test.skip(!hasGuestSecret, "GUEST_COOKIE_SECRET_K1 not set — /guest-start would 500.");

    // First, obtain a valid guest cookie by going through /guest-start.
    await page.goto(`/invite/${invitationToken}`);
    await page.waitForLoadState("networkidle");
    const guestBtn = page.getByText("ここだけ見る");
    await expect(guestBtn).toBeVisible({ timeout: 15000 });
    await guestBtn.click();
    await page.waitForURL((url) => url.pathname.includes("/view"), {
      timeout: 30000,
    });
    await page.waitForLoadState("networkidle");

    // Reload /view directly to re-run the Server Component (simulates returning visitor).
    await page.goto(`/invite/${invitationToken}/view`);
    await page.waitForLoadState("networkidle");

    await assertNoErrorBoundary(page);
    await expect(page.getByText("相棒さん")).toBeVisible({ timeout: 15000 });

    // Upgrade CTA is present in the footer.
    await expect(page.getByText("ここから参加する")).toBeVisible();
  });
});
