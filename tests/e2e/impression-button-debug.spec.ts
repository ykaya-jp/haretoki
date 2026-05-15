/**
 * One-off debug spec — verify the "印象を残す · 集中モードでひらく"
 * button on /venues/[id] actually navigates in production after the
 * PR #49 visual fix. User reported the deploy reflected the new
 * styling but tapping still does nothing.
 *
 * Run:
 *   BASE_URL=https://haretoki.vercel.app \
 *     npx playwright test impression-button-debug --project="Mobile Chrome"
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const hasEnv = Boolean(SUPABASE_URL && SERVICE_ROLE && DATABASE_URL);

const admin = hasEnv
  ? createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    })
  : null;

let testEmail: string;
let testPassword: string;
let userId: string;
let projectId: string;
let venueId: string;
let pg: Client;

test.beforeAll(async () => {
  test.skip(!hasEnv, "Supabase / DB env not set.");
  testEmail = `imp-debug-${randomUUID().slice(0, 8)}@haretoki.test`;
  testPassword = "Test1234!debug";
  const { data, error } = await admin!.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;

  pg = new Client({ connectionString: DATABASE_URL });
  await pg.connect();
  await pg.query(`INSERT INTO users (id, email, updated_at) VALUES ($1, $2, now()) ON CONFLICT DO NOTHING`, [userId, testEmail]);
  projectId = randomUUID();
  await pg.query(`INSERT INTO projects (id, name, updated_at) VALUES ($1, 'imp debug project', now())`, [projectId]);
  await pg.query(`INSERT INTO project_members (project_id, user_id, role, accepted_at) VALUES ($1, $2, 'owner', now())`, [projectId, userId]);
  venueId = randomUUID();
  await pg.query(`INSERT INTO venues (id, project_id, name, location, updated_at) VALUES ($1, $2, 'デバッグ会場', '東京都', now())`, [venueId, projectId]);
});

test.afterAll(async () => {
  if (pg) {
    await pg.query(`DELETE FROM venues WHERE id = $1`, [venueId]).catch(() => {});
    await pg.query(`DELETE FROM project_members WHERE project_id = $1`, [projectId]).catch(() => {});
    await pg.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => {});
    await pg.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => {});
    await pg.end();
  }
  if (userId) await admin?.auth.admin.deleteUser(userId).catch(() => {});
});

test.describe("impression button click behaviour", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("clicking the focus-mode CTA actually navigates to /impression", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // 1. login
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
    const cookies = await page.context().cookies();
    console.log("[debug] cookies =", cookies.map((c) => `${c.name}=${c.value} d=${c.domain}`).join("; "));

    // 2. visit /venues/[id]
    const resp = await page.goto(`/venues/${venueId}`);
    console.log("[debug] goto status =", resp?.status(), "url =", page.url());
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000); // settle Suspense streaming
    console.log("[debug] page url after settle =", page.url());
    console.log("[debug] page title =", await page.title());
    const h1 = await page.locator("h1").first().textContent().catch(() => "(no h1)");
    console.log("[debug] first h1 =", h1);

    // 3. inspect the CTA — search by partial text as fallback
    let cta = page.getByRole("link", { name: /印象を残す.*集中モードでひらく/ });
    let count = await cta.count();
    console.log("[debug] getByRole(link 印象を残す...) count =", count);
    if (count === 0) {
      // Fallback: locate the <a> by href to confirm presence regardless of accessible-name issues
      cta = page.locator(`a[href="/venues/${venueId}/impression"]`);
      count = await cta.count();
      console.log("[debug] a[href=/impression] count =", count);
      const html = await page.content();
      const idx = html.indexOf("印象を残す");
      console.log("[debug] '印象を残す' index in HTML =", idx);
      if (idx > 0) console.log("[debug] context:", html.slice(Math.max(0, idx - 200), idx + 300));
    }
    await expect(cta).toBeVisible({ timeout: 10000 });
    const href = await cta.getAttribute("href");
    console.log("[debug] CTA href =", href);
    expect(href, "Link href must point to /impression").toBe(
      `/venues/${venueId}/impression`,
    );
    const box = await cta.boundingBox();
    console.log("[debug] CTA bounding box =", box);
    expect(box?.height ?? 0, "Tap target must clear the 44px floor").toBeGreaterThanOrEqual(
      44,
    );

    // 4. tap and verify navigation
    await cta.click();
    await page.waitForURL((url) => url.pathname.endsWith("/impression"), {
      timeout: 15000,
    });
    expect(page.url()).toContain(`/venues/${venueId}/impression`);

    // 5. assert no fatal console errors during the flow
    const fatal = consoleErrors.filter(
      (m) =>
        !/Failed to fetch|WebSocket|Hydration mismatch|404|insights|speed-insights|Permissions policy|Geolocation/i.test(
          m,
        ),
    );
    expect(fatal, `fatal console errors: ${JSON.stringify(fatal)}`).toEqual([]);
  });
});
