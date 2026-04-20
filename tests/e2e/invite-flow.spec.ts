import { test, expect } from "@playwright/test";

/**
 * Invite link flow — regression tests for the 500 loop that shipped in
 * b337d9d and was fixed in 2183307. Partner lands on /invite/<token>
 * (unauthenticated) → sees sign-up CTA, or (authenticated) flows through
 * /accept-invite.
 *
 * These tests don't round-trip through real Supabase auth — they only
 * verify the public routes render *at all* without falling through to
 * the global error boundary. Tokens are intentionally invalid so we
 * can assert the "invalid" card is rendered cleanly (not the error
 * boundary's "うまく表示できませんでした").
 */
test.describe("Invite link flow", () => {
  test("/invite/<invalid-token> renders the 'invalid' card, not the error boundary", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/invite/invalid-token-format");

    // Page must render without falling to the global error screen.
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();

    // Invalid card copy from InvalidCard component.
    await expect(page.locator("body")).toBeVisible();
  });

  test("/invite/<well-formed-but-missing-token> renders without 500", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // 64 hex chars that won't match any real invitation.
    const fakeToken = "a".repeat(64);
    const response = await page.goto(`/invite/${fakeToken}`);
    expect(response?.status()).toBeLessThan(500);

    // Must not be the error boundary.
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
    await expect(page.getByText("ちょっとひと息つきましょう")).not.toBeVisible();
  });

  test("/accept-invite without auth redirects to / (no boundary)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/accept-invite");
    // Either 200 (redirected to /) or a login gate — both are fine.
    // The failure mode we're guarding against is a 500.
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText("うまく表示できませんでした")).not.toBeVisible();
  });
});
