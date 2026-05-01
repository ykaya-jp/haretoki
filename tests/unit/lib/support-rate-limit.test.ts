import { describe, it, expect, beforeEach } from "vitest";
import {
  checkSupportRateLimit,
  _resetSupportRateBuckets,
} from "@/lib/support/rate-limit";

describe("checkSupportRateLimit", () => {
  beforeEach(() => {
    _resetSupportRateBuckets();
  });

  it("allows the first message", () => {
    expect(checkSupportRateLimit("user-1").ok).toBe(true);
  });

  it("counts up to the per-hour cap and then rejects", () => {
    // Default cap is 5 / hour.
    for (let i = 0; i < 5; i++) {
      expect(checkSupportRateLimit("user-2").ok).toBe(true);
    }
    expect(checkSupportRateLimit("user-2").ok).toBe(false);
  });

  it("isolates buckets per user", () => {
    for (let i = 0; i < 5; i++) {
      checkSupportRateLimit("user-3");
    }
    expect(checkSupportRateLimit("user-3").ok).toBe(false);
    // A different user is unaffected.
    expect(checkSupportRateLimit("user-4").ok).toBe(true);
  });

  it("resets at the next hour boundary", () => {
    // First hour: fill the bucket.
    const t0 = Date.UTC(2026, 4, 2, 12, 30, 0);
    for (let i = 0; i < 5; i++) {
      expect(checkSupportRateLimit("user-5", t0).ok).toBe(true);
    }
    expect(checkSupportRateLimit("user-5", t0).ok).toBe(false);

    // Cross into the next hour — the bucket resets.
    const t1 = Date.UTC(2026, 4, 2, 13, 0, 0);
    expect(checkSupportRateLimit("user-5", t1).ok).toBe(true);
  });
});
