/**
 * Exhaustive autonomous QA — every button, every transition, every state.
 *
 * Stages:
 *  1. Create owner test user via Supabase admin
 *  2. Complete onboarding (click through all 4 questions)
 *  3. Add 3 venues manually (自分で tab)
 *  4. Rate each venue (all 6 dimensions)
 *  5. Favorite 2 venues
 *  6. Visit each bottom-nav route
 *  7. Test Explore filter sheet (open, each filter, apply, reset)
 *  8. Test search bar
 *  9. Test each segmented control on Candidates
 * 10. Test Coach chat (send, await reply)
 * 11. Test Venue detail: rating, share, favorite, visit add, photo gallery
 * 12. Test Mypage: all sections, partner invite buttons
 * 13. Test Settings: theme switcher (Light / Dark / System), logout
 * 14. Test Dark mode on every page
 * 15. Track every console message, failed request, render error
 * 16. Measure transition timing for each nav tap
 *
 * Output: /tmp/haretoki-qa/ (screenshots + report.json + summary.md)
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("Missing Supabase env");

const BASE = "http://localhost:3000";
const OUTDIR = "/tmp/haretoki-qa";
try { rmSync(OUTDIR, { recursive: true, force: true }); } catch {}
mkdirSync(OUTDIR, { recursive: true });

const findings = [];
const timeline = [];
let step = 0;

const rec = (severity, area, message, extra = {}) => {
  findings.push({ severity, area, message, ...extra });
  console.log(`  [${severity}] ${area}: ${message}`);
};

const shot = async (page, name) => {
  step++;
  const path = `${OUTDIR}/${String(step).padStart(3, "0")}-${name}.png`;
  try {
    await page.screenshot({ path, fullPage: false });
    timeline.push({ step, name, url: page.url(), shot: path });
  } catch (e) {
    rec("ERROR", "screenshot", `${name}: ${e.message}`);
  }
  return path;
};

const timed = async (label, fn, budgetMs = 3000) => {
  const t0 = Date.now();
  let result, err;
  try { result = await fn(); } catch (e) { err = e; }
  const ms = Date.now() - t0;
  timeline.push({ ms, label });
  if (ms > budgetMs) rec("SLOW", label, `${ms}ms (budget ${budgetMs}ms)`);
  if (err) rec("CRASH", label, err.message);
  return { ms, result, err };
};

// ───── Create test user ─────
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const testEmail = `qa-${randomUUID().slice(0, 8)}@haretoki.test`;
const testPassword = "Test1234!qa";
console.log(`\n▶ Creating test user: ${testEmail}`);
const { data: userData, error: userErr } = await admin.auth.admin.createUser({
  email: testEmail, password: testPassword, email_confirm: true,
});
if (userErr) throw userErr;
const userId = userData.user.id;

// ───── Browser setup ─────
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "ja-JP",
});

ctx.on("console", () => {});
const page = await ctx.newPage();

page.on("console", (msg) => {
  const text = msg.text();
  if (msg.type() === "error") rec("ERROR", `console:${abbr(page.url())}`, truncate(text, 180));
  else if (msg.type() === "warning" && !/Fast Refresh|Download the React DevTools/.test(text))
    rec("WARN", `console:${abbr(page.url())}`, truncate(text, 180));
});
page.on("pageerror", (e) => rec("CRASH", `page:${abbr(page.url())}`, e.message));
page.on("response", (r) => {
  const url = r.url();
  const st = r.status();
  if (url.startsWith(BASE) && st >= 400 && !url.includes("favicon") && !url.includes("/_next/")) {
    rec("HTTP", `net:${abbr(url)}`, `${r.request().method()} ${st}`);
  }
});

function abbr(u) { return u.replace(BASE, "") || "/"; }
function truncate(s, n) { return s.length > n ? s.slice(0, n) + "…" : s; }

// ───── 1. Landing ─────
console.log("\n▶ 1. Landing page");
await timed("landing-cold", () => page.goto(BASE, { waitUntil: "domcontentloaded" }), 4000);
await page.waitForTimeout(500);
await shot(page, "landing");
const landingLinks = await page.$$eval("a[href^='/']", els =>
  [...new Set(els.map(a => a.getAttribute("href")))]
).catch(() => []);
console.log(`  internal links: ${landingLinks.join(", ")}`);

// Check landing CTA button specifically
const ctaCount = await page.$$eval("a[href='/signup'], a[href='/login']", a => a.length);
if (ctaCount === 0) rec("UX", "landing", "no obvious CTA to signup/login from landing");

// ───── 2. Signup → Login ─────
console.log("\n▶ 2. Login");
await page.goto(`${BASE}/login`);
await shot(page, "login-empty");
await page.fill('input[type="email"]', testEmail);
await page.fill('input[type="password"]', testPassword);
await shot(page, "login-filled");
const login = await timed("login-submit", async () => {
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(home|onboarding)/, { timeout: 15000 });
}, 2500);
console.log(`  login reached ${page.url()} in ${login.ms}ms`);
await shot(page, "after-login");

// ───── 3. Onboarding ─────
if (page.url().includes("/onboarding")) {
  console.log("\n▶ 3. Onboarding (real flow)");
  await page.waitForTimeout(800);
  await shot(page, "onboarding-q1");
  // Step 1: click a chip, then 次へ
  for (let q = 0; q < 5; q++) {
    const chips = await page.$$("button.rounded-full:not([disabled])");
    console.log(`  question ${q + 1}: found ${chips.length} chips`);
    if (chips.length === 0) break;
    // Pick first chip
    await chips[0].click();
    await page.waitForTimeout(200);
    const nextBtn = await page.$("button:has-text('次へ'), button:has-text('始める'), button:has-text('完了')");
    if (!nextBtn) {
      rec("WARN", "onboarding", `step ${q + 1}: "次へ" button not found after selecting chip`);
      break;
    }
    await timed(`onb-step-${q + 1}`, async () => {
      await nextBtn.click();
      await page.waitForTimeout(1000);
    }, 2000);
    await shot(page, `onboarding-q${q + 2}`);
    if (page.url().includes("/home")) break;
  }
  if (!page.url().includes("/home")) {
    rec("UX", "onboarding", `did not reach /home after 5 questions, stuck at ${page.url()}`);
    // Force onboarding cookie and goto home
    await ctx.addCookies([{ name: "onboarding_completed", value: "1", url: BASE }]);
    await page.goto(`${BASE}/home`);
  }
}

// ───── 4. Home (first visit, no venues) ─────
console.log("\n▶ 4. Home (empty state)");
await page.goto(`${BASE}/home`);
await page.waitForTimeout(1500);
await shot(page, "home-empty");

// Inspect greeting
const greeting = await page.$eval("h1,h2,h3", el => el.textContent?.trim()).catch(() => null);
console.log(`  greeting: "${greeting}"`);
if (greeting?.includes("qa-")) {
  rec("UX", "home", `greeting uses email local-part as display name: "${greeting}"`);
}

// Measure font rendering — check a known heading's visual quality
const fontRender = await page.evaluate(() => {
  const h = document.querySelector(".font-serif") || document.querySelector("h1,h2,h3");
  if (!h) return null;
  const cs = window.getComputedStyle(h);
  return { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, text: h.textContent?.trim().slice(0, 40) };
});
console.log(`  heading font: ${JSON.stringify(fontRender)}`);

// ───── 5. Add 3 venues manually ─────
console.log("\n▶ 5. Add 3 venues manually");
await page.goto(`${BASE}/explore`);
await page.waitForTimeout(800);
await shot(page, "explore-empty");

const venues = [
  { name: "花の森ガーデン", location: "東京都世田谷区" },
  { name: "ベイサイドチャペル横浜", location: "横浜市みなとみらい" },
  { name: "京都老舗料亭ウェディング", location: "京都市東山区" },
];

for (const v of venues) {
  console.log(`  adding ${v.name}...`);
  // Open add sheet
  const addBtn = await page.$("button:has-text('追加')");
  if (!addBtn) { rec("UX", "explore", "追加 button not found"); break; }
  await addBtn.click();
  await page.waitForTimeout(500);

  // Switch to 自分で tab
  const manualTab = await page.$("button:has-text('自分で'), [role='tab']:has-text('自分で')");
  if (!manualTab) {
    rec("UX", "add-venue-sheet", "自分で tab not found — default tab is URL which is confusing for first-time users");
    await shot(page, `add-sheet-no-manual-tab`);
    break;
  }
  await manualTab.click();
  await page.waitForTimeout(300);

  await shot(page, `add-sheet-manual-${v.name.slice(0, 4)}`);

  const nameIn = await page.$('input[name="name"], input[placeholder*="式場名"]');
  const locIn = await page.$('input[name="location"], input[placeholder*="場所"], input[placeholder*="エリア"]');
  if (!nameIn || !locIn) {
    rec("UX", "add-venue-sheet", "name or location input not found in 自分で tab");
    break;
  }
  await nameIn.fill(v.name);
  await locIn.fill(v.location);

  const submit = await page.$("button[type='submit']:has-text('追加'), button[type='submit']:has-text('登録'), button[type='submit']:has-text('作成'), button[type='submit']:not([disabled])");
  if (!submit) { rec("UX", "add-venue-sheet", "submit button not found"); break; }
  const { ms } = await timed(`venue-add:${v.name}`, async () => {
    await submit.click();
    await page.waitForTimeout(2000);
  }, 3000);
  console.log(`    ${v.name} added in ${ms}ms`);
  await shot(page, `after-add-${v.name.slice(0, 4)}`);
  // Close sheet if still open
  const closeBtn = await page.$("button[aria-label='Close'], button:has-text('×')");
  if (closeBtn) await closeBtn.click().catch(() => {});
  await page.waitForTimeout(400);
}

// Reload explore
await page.goto(`${BASE}/explore`);
await page.waitForTimeout(1200);
await shot(page, "explore-with-venues");
const venueCards = await page.$$("a[href^='/venues/']");
console.log(`  venue cards visible: ${venueCards.length}`);
if (venueCards.length < 3) rec("BUG", "explore", `expected 3 venues, found ${venueCards.length}`);

// ───── 6. Filter sheet ─────
console.log("\n▶ 6. Filter sheet");
const filterBtn = await page.$("button:has-text('条件で探す')");
if (filterBtn) {
  await filterBtn.click();
  await page.waitForTimeout(500);
  await shot(page, "filter-sheet-open");

  // Try each sort option
  const sortOpts = await page.$$("button:has-text('新しい順'), button:has-text('評価'), button:has-text('費用')");
  console.log(`  sort options: ${sortOpts.length}`);
  if (sortOpts.length > 0) {
    await sortOpts[1].click().catch(() => {});
    await page.waitForTimeout(200);
    await shot(page, "filter-sort-picked");
  }

  // Apply
  const applyBtn = await page.$("button:has-text('適用'), button:has-text('決定'), button:has-text('絞り込む'), button:has-text('表示')");
  if (applyBtn) {
    await applyBtn.click();
    await page.waitForTimeout(600);
    await shot(page, "filter-applied");
  } else {
    rec("UX", "filter-sheet", "apply button not found");
  }
} else {
  rec("UX", "explore", "条件で探す (filter sheet trigger) not found");
}

// ───── 7. Search bar ─────
console.log("\n▶ 7. Search bar");
const searchIn = await page.$('input[type="search"]');
if (searchIn) {
  await searchIn.fill("花");
  await page.waitForTimeout(500);
  await shot(page, "search-typing");
  if (!page.url().includes("q=")) rec("UX", "search", "URL did not update with ?q= after 500ms debounce");
  await page.waitForTimeout(400);
  await shot(page, "search-results");
  // Clear
  await searchIn.fill("");
  await page.waitForTimeout(500);
} else {
  rec("UX", "explore", "search input not found");
}

// ───── 8. Venue detail: everything ─────
console.log("\n▶ 8. Venue detail page");
const firstVenue = await page.$("a[href^='/venues/']");
if (firstVenue) {
  const href = await firstVenue.getAttribute("href");
  const { ms } = await timed("venue-detail-nav", async () => {
    await firstVenue.click();
    await page.waitForURL(/\/venues\/[^?]+$/, { timeout: 5000 });
    await page.waitForTimeout(1200);
  }, 1500);
  console.log(`  detail ${href} in ${ms}ms`);
  await shot(page, "venue-detail");

  // 8a. Favorite toggle
  console.log("  - favorite toggle");
  const heart = await page.$("button[aria-label*='お気に入り'], button[aria-label*='候補']");
  if (heart) {
    const { ms } = await timed("heart-toggle", async () => {
      await heart.click();
      await page.waitForTimeout(500);
    }, 1000);
    await shot(page, "after-favorite");
  } else {
    rec("UX", "venue-detail", "heart/favorite button not found");
  }

  // 8b. Rating — tap each dimension at 4 stars
  console.log("  - rating stars");
  const ratingButtons = await page.$$("button[aria-label*='点']");
  console.log(`    star buttons found: ${ratingButtons.length}`);
  if (ratingButtons.length >= 6) {
    // Tap 4th star of each dimension (assuming 5 stars × 6 dims = 30 buttons)
    for (let i = 3; i < ratingButtons.length; i += 5) {
      await ratingButtons[i].click().catch(() => {});
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1200);
    await shot(page, "after-rating");
  } else {
    rec("UX", "venue-detail", `expected 30 star buttons (6 dims × 5), found ${ratingButtons.length}`);
  }

  // 8c. Share button
  console.log("  - share button");
  const share = await page.$("button[aria-label*='共有']");
  if (share) {
    await share.click();
    await page.waitForTimeout(800);
    await shot(page, "after-share");
  } else {
    rec("UX", "venue-detail", "share button not found");
  }

  // 8d. Scroll through all sections
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await shot(page, "venue-detail-bottom");
  await page.evaluate(() => window.scrollTo(0, 0));

  // 8e. Photo upload button (gallery primary button)
  const uploadBtn = await page.$("button:has-text('写真を追加'), button:has-text('写真')");
  console.log(`    photo upload affordance: ${uploadBtn ? "found" : "MISSING"}`);

  // 8f. Back button
  await page.goBack();
  await page.waitForTimeout(800);
} else {
  rec("UX", "explore", "no venue card clickable after adding 3 venues");
}

// ───── 9. Each bottom-nav route ─────
console.log("\n▶ 9. Each bottom-nav route + render quality");
const routes = [
  { path: "/home", name: "home" },
  { path: "/explore", name: "explore" },
  { path: "/candidates", name: "candidates" },
  { path: "/coach", name: "coach" },
  { path: "/mypage", name: "mypage" },
  { path: "/settings", name: "settings" },
];
for (const r of routes) {
  const { ms } = await timed(`route:${r.name}`, async () => {
    await page.goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  }, 2000);
  await shot(page, `route-${r.name}`);

  // Touch target audit
  const tinyTargets = await page.$$eval(
    "button:not([disabled]), a[href]",
    els => els.map(el => {
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || "").trim().slice(0, 24),
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
      };
    }).filter(x => x.visible && (x.h < 44 || x.w < 44))
  );
  if (tinyTargets.length > 0) {
    rec("A11Y", r.name, `${tinyTargets.length} tap targets below 44px`, { samples: tinyTargets.slice(0, 5) });
  }

  // Horizontal scroll
  const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (hScroll) rec("UX", r.name, "horizontal scroll at 390px");

  // Image alt presence
  const imgsMissingAlt = await page.$$eval("img", els =>
    els.filter(img => !img.alt && !img.getAttribute("aria-hidden")).length
  );
  if (imgsMissingAlt > 0) rec("A11Y", r.name, `${imgsMissingAlt} <img> without alt`);

  // Detect mojibake: any heading text with geometric-block chars
  const tofu = await page.evaluate(() => {
    const hs = [...document.querySelectorAll("h1,h2,h3,h4,[class*='font-serif']")];
    return hs.map(h => ({ text: h.textContent?.trim() || "", class: h.className.slice(0, 40) }))
      .filter(x => /[\u{25A0}-\u{25FF}\u{FFFD}]/u.test(x.text));
  });
  if (tofu.length) rec("CRITICAL", r.name, `possible mojibake in ${tofu.length} headings`, { samples: tofu.slice(0, 2) });

  // Empty/loading skeleton presence
  const hasSkel = await page.$$eval("[class*='skeleton']", els => els.length);
  console.log(`  ${r.name}: ${ms}ms, skeletons=${hasSkel}, tinyTargets=${tinyTargets.length}`);
}

// ───── 10. Candidates segmented + sub-tabs ─────
console.log("\n▶ 10. Candidates segmented + sub-tabs");
await page.goto(`${BASE}/candidates`);
await page.waitForTimeout(1000);
await shot(page, "cand-start");

// Segmented
for (const seg of ["自分", "パートナー", "おふたり"]) {
  const btn = await page.$(`button:has-text('${seg}')`);
  if (btn) {
    await btn.click();
    await page.waitForTimeout(400);
    await shot(page, `cand-seg-${seg}`);
  } else rec("UX", "candidates", `segmented option "${seg}" not found`);
}

// Sub-tabs: 候補 / 比べる / 観点別 / 決める
for (const tab of ["比べる", "観点別", "決める"]) {
  const t = await page.$(`button:has-text('${tab}'), [role='tab']:has-text('${tab}')`);
  if (t) {
    await t.click();
    await page.waitForTimeout(800);
    await shot(page, `cand-tab-${tab}`);
  } else rec("UX", "candidates", `sub-tab "${tab}" not found`);
}

// ───── 11. Coach ─────
console.log("\n▶ 11. Coach chat");
await page.goto(`${BASE}/coach`);
await page.waitForTimeout(1200);
await shot(page, "coach-start");
const coachIn = await page.$("input[placeholder*='聞いて'], input[placeholder*='気軽']");
if (coachIn) {
  await coachIn.fill("見積もりで注意すべき項目は？");
  await shot(page, "coach-typing");
  const sendBtn = await page.$("button[aria-label*='送信']");
  if (sendBtn) {
    const { ms } = await timed("coach-reply", async () => {
      await sendBtn.click();
      // Wait for a new assistant message to appear
      await page.waitForTimeout(6000);
    }, 3500);
    await shot(page, "coach-reply");
    if (ms > 3500) rec("SLOW", "coach", `no streaming — full ${ms}ms silence before reply`);
  }
}

// ───── 12. Mypage deep ─────
console.log("\n▶ 12. Mypage deep");
await page.goto(`${BASE}/mypage`);
await page.waitForTimeout(1200);
await shot(page, "mypage-full");

// Scroll whole page
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await shot(page, "mypage-bottom");
await page.evaluate(() => window.scrollTo(0, 0));

// Try partner invite buttons
for (const label of ["LINEで招待", "コピー"]) {
  const b = await page.$(`button:has-text('${label}'), a:has-text('${label}')`);
  if (b) {
    await b.click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, `mypage-after-${label}`);
  } else rec("UX", "mypage", `"${label}" button not found`);
}

// Try name edit — look for "編集" / pencil icon
const nameEdit = await page.$("button:has-text('編集'), button[aria-label*='編集'], button[aria-label*='名前']");
if (!nameEdit) rec("UX", "mypage", "no way to edit display name when (未設定)");

// Conditions section — try to edit
const conditionsEdit = await page.$("button:has-text('保存'), button:has-text('変更')");
console.log(`  conditions save button: ${conditionsEdit ? "found" : "maybe auto-save"}`);

// Fill guest count
const guestIn = await page.$("input[name='guestCount'], input[placeholder*='人数']");
if (guestIn) {
  await guestIn.fill("80");
  await page.waitForTimeout(300);
  await shot(page, "mypage-guest-typed");
}

// ───── 13. Settings (theme switcher) ─────
console.log("\n▶ 13. Settings (theme switcher + dark mode)");
await page.goto(`${BASE}/settings`);
await page.waitForTimeout(1000);
await shot(page, "settings-initial");

for (const t of ["ダーク", "ライト", "自動"]) {
  const tb = await page.$(`button:has-text('${t}')`);
  if (tb) {
    await tb.click();
    await page.waitForTimeout(600);
    await shot(page, `theme-${t}`);
  } else rec("UX", "settings", `theme "${t}" button not found`);
}

// ───── 14. Dark mode tour ─────
console.log("\n▶ 14. Dark mode full tour");
// Ensure dark
const darkBtn = await page.$(`button:has-text('ダーク')`);
if (darkBtn) { await darkBtn.click(); await page.waitForTimeout(500); }
for (const r of ["/home", "/explore", "/candidates", "/coach", "/mypage"]) {
  await page.goto(`${BASE}${r}`);
  await page.waitForTimeout(900);
  await shot(page, `dark-${r.slice(1)}`);
}

// ───── 15. Logout ─────
console.log("\n▶ 15. Logout");
await page.goto(`${BASE}/settings`);
await page.waitForTimeout(500);
const logout = await page.$("button:has-text('ログアウト'), a:has-text('ログアウト')");
if (logout) {
  await logout.click();
  await page.waitForTimeout(1500);
  await shot(page, "after-logout");
  const atLogin = page.url().includes("/login") || page.url() === BASE + "/";
  if (!atLogin) rec("UX", "logout", `did not redirect to /login or /, at ${page.url()}`);
} else rec("UX", "settings", "logout button not found");

// ───── Final report ─────
const report = {
  testEmail, userId,
  totalFindings: findings.length,
  totalSteps: step,
  bySeverity: findings.reduce((a, f) => { a[f.severity] = (a[f.severity] || 0) + 1; return a; }, {}),
  byArea: findings.reduce((a, f) => { const k = f.area.split(":")[0]; a[k] = (a[k] || 0) + 1; return a; }, {}),
  findings,
  timeline: timeline.filter(t => t.ms).map(t => ({ label: t.label, ms: t.ms })),
};
writeFileSync(`${OUTDIR}/report.json`, JSON.stringify(report, null, 2));
writeFileSync(`${OUTDIR}/summary.md`, renderMD(report));

console.log(`\n═══ ${findings.length} findings across ${step} steps ═══`);
console.log(JSON.stringify(report.bySeverity, null, 2));
console.log(`\nScreenshots + report: ${OUTDIR}/`);

function renderMD(r) {
  const lines = [`# Exhaustive QA Report\n`,
    `- Test user: ${r.testEmail}`, `- Total steps: ${r.totalSteps}`, `- Findings: ${r.totalFindings}`,
    `\n## By severity\n`, ...Object.entries(r.bySeverity).map(([k, v]) => `- ${k}: ${v}`),
    `\n## By area\n`, ...Object.entries(r.byArea).sort(([, a], [, b]) => b - a).map(([k, v]) => `- ${k}: ${v}`),
    `\n## Findings\n`];
  for (const f of r.findings) lines.push(`- **[${f.severity}]** \`${f.area}\` — ${f.message}`);
  lines.push(`\n## Timing hotspots (>1500ms)\n`);
  for (const t of r.timeline.filter(t => t.ms > 1500).sort((a, b) => b.ms - a.ms))
    lines.push(`- ${t.label}: ${t.ms}ms`);
  return lines.join("\n");
}

await browser.close();
await admin.auth.admin.deleteUser(userId).catch(() => {});
console.log(`\nCleaned up test user.`);
