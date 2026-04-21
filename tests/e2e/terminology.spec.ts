import { test, expect } from "@playwright/test";

/**
 * Terminology unification smoke — guards the W7-1 (f29d1ab) copy changes
 * that renamed UI labels to align with the domain glossary:
 *
 *   旧 → 新
 *   本命     → (廃止 — 用途に応じて "候補" / "検討中" / "決定" に分散)
 *   印象メモ → (廃止 — 見学記録に統合)
 *   調査中   → 気になる  (status: researching)
 *   shortlisted label → 検討中
 *
 * These tests hit unauthenticated routes only. Authenticated screens are
 * excluded — we only assert that the obsolete terms do NOT appear in the
 * public shell to prevent accidental regression.
 */
test.describe("Terminology unification", () => {
  test("/ (root) does not contain obsolete term 本命", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/");
    expect(response?.status() ?? 0).toBeLessThan(500);

    await expect(page.getByText("本命", { exact: true })).not.toBeVisible();
  });

  test("/ (root) does not contain obsolete term 印象メモ", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await expect(page.getByText("印象メモ", { exact: true })).not.toBeVisible();
  });

  test("/ (root) does not contain obsolete term 調査中", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    // "調査中" was the old label for status=researching. New label is "気になる".
    await expect(page.getByText("調査中", { exact: true })).not.toBeVisible();
  });

  test("/candidates does not contain obsolete term 本命", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/candidates");
    expect(response?.status() ?? 0).toBeLessThan(500);

    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
    await expect(page.getByText("本命", { exact: true })).not.toBeVisible();
  });

  test("/candidates does not contain obsolete term 印象メモ", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/candidates");

    await expect(page.getByText("印象メモ", { exact: true })).not.toBeVisible();
  });

  test("/explore does not contain obsolete term 調査中", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/explore");
    expect(response?.status() ?? 0).toBeLessThan(500);

    // Filter chip label must be "気になる", not "調査中"
    await expect(page.getByText("調査中", { exact: true })).not.toBeVisible();
  });
});
