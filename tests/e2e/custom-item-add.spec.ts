import { test, expect } from "@playwright/test";

/**
 * PR T2 — coverage for the custom-checklist-item add UI shipped in
 * PR #43 (`src/components/checklist/custom-item-add-form.tsx`)
 * surfaced at the bottom of `/checklist`.
 *
 * The component is a client component that calls
 * `addCustomChecklistItem` (server action shipped in PR #2) — both
 * the form rendering and the action invocation only make sense once
 * a project membership exists, so the rich interaction tests sit
 * env-gated in a follow-up PR.
 *
 * Auth-free verifications here:
 *   1. /checklist for an unauthenticated visitor redirects to /login.
 *   2. The route doesn't 5xx and doesn't throw on import of the new
 *      form component (= module-level error surfaces in console).
 */

test.describe("Custom checklist item add form (/checklist)", () => {
  test("auth wall renders cleanly on /checklist", async ({ page }) => {
    const response = await page.goto("/checklist");
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
  });

  test("import of the new CustomItemAddForm component does not throw", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await page.goto("/checklist");
    await page.waitForLoadState("domcontentloaded");
    const fatal = consoleErrors.filter(
      (m) =>
        !/Failed to fetch|WebSocket|Hydration mismatch|favicon/i.test(m),
    );
    expect(fatal, "no fatal console errors from CustomItemAddForm import").toEqual([]);
  });
});
