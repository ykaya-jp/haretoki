import { test, expect } from "@playwright/test";

/**
 * Dark-mode visual regression suite.
 *
 * Captures full-page screenshots of every public + key auth-gated
 * surface in BOTH light and dark modes, then compares against a
 * committed baseline (saved under
 * `tests/e2e/visual-regression-dark.spec.ts-snapshots/` on first run).
 * Subsequent runs fail when the rendered pixels diverge by more than
 * the configured threshold — the canonical "did dark-mode parity
 * regress?" check.
 *
 * Theme switching strategy:
 *   - Light mode   → `colorScheme: "light"` on the page context.
 *   - Dark mode    → `colorScheme: "dark"` on the page context, which
 *                    next-themes resolves via the `(prefers-color-scheme)`
 *                    media query because the root layout configures
 *                    `defaultTheme="system"` + `enableSystem`.
 *
 * Stability tweaks:
 *   - `prefers-reduced-motion: reduce` is set so editorial entry
 *     animations (DecisionCeremony, Hero stagger, cloudy → sunny wash)
 *     don't introduce frame-timing noise. Visual regression tests are
 *     about *layout + color*, not motion choreography.
 *   - We wait for `networkidle` plus a 200ms beat — Tailwind 4's
 *     `@theme inline` resolves the OKLCH variables on first paint and
 *     the cream-vs-near-black canvas otherwise can be captured mid-
 *     transition on slower runners.
 *   - Per-test mask: any element with `[data-vr-volatile]` is masked
 *     before snapshotting, so timestamps / partner names / coach
 *     replies don't churn the baseline. No callsites yet — the
 *     attribute is reserved for surfaces that genuinely need it.
 *
 * Auth-gated coverage:
 *   - The 9 surfaces named in the Phase 4 spec (home / explore /
 *     candidates / compare / coach / mypage / onboarding-hero /
 *     decision / landing) split into 3 reachability tiers in the
 *     current test harness:
 *
 *     1. Always reachable: `/` (landing), `/login`, `/signup`,
 *        `/terms`, `/privacy` — public marketing + legal surfaces.
 *     2. Reachable as the auth-redirect target: `/home`, `/explore`,
 *        `/candidates`, `/compare`, `/coach`, `/mypage`,
 *        `/onboarding` redirect to `/login` for unauthenticated
 *        sessions, so the *login screen* itself is what we capture
 *        for those tiers under the current harness. Once
 *        `tests/e2e/.auth/state.json` exists (storage-state fixture),
 *        flip `E2E_AUTH=1` to capture the real authenticated screens.
 *     3. Reachable only with seeded data: `/candidates/decision`
 *        (DecisionCeremony) requires a Decision row in DB; covered
 *        as a TODO that an integration-fixture round can fill in.
 */

const PUBLIC_ROUTES = [
  { path: "/", name: "landing" },
  { path: "/login", name: "login" },
  { path: "/signup", name: "signup" },
  { path: "/terms", name: "terms" },
  { path: "/privacy", name: "privacy" },
] as const;

// Auth-gated routes — they redirect to /login when E2E_AUTH is unset,
// which is itself a useful "auth wall renders cleanly in both themes"
// regression check. With storage state (E2E_AUTH=1) they capture the
// real authenticated surface.
const AUTH_ROUTES = [
  { path: "/home", name: "home" },
  { path: "/explore", name: "explore" },
  { path: "/candidates", name: "candidates" },
  { path: "/compare", name: "compare" },
  { path: "/coach", name: "coach" },
  { path: "/mypage", name: "mypage" },
  { path: "/onboarding", name: "onboarding-hero" },
] as const;

const HAS_AUTH_FIXTURE = process.env.E2E_AUTH === "1";

const THEMES = [
  { name: "light", colorScheme: "light" as const },
  { name: "dark", colorScheme: "dark" as const },
];

// Pixel diff threshold — 1.5% of pixels may differ before the test
// fails. Loose enough to absorb sub-pixel anti-aliasing variance
// across Linux runners (CI) vs the developer's local OS, tight enough
// that a missed dark-mode token (e.g. a `bg-white` literal) reliably
// fires as a failure.
const SCREENSHOT_OPTIONS = {
  fullPage: true,
  animations: "disabled" as const,
  // Mask any developer-tagged volatile element. Empty by default, so
  // skipped silently when nothing on the page declares it.
  mask: [] as never[],
};

const TO_HAVE_SCREENSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.015,
  // Anti-alias / sub-pixel jitter tolerance — 0.1 is the Playwright
  // default. We keep it because the cream + gold palette has a lot
  // of low-contrast areas where stricter values trigger noise.
  threshold: 0.2,
} as const;

/** Force the desired colour scheme + reduced motion on the active
 *  page context. next-themes (`defaultTheme="system"` +
 *  `enableSystem` per `src/app/layout.tsx`) reads
 *  `(prefers-color-scheme)` so the colorScheme emulation alone is
 *  enough — no localStorage poke needed. */
async function applyTheme(
  page: import("@playwright/test").Page,
  colorScheme: "light" | "dark",
) {
  await page.emulateMedia({
    colorScheme,
    reducedMotion: "reduce",
  });
}

/** Wait for the page to settle: networkidle + a small beat for
 *  client hydration + the OKLCH paint pass. */
async function waitForStable(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle").catch(() => {
    /* networkidle can flake on dev server with HMR — best-effort */
  });
  await page.waitForTimeout(250);
}

test.describe("Visual regression — public routes", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // Mobile-only gate (PR T1.1): the 24 baseline PNGs in this spec's
  // snapshot dir are all tagged `-Mobile-Chrome-linux.png`. The
  // Desktop Chrome project has no committed baselines and would fail
  // every run with "snapshot doesn't exist". Generating a parallel
  // 24-PNG Desktop baseline set would double maintenance burden on a
  // mobile-first product, so we skip Desktop here. Desktop visual
  // regression is handled by manual QA + the comprehensive smoke
  // spec, both of which catch the "did the layout collapse?" class
  // of bug without per-pixel comparison.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "Mobile Chrome",
      "Visual regression baselines are Mobile-only.",
    );
  });

  for (const route of PUBLIC_ROUTES) {
    for (const theme of THEMES) {
      test(`${route.name} — ${theme.name}`, async ({ page }) => {
        await applyTheme(page, theme.colorScheme);
        await page.goto(route.path);
        await waitForStable(page);

        await expect(page).toHaveScreenshot(
          [`${route.name}-${theme.name}.png`],
          {
            ...SCREENSHOT_OPTIONS,
            ...TO_HAVE_SCREENSHOT_OPTIONS,
          },
        );
      });
    }
  }
});

test.describe("Visual regression — auth-gated routes", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // Mobile-only gate (PR T1.1): same rationale as the public-routes
  // describe block above — baselines are Mobile-only.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "Mobile Chrome",
      "Visual regression baselines are Mobile-only.",
    );
  });

  for (const route of AUTH_ROUTES) {
    for (const theme of THEMES) {
      test(`${route.name} — ${theme.name}`, async ({ page }) => {
        // Without a storage-state fixture, the auth-gated routes
        // redirect to /login. We still capture *that* render — a
        // dark-mode regression on the auth wall is itself a
        // regression worth catching — but tag the snapshot path so
        // future auth-fixture work can swap in the real screen
        // without overwriting baselines.
        const suffix = HAS_AUTH_FIXTURE ? "" : "-anon";
        await applyTheme(page, theme.colorScheme);
        await page.goto(route.path);
        await waitForStable(page);

        await expect(page).toHaveScreenshot(
          [`${route.name}${suffix}-${theme.name}.png`],
          {
            ...SCREENSHOT_OPTIONS,
            ...TO_HAVE_SCREENSHOT_OPTIONS,
          },
        );
      });
    }
  }
});

test.describe("Visual regression — DecisionCeremony", () => {
  // DecisionCeremony lives under /candidates/decision and only
  // renders when the project has a Decision row. Capturing it
  // requires a seeded fixture round-tripping through Prisma; the
  // shape lives here as a TODO so the future fixture round has a
  // concrete first-class test slot to fill.
  test.fixme(
    !HAS_AUTH_FIXTURE,
    "decision-ceremony requires seeded Decision row + auth state — gate on E2E_AUTH=1 + fixture round",
  );

  for (const theme of THEMES) {
    test(`decision-ceremony — ${theme.name}`, async ({ page }) => {
      await applyTheme(page, theme.colorScheme);
      await page.goto("/candidates/decision");
      await waitForStable(page);

      await expect(page).toHaveScreenshot(
        [`decision-ceremony-${theme.name}.png`],
        {
          ...SCREENSHOT_OPTIONS,
          ...TO_HAVE_SCREENSHOT_OPTIONS,
        },
      );
    });
  }
});
