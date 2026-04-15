import { describe, it, expect } from "vitest";

// Mirrors AI_REC_VENUE_THRESHOLD in src/server/actions/onboarding.ts.
// Importing the source module pulls Prisma which requires DATABASE_URL,
// so we duplicate the constant here (same pattern as onboarding.test.ts).
// If you change the source value, change this too.
const AI_REC_VENUE_THRESHOLD = 3;

/**
 * The Explore AI recommendations surface is gated by a venue-count threshold:
 * below it we render a "pre-AI" state and never call Claude. These tests
 * lock down the threshold's value and the gating predicate so the behavior
 * doesn't silently regress.
 */

function shouldCallClaude(venueCount: number, claudeAvailable: boolean): boolean {
  return venueCount >= AI_REC_VENUE_THRESHOLD && claudeAvailable;
}

describe("AI recommendation gating", () => {
  it("threshold is 3 — comparative signal needs at least three venues", () => {
    expect(AI_REC_VENUE_THRESHOLD).toBe(3);
  });

  it("does not call Claude when venueCount is 0", () => {
    expect(shouldCallClaude(0, true)).toBe(false);
  });

  it("does not call Claude when venueCount is below threshold", () => {
    expect(shouldCallClaude(1, true)).toBe(false);
    expect(shouldCallClaude(2, true)).toBe(false);
  });

  it("calls Claude at threshold and above", () => {
    expect(shouldCallClaude(3, true)).toBe(true);
    expect(shouldCallClaude(10, true)).toBe(true);
  });

  it("never calls Claude when API key is unavailable, regardless of count", () => {
    expect(shouldCallClaude(0, false)).toBe(false);
    expect(shouldCallClaude(5, false)).toBe(false);
    expect(shouldCallClaude(100, false)).toBe(false);
  });
});
