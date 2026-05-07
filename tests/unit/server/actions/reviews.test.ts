import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  estimateIncreaseSchema,
  parseEstimateIncrease,
  aggregateEstimateIncrease,
} from "@/server/actions/review-schema";

// --- Mocks for the server-action integration test below ------------------
// The server action touches Supabase auth, Prisma, and Next.js cache. We
// mock all three so we can verify the control-flow (review lookup → update →
// recompute aggregate → revalidate) without a real DB.
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockVenueFindFirst = vi.fn();
const mockVenueUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    review: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    venue: {
      findFirst: (...args: unknown[]) => mockVenueFindFirst(...args),
      update: (...args: unknown[]) => mockVenueUpdate(...args),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({
    projectId: "proj-1",
    role: "owner",
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
}));

// Avoid the real Claude SDK being imported; only the Result-shape / timeout
// path matters for this test.
vi.mock("@/lib/anthropic", () => ({
  isClaudeAvailable: vi.fn(() => true),
  askClaude: vi.fn(async () => "{}"),
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  computeInputHash: vi.fn(() => "hash"),
  stripPII: vi.fn((s: string) => s),
}));

vi.mock("@/lib/url-guard", () => ({
  guardExternalUrl: vi.fn((u: string) => ({
    ok: true,
    url: new URL(u),
  })),
}));

describe("estimateIncreaseSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = estimateIncreaseSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts an all-undefined payload", () => {
    const result = estimateIncreaseSchema.safeParse({
      initial: undefined,
      final: undefined,
      deltaYen: undefined,
      deltaPct: undefined,
      confidence: undefined,
      note: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a partial (mixed) payload", () => {
    const result = estimateIncreaseSchema.safeParse({
      deltaYen: 800000,
      confidence: "high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid confidence value", () => {
    const result = estimateIncreaseSchema.safeParse({ confidence: "unsure" });
    expect(result.success).toBe(false);
  });

  it("rejects non-number deltaYen", () => {
    const result = estimateIncreaseSchema.safeParse({ deltaYen: "800000" });
    expect(result.success).toBe(false);
  });
});

describe("parseEstimateIncrease", () => {
  it("returns null for fully-empty payload (no fields set)", () => {
    expect(parseEstimateIncrease({})).toBeNull();
  });

  it("returns null for null/non-object input", () => {
    expect(parseEstimateIncrease(null)).toBeNull();
    expect(parseEstimateIncrease("foo")).toBeNull();
  });

  it("returns parsed object when at least one field is present", () => {
    const parsed = parseEstimateIncrease({ deltaYen: 500000 });
    expect(parsed).toEqual({ deltaYen: 500000 });
  });
});

describe("aggregateEstimateIncrease", () => {
  it("averages deltaYen + deltaPct across 3 reviews", () => {
    const result = aggregateEstimateIncrease([
      { deltaYen: 600000, deltaPct: 20 },
      { deltaYen: 900000, deltaPct: 30 },
      { deltaYen: 1200000, deltaPct: 40 },
    ]);
    expect(result.sampleCount).toBe(3);
    expect(result.deltaYen).toBe(900000);
    expect(result.deltaPct).toBe(30);
  });

  it("skips reviews without deltaYen when averaging yen", () => {
    const result = aggregateEstimateIncrease([
      { deltaYen: 800000 },
      { deltaPct: 25 },
      { deltaYen: 400000, deltaPct: 15 },
    ]);
    expect(result.sampleCount).toBe(3);
    expect(result.deltaYen).toBe(600000); // (800000 + 400000) / 2
    expect(result.deltaPct).toBe(20); // (25 + 15) / 2
  });

  it("returns null averages and zero count when no reviews have data", () => {
    const result = aggregateEstimateIncrease([null, undefined]);
    expect(result).toEqual({ deltaYen: null, deltaPct: null, sampleCount: 0 });
  });

  it("rounds pct to 2 decimals", () => {
    const result = aggregateEstimateIncrease([
      { deltaPct: 10 },
      { deltaPct: 15 },
      { deltaPct: 17 },
    ]);
    expect(result.deltaPct).toBe(14); // (10+15+17)/3 = 14
  });
});

describe("updateReviewEstimateIncrease (integration with mocked prisma)", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
    mockFindMany.mockReset();
    mockVenueUpdate.mockReset();
    mockRevalidatePath.mockReset();
  });

  it("persists manual entry, recomputes venue aggregate, and revalidates", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "rev-1", venueId: "venue-1" });
    mockUpdate.mockResolvedValueOnce({ id: "rev-1" });
    // recompute pulls reviews for the venue; return two payloads so the
    // aggregate includes the one we just wrote plus a sibling.
    mockFindMany.mockResolvedValueOnce([
      { estimateIncrease: { deltaYen: 800000, deltaPct: 25 } },
      { estimateIncrease: { deltaYen: 400000, deltaPct: 15 } },
    ]);
    mockVenueUpdate.mockResolvedValueOnce({ id: "venue-1" });

    const { updateReviewEstimateIncrease } = await import(
      "@/server/actions/reviews"
    );

    const result = await updateReviewEstimateIncrease("rev-1", {
      initial: 3_000_000,
      final: 3_800_000,
      deltaYen: 800_000,
      deltaPct: 26.67,
      note: "衣裳アップ",
    });

    expect(result.success).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    // Recompute must be called: exactly one findMany + one venue.update.
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockVenueUpdate).toHaveBeenCalledTimes(1);
    // Venue aggregate should reflect the two mocked reviews.
    const venueUpdateArgs = mockVenueUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: {
        reviewEstimateDeltaYen: number | null;
        reviewEstimateSampleCount: number | null;
      };
    };
    expect(venueUpdateArgs.where.id).toBe("venue-1");
    expect(venueUpdateArgs.data.reviewEstimateDeltaYen).toBe(600_000);
    expect(venueUpdateArgs.data.reviewEstimateSampleCount).toBe(2);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/venues/venue-1");
  });

  it("returns error without mutating when the review is not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const { updateReviewEstimateIncrease } = await import(
      "@/server/actions/reviews"
    );
    const result = await updateReviewEstimateIncrease("missing", {
      deltaYen: 500_000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockVenueUpdate).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

// --- Result-shape contract for analyzeVenueReviews -----------------------
// These tests pin down the new `{ok} | {ok:false, reason}` discriminated
// union: callers (venues.confirmVenueFromUrl, ReviewSection) must be able
// to branch on `reason`. No `{success, error}` shape must leak out.
describe("analyzeVenueReviews (Result shape + timeout guard)", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockCount.mockReset();
    mockVenueFindFirst.mockReset();
    mockVenueUpdate.mockReset();
    mockRevalidatePath.mockReset();
  });

  it("does NOT short-circuit when summary + individuals exist (always re-runs to refresh)", async () => {
    // PRIOR design: returned {ok:true} immediately when both summary
    // and individual review rows existed.
    // CURRENT design: re-runs analyze unconditionally so the user can
    // refresh extraction (new prompt version, more pages, updated
    // sentiment). The test asserts the function did NOT take the
    // short-circuit (would have returned {ok:true} without venue
    // lookup); instead it proceeds and lands on api-error because
    // we didn't mock the downstream Anthropic call.
    mockVenueFindFirst.mockResolvedValueOnce({ id: "venue-1", name: "V" });
    mockFindFirst.mockResolvedValueOnce({ aiSummary: "already summarised" });
    mockCount.mockResolvedValueOnce(5);

    const { analyzeVenueReviews } = await import("@/server/actions/reviews");
    const result = await analyzeVenueReviews(
      "venue-1",
      "https://zexy.net/foo",
      "zexy",
    );
    // Did NOT short-circuit (would have been {ok:true}). Proceeded to
    // the full pipeline and ended in api-error (no mock for fetch).
    expect(result.ok).toBe(false);
  });

  it("returns {ok:false, reason:'api-error'} when venue is not found", async () => {
    mockVenueFindFirst.mockResolvedValueOnce(null);
    const { analyzeVenueReviews } = await import("@/server/actions/reviews");
    const result = await analyzeVenueReviews(
      "missing",
      "https://zexy.net/foo",
      "zexy",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("api-error");
    }
  });

  it("returns {ok:false, reason:'timeout'} when the 110s budget elapses", async () => {
    vi.useFakeTimers();
    try {
      // Never resolves — forces the Promise.race to take the timer branch.
      mockVenueFindFirst.mockReturnValueOnce(new Promise(() => {}));

      const { analyzeVenueReviews } = await import("@/server/actions/reviews");
      const pending = analyzeVenueReviews(
        "venue-1",
        "https://zexy.net/foo",
        "zexy",
      );
      // Outer race grew 90s → 110s once analyzeVenueReviewsInner
      // gained the multi-page crawl; advance past the new ceiling.
      await vi.advanceTimersByTimeAsync(110_000);
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("timeout");
        // Source-named message lets the user see which site is slow
        // ("ゼクシィが時間内に応答しませんでした…").
        expect(result.message).toContain("ゼクシィ");
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
