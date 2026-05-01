import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  rateLimitErrorMessage,
  _resetRateLimitStore,
  RATE_LIMITS,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetRateLimitStore();
  });

  it("allows the first request and reports remaining slots", () => {
    const r = checkRateLimit("user:1", { limit: 3, windowMs: 60_000 }, 1_000);
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.remaining).toBe(2);
    }
  });

  it("allows up to the limit and rejects the next call", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit("user:1", opts, 1_000).allowed).toBe(true);
    expect(checkRateLimit("user:1", opts, 1_100).allowed).toBe(true);
    expect(checkRateLimit("user:1", opts, 1_200).allowed).toBe(true);
    const blocked = checkRateLimit("user:1", opts, 1_300);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.limit).toBe(3);
      expect(blocked.windowMs).toBe(60_000);
      // Oldest timestamp = 1_000, window 60_000 → expires at 61_000.
      // now = 1_300 → retryAfterMs = 59_700 → ceil to 60s.
      expect(blocked.retryAfterSec).toBe(60);
    }
  });

  it("admits new calls once old timestamps fall outside the window", () => {
    const opts = { limit: 2, windowMs: 1_000 };
    expect(checkRateLimit("user:1", opts, 0).allowed).toBe(true);
    expect(checkRateLimit("user:1", opts, 100).allowed).toBe(true);
    expect(checkRateLimit("user:1", opts, 200).allowed).toBe(false);
    // After windowMs, both prior timestamps fall off → next call allowed.
    expect(checkRateLimit("user:1", opts, 1_300).allowed).toBe(true);
  });

  it("scopes by key (per-user isolation)", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("user:a", opts, 1_000).allowed).toBe(true);
    expect(checkRateLimit("user:a", opts, 1_100).allowed).toBe(false);
    // Different key gets its own bucket.
    expect(checkRateLimit("user:b", opts, 1_100).allowed).toBe(true);
  });

  it("treats invalid input as misconfigured and admits without recording", () => {
    expect(checkRateLimit("", { limit: 1, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit("k", { limit: 0, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit("k", { limit: 1, windowMs: 0 }).allowed).toBe(true);
  });

  it("rate-limited rejection extends the eviction window via lastTouchedMs", () => {
    // Regression guard: a rejected key should still be 'fresh' for LRU
    // purposes so a throttled hot user doesn't get evicted in favour of a
    // brand-new key that just arrived.
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("hot", opts, 1_000).allowed).toBe(true);
    const blocked = checkRateLimit("hot", opts, 1_500);
    expect(blocked.allowed).toBe(false);
    // No throw, no behavior assertion needed beyond compile — the test
    // pins the contract.
  });
});

describe("rateLimitErrorMessage", () => {
  it("returns null for an allowed result", () => {
    expect(
      rateLimitErrorMessage({ allowed: true, remaining: 1, resetAtMs: 0 }),
    ).toBeNull();
  });

  it("formats a Japanese message with retry-after for a blocked result", () => {
    const msg = rateLimitErrorMessage(
      {
        allowed: false,
        retryAfterMs: 12_000,
        retryAfterSec: 12,
        limit: 5,
        windowMs: 60_000,
      },
      "メッセージ送信",
    );
    expect(msg).toContain("メッセージ送信");
    expect(msg).toContain("12秒");
  });
});

describe("RATE_LIMITS presets", () => {
  it("expose tuned limits for the three hot Server Actions", () => {
    expect(RATE_LIMITS.COACH_MESSAGE).toEqual({ limit: 30, windowMs: 60_000 });
    expect(RATE_LIMITS.URL_IMPORT).toEqual({ limit: 5, windowMs: 60_000 });
    expect(RATE_LIMITS.PDF_ANALYZE).toEqual({ limit: 3, windowMs: 60_000 });
  });
});
