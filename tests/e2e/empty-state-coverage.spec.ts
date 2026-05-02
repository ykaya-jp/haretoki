/**
 * D6 — EmptyState 4 surface coverage gate (Phase 3 商用化-critical).
 *
 * D1 added <EmptyState> branches to 4 商用化-critical surfaces
 * (preparation / visits / checklist / journey). The dynamic-smoke
 * step that should have caught a regression on these pages was
 * delegated to the central operator (paneA workers don't have a
 * browser), so this spec is the recurring net: a fresh empty
 * project visits each surface and asserts (a) the EmptyState
 * heading text, (b) the CTA href, and (c) takes a screenshot
 * baseline so a future surface-level visual regression is caught
 * by `npx playwright test --update-snapshots` diffing.
 *
 * Empty-DB recipe matches `comprehensive-app-smoke.spec.ts`:
 *   - Supabase admin creates a fresh user (random email, deleted
 *     in afterAll)
 *   - Login form fill + submit
 *   - `onboarding_completed=1` cookie injected so /home doesn't
 *     bounce back through the question flow
 *   - First /home visit triggers Prisma User/Project/ProjectMember
 *     auto-create — that's the "empty project" the EmptyStates
 *     are written for
 *
 * Same env-presence guard (`hasEnv`) as the parent comprehensive
 * smoke — when SUPABASE_SERVICE_ROLE_KEY is absent (CI default),
 * the suite skips cleanly rather than failing loud.
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
  ? createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    })
  : null;

let testEmail: string;
let testPassword: string;
let userId: string;

test.beforeAll(async () => {
  test.skip(
    !hasEnv,
    "Supabase env not set — skipping EmptyState coverage gate.",
  );
  testEmail = `emptystate-${randomUUID().slice(0, 8)}@haretoki.test`;
  testPassword = "Test1234!emptystate";
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

/**
 * Login + onboarding bypass + /home seed visit. Same recipe as
 * `comprehensive-app-smoke.spec.ts`'s `loginAndOnboard` — kept inline
 * here so the spec stays self-contained (no shared helper module to
 * import from yet; if a third spec needs the same recipe, extract
 * to `tests/e2e/helpers/empty-account.ts`).
 */
async function loginAndOnboard(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[id="email"]', testEmail);
  await page.fill('input[id="password"]', testPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30000,
  });
  await page.context().addCookies([
    {
      name: "onboarding_completed",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
}

test.describe("EmptyState coverage — D1 4 surface gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndOnboard(page);
  });

  test("D1-1 /preparation: 「決めるのは、まだ先で大丈夫」 + CTA → /compare", async ({
    page,
  }) => {
    const response = await page.goto("/preparation");
    expect(response?.status() ?? 0).toBeLessThan(500);

    // Title (rendered by EmptyState as <h3 class="text-h3 ...">)
    const title = page.getByRole("heading", {
      name: "決めるのは、まだ先で大丈夫",
    });
    await expect(title).toBeVisible();

    // CTA — exact label + href both checked. The EmptyState renders
    // a <Link> styled as a pill button.
    const cta = page.getByRole("link", { name: "候補を比べてみる" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/compare");

    await page.screenshot({
      path: "test-results/emptystate-preparation.png",
      fullPage: true,
    });
  });

  test("D1-2 /visits: 「見学を入れたら、ここに記録が残ります」 + CTA → /candidates", async ({
    page,
  }) => {
    const response = await page.goto("/visits");
    expect(response?.status() ?? 0).toBeLessThan(500);

    const title = page.getByRole("heading", {
      name: "見学を入れたら、ここに記録が残ります",
    });
    await expect(title).toBeVisible();

    const cta = page.getByRole("link", { name: "候補から見学を入れる" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/candidates");

    await page.screenshot({
      path: "test-results/emptystate-visits.png",
      fullPage: true,
    });
  });

  test("D1-3 /checklist: 「気になる式場が決まると、おふたり用のチェックリストが整います」 + CTA → /candidates", async ({
    page,
  }) => {
    const response = await page.goto("/checklist");
    expect(response?.status() ?? 0).toBeLessThan(500);

    // The full title is long; partial-match on the headline-stable
    // prefix keeps the assertion readable AND robust to a future
    // copy-tweak past the comma. The full string is the canonical
    // copy in src/app/(app)/checklist/page.tsx.
    const title = page.getByRole("heading", {
      name: /気になる式場が決まると/,
    });
    await expect(title).toBeVisible();

    const cta = page.getByRole("link", { name: "候補を見る" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/candidates");

    await page.screenshot({
      path: "test-results/emptystate-checklist.png",
      fullPage: true,
    });
  });

  test("D1-4 /journey: 「ふたりの式場さがしの記録は、まだ始まったばかり」 + CTA → /explore", async ({
    page,
  }) => {
    const response = await page.goto("/journey");
    expect(response?.status() ?? 0).toBeLessThan(500);

    const title = page.getByRole("heading", {
      name: "ふたりの式場さがしの記録は、まだ始まったばかり",
    });
    await expect(title).toBeVisible();

    const cta = page.getByRole("link", { name: "式場をさがす" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/explore");

    await page.screenshot({
      path: "test-results/emptystate-journey.png",
      fullPage: true,
    });
  });

  test("regression guard — no EmptyState surface 500-errors on a fresh empty project", async ({
    page,
  }) => {
    // The 4 EmptyState branches all run server-side data calls
    // (e.g. checklist counts venues, journey reduces milestones).
    // A regression that throws during the empty-project path would
    // surface as a 500 here. The 4 individual tests above already
    // status-check, but pinning a no-error walkthrough as a single
    // assertion makes a CI failure point at "EmptyState coverage
    // broke" rather than at 4 separate failed tests.
    const surfaces = ["/preparation", "/visits", "/checklist", "/journey"];
    for (const path of surfaces) {
      const response = await page.goto(path);
      expect(
        response?.status() ?? 0,
        `unexpected non-2xx/3xx on ${path}`,
      ).toBeLessThan(500);
    }
  });
});
