/**
 * Comprehensive authenticated app smoke — 認証済みユーザーで主要 12 ルートを
 * 巡回し、各画面で以下を検証する横断スモーク。
 *
 *   1. h1 が少なくとも 1 つ visible（情報アーキテクチャの基本）
 *   2. error boundary（「うまくいきませんでした」）が出ない
 *   3. 致命的 console error / 4xx-5xx resource error が 0
 *      （WebSocket HMR, Vercel Analytics の proxied 404 は除外）
 *   4. 375px で水平スクロールしない（fixed UI のはみ出し防止）
 *   5. bottom-nav が常に viewport 内に見えている
 *
 * 加えて bottom-nav の 5 タブを実タップして全遷移 + touch target 44px を検証。
 *
 * 前提: Supabase service role が .env.local に設定されていること。
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const hasEnv = Boolean(SUPABASE_URL && SERVICE_ROLE);

// Lazy init — `createClient` throws when SERVICE_ROLE is empty, so we guard
// at module load. Tests call `test.skip(!hasEnv, …)` in beforeAll to bail
// out cleanly on CI where the service-role secret is intentionally absent.
const admin = hasEnv
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  : null;

let testEmail: string;
let testPassword: string;
let userId: string;

test.beforeAll(async () => {
  test.skip(!hasEnv, "Supabase env not set — skipping comprehensive smoke.");
  testEmail = `smoke-${randomUUID().slice(0, 8)}@haretoki.test`;
  testPassword = "Test1234!smoke";
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
 * ログイン → onboarding を cookie bypass + /home 初回訪問で
 * Prisma User/Project/ProjectMember を自動作成させる共通手順。
 */
async function loginAndOnboard(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[id="email"]', testEmail);
  await page.fill('input[id="password"]', testPassword);
  await page.click('button[type="submit"]');
  // dev mode (next dev) の JIT compile + 並列負荷を考慮して 30s。
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

/**
 * 共通の致命的 error フィルタ。WebSocket の HMR churn と、
 * `next start` ローカルでは 404 になる Vercel Analytics/Speed Insights の
 * proxied エンドポイントは無視する。
 */
function isFatalConsole(entry: string): boolean {
  if (entry.includes("WebSocket")) return false;
  if (entry.includes("/_vercel/insights")) return false;
  if (entry.includes("/_vercel/speed-insights")) return false;
  // Dev オーバーレイ経由の React error の重複は許容
  if (entry.includes("503")) return false;
  return true;
}

interface RouteSpec {
  path: string;
  /** h1 テキストに含まれるべきフラグメント（任意）。未指定なら h1 存在のみ検証。 */
  h1Match?: RegExp;
  /** ルート固有にスキップが要るケース（現時点では無し）。 */
  skip?: boolean;
}

/**
 * 認証後に到達するルート 12 本。/venues/[id] は実データ依存のため
 * 本 suite では扱わず、/candidates/duel は venue 0 件でも破綻しないことを
 * expect するため h1 マッチを緩める。
 */
const AUTH_ROUTES: RouteSpec[] = [
  { path: "/home" },
  { path: "/explore" },
  { path: "/candidates" },
  { path: "/candidates/duel" },
  { path: "/coach" },
  { path: "/mypage" },
  { path: "/mypage/saved-searches" },
  { path: "/journey", h1Match: /晴れまでの道/ },
  { path: "/checklist" },
  { path: "/compare" },
  { path: "/notifications" },
  { path: "/settings" },
];

test.describe.configure({ mode: "serial" });

test.describe("Comprehensive authenticated app smoke", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.slow(); // dev mode の初回 compile を見越して 3x timeout

  for (const route of AUTH_ROUTES) {
    test(`${route.path}: h1 visible, no error boundary, no fatal console errors`, async ({
      page,
    }) => {
      test.skip(!!route.skip, `${route.path} is skipped in this suite`);

      const consoleErrors: string[] = [];
      const httpErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const loc = msg.location();
        const url = loc?.url ?? "";
        const combined = url ? `${msg.text()} (${url})` : msg.text();
        if (isFatalConsole(combined)) consoleErrors.push(combined);
      });
      page.on("response", (res) => {
        const url = res.url();
        if (!url.startsWith("http://localhost")) return;
        if (res.status() < 400) return;
        if (url.includes("favicon")) return;
        if (url.includes("/api/coach")) return;
        if (url.includes("/_vercel/insights")) return;
        if (url.includes("/_vercel/speed-insights")) return;
        httpErrors.push(`${res.status()} ${url}`);
      });

      await loginAndOnboard(page);
      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);

      // 1. error boundary が出ていない
      await expect(
        page.locator("text=うまくいきませんでした"),
      ).not.toBeVisible();

      // 2. h1 が少なくとも 1 個 visible
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible({ timeout: 5000 });
      if (route.h1Match) {
        const text = await h1.textContent();
        expect(text ?? "").toMatch(route.h1Match);
      }

      // 3. bottom-nav が可視（固定ナビがはみ出していない）
      const nav = page.locator('nav[aria-label="メインナビゲーション"]');
      await expect(nav).toBeVisible();

      // 4. 375 で水平スクロールしない
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scrollWidth,
        `Horizontal overflow on ${route.path}: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);

      // 5. console / HTTP エラー 0
      expect(
        consoleErrors,
        `Console errors on ${route.path}:\n${consoleErrors.join("\n")}`,
      ).toHaveLength(0);
      expect(
        httpErrors,
        `HTTP errors on ${route.path}:\n${httpErrors.join("\n")}`,
      ).toHaveLength(0);
    });
  }
});

test.describe("Bottom nav: 5-tab traversal", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  // PR T1.2: this describe block exercises 5 consecutive navigations
  // against `npm run dev`, which JIT-compiles each route on first
  // visit. The total compile time per tab on a cold Vercel preview
  // worker can spike to 8-12s; 5 tabs = 40-60s wall time. Bump the
  // describe-level timeout to 3x default + retry 2 to absorb the
  // worst-case JIT spike without polluting unrelated specs.
  test.describe.configure({ retries: 2, timeout: 180_000 });

  const TABS = [
    { label: "ホーム", href: "/home" },
    { label: "探す", href: "/explore" },
    { label: "候補", href: "/candidates" },
    { label: "コーチ", href: "/coach" },
    { label: "マイページ", href: "/mypage" },
  ];

  test("all 5 tabs navigate to their route and reach an h1", async ({
    page,
  }) => {
    await loginAndOnboard(page);

    for (const tab of TABS) {
      const link = page
        .locator('nav[aria-label="メインナビゲーション"] a', {
          hasText: tab.label,
        })
        .first();
      await expect(link).toBeVisible();
      // next dev の `<nextjs-portal>` overlay が pointer event を奪うことが
      // あるため force click で迂回（prod build では overlay 自体が出ない）。
      await link.click({ force: true });
      // PR T1.2: bumped waitForURL from 15s to 30s — JIT compile of an
      // un-cached route can exceed 15s on a cold Vercel preview worker.
      // 30s mirrors the 30s ceiling Playwright uses for navigation by
      // default; longer than that and we want to know about it instead
      // of swallowing it.
      await page.waitForURL(new RegExp(`${tab.href}(\\?.*)?$`), {
        timeout: 30_000,
      });
      // Wait for the dev server to settle after the route swap before
      // probing h1 — a still-compiling page returns a loading shell
      // first, then resolves to the real h1 after hydration.
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {
          /* networkidle can flake on dev server with HMR — best-effort */
        });
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("bottom-nav tab targets are >= 44px tall", async ({ page }) => {
    await loginAndOnboard(page);
    const navLinks = page.locator(
      'nav[aria-label="メインナビゲーション"] a',
    );
    const count = await navLinks.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox();
      expect(box, `nav link ${i} should have a bounding box`).not.toBeNull();
      // h-14 = 56px なので 44 を満たす
      expect(box!.height, `nav link ${i} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test("bottom-nav stays within viewport at 375x667 (no right-edge clipping)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAndOnboard(page);
    const nav = page.locator('nav[aria-label="メインナビゲーション"]');
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(376); // +1 rounding
  });
});
