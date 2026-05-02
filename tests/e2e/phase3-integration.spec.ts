import { test, expect } from "@playwright/test";

/**
 * Phase 3 integration smoke — auth-free Playwright pass over the
 * security perimeter + public-route surface that Phase 3 wave 1
 * (Realtime), wave 2 (push fan-out), C-1 (family share), and C-2
 * (countdown / admin dashboards) all bolted onto.
 *
 * This is the **codified** subset of
 * `docs/phase3/integration-test-checklist.md` — specifically the rows
 * that don't need two real browsers logged into a real Supabase
 * project. The cross-device flows (A2 / B1 / B5 etc.) intentionally
 * stay manual — Playwright can't reliably observe a Web Push
 * notification arriving on a real device, and faking the broadcast
 * round-trip would test the mock, not the system.
 *
 * What we DO automate:
 *   1. /family/[token] malformed-token gate (C7)
 *   2. /family/[token] unknown-token gate, no enumeration oracle (C2 +
 *      C5 + C6 collapse to the same uniform fail UI)
 *   3. /admin/cost auth gate (closed-by-default 404)
 *   4. /admin/audit auth gate
 *   5. /admin/family-share auth gate
 *   6. /admin/visit-reminders auth gate
 *   7. /admin/partner-l2-stats auth gate
 *
 * Each test asserts response.status() < 500 — the bar is "no Phase 3
 * regression makes a public surface 500-error". The manual checklist
 * remains the source of truth for the cross-device behaviours.
 */

test.describe("Phase 3 integration smoke", () => {
  test.beforeEach(async ({ page }) => {
    // Mobile viewport — matches the production target. A regression
    // that breaks 375px is the one we need to catch first.
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test("C-1 family share: malformed token renders fail UI without crashing", async ({
    page,
  }) => {
    // Token shape gate fires BEFORE any DB query, so this should
    // always render the same uniform fail card regardless of DB state.
    const response = await page.goto("/family/not-a-real-token");
    expect(response?.status() ?? 0).toBeLessThan(500);
    // Public route copy from src/app/family/[token]/page.tsx — the
    // fail variant. Pinned because it's the user-visible no-leak
    // affordance (token-not-found vs revoked vs expired all collapse).
    await expect(page.getByText("このページは表示できません")).toBeVisible();
  });

  test("C-1 family share: unknown 64-hex token shows the SAME fail UI (no enumeration oracle)", async ({
    page,
  }) => {
    // 64 hex chars = matches the regex shape, so it passes the early
    // guard and probes the DB. Should still render the same uniform
    // fail card — never echo "this token doesn't exist" to a probe.
    const fakeButShapedRight = "f".repeat(64);
    const response = await page.goto(`/family/${fakeButShapedRight}`);
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByText("このページは表示できません")).toBeVisible();
  });

  test("/admin/cost: 404 for unauthenticated visitors (closed-by-default gate)", async ({
    page,
  }) => {
    // Admin allow-list (`ADMIN_EMAILS` env) is empty in CI / local,
    // so every /admin/* route should `notFound()` rather than echo a
    // 403 — leaking the existence of admin surfaces is the leak this
    // gate prevents.
    const response = await page.goto("/admin/cost");
    expect(response?.status()).toBe(404);
  });

  test("/admin/audit: 404 for unauthenticated visitors", async ({ page }) => {
    const response = await page.goto("/admin/audit");
    expect(response?.status()).toBe(404);
  });

  test("/admin/family-share: 404 for unauthenticated visitors", async ({
    page,
  }) => {
    const response = await page.goto("/admin/family-share");
    expect(response?.status()).toBe(404);
  });

  test("/admin/visit-reminders: 404 for unauthenticated visitors", async ({
    page,
  }) => {
    const response = await page.goto("/admin/visit-reminders");
    expect(response?.status()).toBe(404);
  });

  test("/admin/partner-l2-stats: 404 for unauthenticated visitors", async ({
    page,
  }) => {
    const response = await page.goto("/admin/partner-l2-stats");
    expect(response?.status()).toBe(404);
  });

  test("/admin/health: 404 for unauthenticated visitors (post-2026-05-03 incident health page)", async ({
    page,
  }) => {
    // The new operator-facing health view sits under the same admin
    // allow-list as the other /admin/* surfaces. Sentinel: a future
    // refactor that accidentally exposed it publicly would surface
    // env-presence + Supabase URL signal that's worth keeping inside
    // the gate.
    const response = await page.goto("/admin/health");
    expect(response?.status()).toBe(404);
  });

  test("/admin/feedback: 404 for unauthenticated visitors (Beta inbox)", async ({
    page,
  }) => {
    // /mypage/feedback writes audit rows readable on /admin/feedback.
    // Same allow-list pattern as the other /admin/* views.
    const response = await page.goto("/admin/feedback");
    expect(response?.status()).toBe(404);
  });

  test("public family route is in the route table (the file resolves)", async ({
    page,
  }) => {
    // Sentinel: if a future refactor moved /family/[token] under
    // (app)/ by mistake, the middleware would 401-redirect to /login
    // instead of letting the page render. We assert presence by
    // checking we DON'T get redirected to /login.
    const response = await page.goto("/family/0123456789");
    const url = response?.url() ?? page.url();
    expect(url).not.toContain("/login");
  });

  test("D2 invite welcome: malformed token shows the editorial fail card (no crash)", async ({
    page,
  }) => {
    // Token shape gate fires BEFORE any DB query. The D2 editorial
    // refresh kept the same enumeration-mitigation copy, so a
    // malformed token must always render "うまくお渡しできませんでした".
    const response = await page.goto("/invite/not-a-real-token");
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(
      page.getByText("うまくお渡しできませんでした"),
    ).toBeVisible();
  });

  test("D2 invite welcome: unknown 64-hex token also collapses to invalid card (enumeration mitigation)", async ({
    page,
  }) => {
    // 64 hex chars passes the early shape guard and probes the DB.
    // The "invalid" + "stale" branches share copy by design so a
    // probe can't distinguish "token never existed" from "already
    // consumed". A new test would catch a regression that splits the
    // two branches' copy by accident.
    const fakeButShapedRight = "a".repeat(64);
    const response = await page.goto(`/invite/${fakeButShapedRight}`);
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(
      page.getByText("うまくお渡しできませんでした"),
    ).toBeVisible();
  });
});
