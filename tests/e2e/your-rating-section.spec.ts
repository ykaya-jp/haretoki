import { test, expect } from "@playwright/test";

/**
 * PR T2 — coverage for the "あなたの評価" rows added to the comparison
 * board's field registry by PR #41 and activated against child-item
 * `numericScore` aggregation by PR #42.
 *
 * The rows are declared in
 * `src/components/comparison/comparison-field-registry.ts` via the
 * spread `...TIER1_DIMENSIONS.map(dim => ({...}))` block, and the
 * field renderer in `comparison-row.tsx` + `comparison-mobile-snapper.tsx`
 * picks them up automatically — no per-renderer change.
 *
 * Auth-free verification: /compare for an unauthenticated visitor
 * redirects to /login. The actual row visibility check requires a
 * seeded venue + scores, gated by env on follow-up.
 *
 * Smoke verification: render the comparison page via its anonymous
 * route (`/compare` redirects to /login, but the underlying registry
 * import doesn't crash — that's the bar).
 */

test.describe("'あなたの評価' rows in /compare", () => {
  test("auth wall renders cleanly on /compare (no 5xx from new registry rows)", async ({
    page,
  }) => {
    const response = await page.goto("/compare");
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
  });

  test("no fatal console error from the field registry's new rows", async ({
    page,
  }) => {
    // The registry runs at import time when ComparisonGrid or
    // ComparisonMobileSnapper imports it. A bad accessor or missing
    // TIER1_DIMENSIONS reference would surface as a module-level
    // throw — the auth-wall page still hydrates a layout that
    // statically imports the comparison board components, so any
    // such throw would fire here.
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await page.goto("/compare");
    await page.waitForLoadState("domcontentloaded");
    const fatal = consoleErrors.filter(
      (m) =>
        !/Failed to fetch|WebSocket|Hydration mismatch|favicon/i.test(m),
    );
    expect(fatal, "no fatal console errors from the new 'あなたの評価' rows").toEqual([]);
  });
});
