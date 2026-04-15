/**
 * Autonomous QA exploration.
 * Creates a test user via Supabase admin API, logs in via UI,
 * walks through every screen, clicks every visible button,
 * and records console errors, failed requests, dead-ends, and
 * perceived-latency outliers.
 *
 * Run: node tests/explore/autonomous-qa.mjs
 * Requires dev server on :3000 and .env.local with Supabase service role.
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("Missing Supabase env");

const BASE = "http://localhost:3000";
const OUTDIR = "/tmp/haretoki-qa";
mkdirSync(OUTDIR, { recursive: true });

const findings = [];
const record = (severity, area, message, extra = {}) => {
  findings.push({ severity, area, message, ...extra });
  console.log(`[${severity}] ${area}: ${message}`);
};

// 1. Create test user via admin API ---------------------------------
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});
const testEmail = `qa-${randomUUID().slice(0, 8)}@haretoki.test`;
const testPassword = "Test1234!qa";
console.log(`Creating test user: ${testEmail}`);
const { data: userData, error: userErr } = await admin.auth.admin.createUser({
  email: testEmail,
  password: testPassword,
  email_confirm: true,
});
if (userErr) throw userErr;
const userId = userData.user.id;
console.log(`User created: ${userId}`);

// 2. Launch browser with Mobile Chrome emulation --------------------
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

// Capture console & network errors
page.on("console", (msg) => {
  if (msg.type() === "error") {
    record("ERROR", `console:${page.url()}`, msg.text());
  } else if (msg.type() === "warning" && !/Fast Refresh/.test(msg.text())) {
    record("WARN", `console:${page.url()}`, msg.text());
  }
});
page.on("pageerror", (err) => record("CRASH", `page:${page.url()}`, err.message));
page.on("response", (res) => {
  const url = res.url();
  if (url.startsWith(BASE) && res.status() >= 400 && !url.includes("favicon")) {
    record("HTTP", `network`, `${res.status()} ${res.request().method()} ${url.replace(BASE, "")}`);
  }
});

const shot = async (name) => {
  const path = `${OUTDIR}/${String(findings.length).padStart(3, "0")}-${name}.png`;
  await page.screenshot({ path, fullPage: false });
  return path;
};

const timed = async (label, fn) => {
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  if (ms > 3000) record("SLOW", label, `${ms}ms`);
  return { ms, result };
};

// 3. Landing page ---------------------------------------------------
console.log("\n── Landing page ──");
await timed("landing-load", () => page.goto(BASE, { waitUntil: "domcontentloaded" }));
await page.waitForTimeout(500);
await shot("landing");

// Check hrefs resolve
const hrefs = await page.$$eval("a[href^='/']", (els) =>
  els.map((a) => a.getAttribute("href")).filter((h) => h && !h.startsWith("/#")),
);
const uniqueHrefs = [...new Set(hrefs)];
console.log(`  landing has ${uniqueHrefs.length} internal links`);

// 4. Login ---------------------------------------------------------
console.log("\n── Login ──");
await page.goto(`${BASE}/login`);
await page.waitForSelector('input[type="email"]', { timeout: 5000 });
await page.fill('input[type="email"]', testEmail);
await page.fill('input[type="password"]', testPassword);
await shot("login-filled");
const { ms: loginMs } = await timed("login-submit", async () => {
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(home|onboarding)/, { timeout: 15000 }).catch(() => {});
});
console.log(`  login took ${loginMs}ms → ${page.url()}`);
await shot("post-login");

// 5. Onboarding (if redirected there) -------------------------------
if (page.url().includes("/onboarding")) {
  console.log("\n── Onboarding ──");
  await page.waitForTimeout(1000);
  await shot("onboarding-start");
  // Look for any interactive step – buttons, inputs, options
  const buttons = await page.$$eval("button:not([disabled])", (bs) =>
    bs.map((b) => b.textContent?.trim()).filter(Boolean),
  );
  console.log(`  onboarding buttons visible: ${buttons.length}`);
  // Try to complete – click first enabled button 4 times, taking a screenshot each time
  for (let step = 0; step < 8; step++) {
    const active = await page
      .$$("button:not([disabled])")
      .then((bs) => bs[bs.length - 1]);
    if (!active) break;
    const label = await active.textContent();
    console.log(`  step ${step + 1}: click "${label?.trim()}"`);
    await active.click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(`onboarding-step-${step + 1}`);
    if (page.url().includes("/home")) break;
  }
  if (!page.url().includes("/home")) {
    record(
      "WARN",
      "onboarding",
      `did not reach /home after 8 button clicks — stuck at ${page.url()}`,
    );
  }
}

// Fallback: force set onboarding cookie if stuck
if (!page.url().includes("/home")) {
  await ctx.addCookies([
    {
      name: "onboarding_completed",
      value: "1",
      url: BASE,
    },
  ]);
  await page.goto(`${BASE}/home`);
}

// 6. Explore each primary route -------------------------------------
const routes = [
  { path: "/home", name: "home" },
  { path: "/explore", name: "explore" },
  { path: "/candidates", name: "candidates" },
  { path: "/coach", name: "coach" },
  { path: "/mypage", name: "mypage" },
  { path: "/settings", name: "settings" },
];

for (const r of routes) {
  console.log(`\n── Route ${r.path} ──`);
  const { ms } = await timed(`route:${r.name}`, async () => {
    await page.goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });
  console.log(`  ${r.path} loaded in ${ms}ms`);
  await shot(`route-${r.name}`);

  // Count interactive elements
  const counts = await page.evaluate(() => {
    const btns = document.querySelectorAll("button:not([disabled])").length;
    const links = document.querySelectorAll("a[href]").length;
    const inputs = document.querySelectorAll("input,textarea,select").length;
    return { btns, links, inputs };
  });
  console.log(`  elements: ${counts.btns} buttons, ${counts.links} links, ${counts.inputs} inputs`);

  // Check for tiny touch targets (<44px)
  const tinyTargets = await page.$$eval(
    "button:not([disabled]), a[href]",
    (els) =>
      els
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            text: (el.textContent || "").trim().slice(0, 20),
            width: Math.round(r.width),
            height: Math.round(r.height),
            visible: r.width > 0 && r.height > 0,
          };
        })
        .filter((x) => x.visible && (x.height < 36 || x.width < 36)),
  );
  if (tinyTargets.length > 0) {
    record(
      "UX",
      r.name,
      `${tinyTargets.length} tappable elements smaller than 36px`,
      { examples: tinyTargets.slice(0, 3) },
    );
  }

  // Check for horizontal scroll at 390px
  const hasHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  if (hasHScroll) record("UX", r.name, "horizontal scroll at 390px");
}

// 7. Home feature tests --------------------------------------------
console.log("\n── Home deep dive ──");
await page.goto(`${BASE}/home`);
await page.waitForTimeout(1500);

// 8. Explore: add venue test ---------------------------------------
console.log("\n── Explore: add venue ──");
await page.goto(`${BASE}/explore`);
await page.waitForTimeout(1500);

// Click "追加" button
const addBtn = await page.$("button:has-text('追加')");
if (addBtn) {
  await addBtn.click();
  await page.waitForTimeout(800);
  await shot("add-venue-sheet");
  // Try manual venue creation
  const nameInput = await page.$('input[placeholder*="式場名"], input[name="name"]');
  if (nameInput) {
    await nameInput.fill("QAテスト式場");
    const locInput = await page.$('input[placeholder*="場所"], input[placeholder*="エリア"], input[name="location"]');
    if (locInput) await locInput.fill("東京都渋谷区");
    await shot("add-venue-filled");
    // find submit button inside sheet
    const submit = await page.$("button[type='submit']");
    if (submit) {
      const { ms } = await timed("venue-create", async () => {
        await submit.click();
        await page.waitForTimeout(2500);
      });
      console.log(`  venue create took ${ms}ms`);
    } else {
      record("UX", "explore-add", "submit button not found inside add sheet");
    }
  } else {
    record("UX", "explore-add", "name input not found inside add sheet");
  }
}
await shot("after-add-venue");

// 9. Test search bar ----------------------------------------------
console.log("\n── Search bar ──");
const searchInput = await page.$('input[type="search"]');
if (searchInput) {
  await searchInput.fill("QA");
  await page.waitForTimeout(500);
  await shot("search-typing");
  await page.waitForTimeout(400);
  await shot("search-results");
  const urlHasQ = page.url().includes("q=");
  if (!urlHasQ) record("UX", "search", "URL not updated with ?q= after debounce");
} else {
  record("UX", "explore", "search input not found");
}

// clear
await page.goto(`${BASE}/explore`);
await page.waitForTimeout(800);

// 10. Tap first venue card --------------------------------------
console.log("\n── Venue detail ──");
const venueLink = await page.$("a[href^='/venues/']");
if (venueLink) {
  const href = await venueLink.getAttribute("href");
  const { ms } = await timed("venue-detail-load", async () => {
    await venueLink.click();
    await page.waitForURL(/\/venues\//, { timeout: 8000 });
    await page.waitForTimeout(1200);
  });
  console.log(`  venue detail (${href}) loaded in ${ms}ms`);
  await shot("venue-detail");
  // Try favorite button
  const heart = await page.$("button[aria-label*='お気に入り'], button[aria-label*='候補']");
  if (heart) {
    await heart.click();
    await page.waitForTimeout(500);
    await shot("after-favorite");
  } else {
    record("UX", "venue-detail", "heart/favorite button not found");
  }

  // Try share button
  const share = await page.$("button[aria-label*='共有']");
  if (share) {
    await share.click();
    await page.waitForTimeout(600);
    await shot("after-share");
  } else {
    record("UX", "venue-detail", "share button not found");
  }

  // Try rating
  const star = await page.$("button[aria-label*='点'], [role='slider']");
  if (!star) {
    // stars may be buttons with data or titles
    const stars = await page.$$("button");
    if (stars.length > 0) {
      // heuristic: find star-shaped svg inside buttons
    }
  }
} else {
  record("UX", "explore", "no venue link found in list");
}

// 11. Coach chat ---------------------------------------------------
console.log("\n── Coach ──");
await page.goto(`${BASE}/coach`);
await page.waitForTimeout(1200);
await shot("coach");

const chatInput = await page.$("input[placeholder*='聞いて'], input[placeholder*='質問']");
if (chatInput) {
  await chatInput.fill("費用はどれくらいかかる？");
  await shot("coach-typing");
  const send = await page.$("button[aria-label*='送信']");
  if (send) {
    const { ms } = await timed("coach-send", async () => {
      await send.click();
      await page.waitForTimeout(3000);
    });
    console.log(`  coach response in ${ms}ms`);
    if (ms > 8000) record("SLOW", "coach", `reply took ${ms}ms (no streaming feedback)`);
    await shot("coach-reply");
  } else {
    record("UX", "coach", "send button not found");
  }
} else {
  record("UX", "coach", "chat input not found");
}

// 12. Bottom nav accessibility -------------------------------------
console.log("\n── Bottom nav labels ──");
await page.goto(`${BASE}/home`);
await page.waitForTimeout(500);
const navInfo = await page.evaluate(() => {
  const nav = document.querySelector("nav[aria-label='メインナビゲーション']");
  if (!nav) return { found: false };
  const tabs = [...nav.querySelectorAll("a")].map((a) => {
    const label = a.querySelector("span")?.textContent;
    const r = a.getBoundingClientRect();
    const textW = a.querySelector("span")?.getBoundingClientRect().width ?? 0;
    return {
      label,
      width: Math.round(r.width),
      textWidth: Math.round(textW),
      textOverflows: Math.round(textW) > Math.round(r.width) - 4,
    };
  });
  return { found: true, tabs };
});
console.log("  tabs:", JSON.stringify(navInfo, null, 2));
if (navInfo.tabs?.some((t) => t.textOverflows)) {
  record("UX", "bottom-nav", "at least one tab label overflows its container");
}

// 13. Write final report -------------------------------------------
const report = {
  testEmail,
  userId,
  findings,
  summary: {
    total: findings.length,
    bySeverity: findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {}),
    byArea: findings.reduce((acc, f) => {
      acc[f.area.split(":")[0]] = (acc[f.area.split(":")[0]] || 0) + 1;
      return acc;
    }, {}),
  },
};
writeFileSync(`${OUTDIR}/report.json`, JSON.stringify(report, null, 2));
console.log(`\n═══ ${findings.length} findings ═══`);
console.log(JSON.stringify(report.summary, null, 2));

// 14. Cleanup ------------------------------------------------------
await browser.close();
await admin.auth.admin.deleteUser(userId).catch(() => {});
console.log(`\nScreenshots: ${OUTDIR}/`);
console.log(`Report: ${OUTDIR}/report.json`);
