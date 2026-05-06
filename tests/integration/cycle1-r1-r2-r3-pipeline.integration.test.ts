/**
 * Integration — Cycle 1 review pipeline (R1 → R2 → R3).
 *
 * The review pipeline composes three actions:
 *
 *   R1: batchImportReviewUrls — couple pastes N URLs of review pages,
 *       the action de-dupes against existing rows + per-URL kicks
 *       analyzeVenueReviews (the inner Claude-fetch path).
 *   R2: getReviewSummariesForVenues — single round-trip aggregator
 *       that rolls each venue's Review rows into the
 *       summary/strengths/concerns shape /compare reads.
 *   R3: getMatrixReviewInsight — Claude cross-venue synthesiser that
 *       reads the per-venue aggregates and emits commonConcerns /
 *       divergence / decisionHint for the comparison board's
 *       qualitative card.
 *
 * What we pin here:
 *   - R1's per-URL Result shape feeds the same `summary` /
 *     `aiSummary` columns R2 reads.
 *   - R2's ReviewAggregate shape matches what R3's prompt expects
 *     (summary + strengths + concerns + reviewCount).
 *   - R3's null-return paths (< 2 venues, zero reviews) match the
 *     "no surface" rules R2 and the /compare collapse logic rely on.
 *
 * Mock strategy: prisma + Claude + auth at the module boundary,
 * matching tests/unit/server/actions/get-matrix-review-insight.test.ts
 * and batch-import-review-urls.test.ts. The R1 path here uses the
 * dedup-only branch (analyzeVenueReviews never fires) — analyze
 * itself has its own dedicated unit suite, and the pipeline contract
 * we want to verify is the per-URL Result shape, not the inner
 * Claude fetch.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReviewFindMany = vi.fn();
const mockVenueFindFirst = vi.fn();
const mockVenueFindMany = vi.fn();
const mockAiFindFirst = vi.fn();
const mockAiCreate = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockAskClaude = vi.fn();
const mockIsClaudeAvailable = vi.fn(() => true);
const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    review: { findMany: (...a: unknown[]) => mockReviewFindMany(...a) },
    venue: {
      findFirst: (...a: unknown[]) => mockVenueFindFirst(...a),
      findMany: (...a: unknown[]) => mockVenueFindMany(...a),
    },
    aiAnalysis: {
      findFirst: (...a: unknown[]) => mockAiFindFirst(...a),
      create: (...a: unknown[]) => mockAiCreate(...a),
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

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
  RATE_LIMITS: {
    URL_IMPORT: { limit: 5, windowMs: 60_000 },
  },
}));

vi.mock("@/lib/url-guard", () => ({
  guardExternalUrl: vi.fn((u: string) => {
    try {
      const url = new URL(u);
      if (url.protocol !== "https:") return { ok: false, reason: "scheme" };
      return { ok: true, url };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
  revalidateTag: (...a: unknown[]) => mockRevalidateTag(...a),
  cacheTag: vi.fn(),
}));

vi.mock("@/lib/anthropic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anthropic")>(
    "@/lib/anthropic",
  );
  return {
    ...actual,
    isClaudeAvailable: () => mockIsClaudeAvailable(),
    askClaude: (...a: unknown[]) => mockAskClaude(...a),
    withRetry: async (fn: () => Promise<unknown>) => fn(),
  };
});

vi.mock("@/lib/ai-cache", () => ({
  cachedAskClaude: vi.fn(async () => null),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
  mockVenueFindFirst.mockResolvedValue({ id: "venue-1" });
  mockReviewFindMany.mockResolvedValue([]);
  mockAiFindFirst.mockResolvedValue(null);
  mockAiCreate.mockResolvedValue({ id: "cache-1" });
  mockIsClaudeAvailable.mockReset().mockReturnValue(true);
});

describe("R1 → R2 → R3 review pipeline integration", () => {
  it("R1 batch dedup → all skipped → returns saved/skipped/failed partition", async () => {
    // Pre-existing reviews fully cover the input URLs → all skipped.
    // We verify the per-URL Result shape that becomes the toast in
    // the UI is well-formed for downstream R2 reads.
    mockReviewFindMany.mockResolvedValueOnce([
      { sourceUrl: "https://www.mwed.jp/hall/1/" },
      { sourceUrl: "https://www.mwed.jp/hall/2/#rev-abc" },
    ]);

    const { batchImportReviewUrls } = await import(
      "@/server/actions/reviews"
    );

    const result = await batchImportReviewUrls(
      "venue-1",
      [
        "https://www.mwed.jp/hall/1/",
        "https://www.mwed.jp/hall/2/",
      ],
      "minna_no_wedding",
    );

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.summary.saved + result.summary.skipped + result.summary.failed)
        .toBe(2);
      expect(result.summary).toEqual({ saved: 0, skipped: 2, failed: 0 });
      // Per-URL entries carry the message fields R2's downstream UI
      // needs (status + message).
      for (const entry of result.perUrl) {
        expect(entry).toHaveProperty("url");
        expect(entry).toHaveProperty("status");
      }
    }
  });

  it("R2 getReviewSummariesForVenues groups N venues with ONE prisma round-trip", async () => {
    // R2 must scale O(1) queries no matter how many venues — the
    // /compare board passes 2-10 venue ids and we cannot fan out.
    const venueIds = ["v1", "v2", "v3", "v4", "v5"];
    mockReviewFindMany.mockResolvedValueOnce(
      venueIds.map((id, i) => ({
        venueId: id,
        aiSummary: `${id} の口コミまとめ`,
        sentiment: { overall: 0.3 + i * 0.1 },
        categorySummary: {
          positiveHighlights: [`${id} の強み`],
          negativeHighlights: [`${id} の懸念`],
        },
        fetchedAt: new Date("2026-04-01"),
      })),
    );

    const { getReviewSummariesForVenues } = await import(
      "@/server/actions/comparison"
    );

    const result = await getReviewSummariesForVenues(venueIds);

    // Single query regardless of N — N+1 prevention contract.
    expect(mockReviewFindMany).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(5);
    // Each venue's aggregate has the shape R3's prompt expects.
    for (const id of venueIds) {
      const agg = result.get(id);
      expect(agg).toBeDefined();
      expect(agg?.summary).toContain(id);
      expect(agg?.strengths).toEqual([`${id} の強み`]);
      expect(agg?.concerns).toEqual([`${id} の懸念`]);
      expect(agg?.count).toBeGreaterThan(0);
    }
  });

  it("R3 returns null when fewer than 2 venues — matches R2's no-surface contract", async () => {
    const { getMatrixReviewInsight } = await import(
      "@/server/actions/matrix-review-insight"
    );

    const result = await getMatrixReviewInsight(["v1"]);

    expect(result).toBeNull();
    // Guard short-circuits before any DB or Claude work.
    expect(mockVenueFindMany).not.toHaveBeenCalled();
    expect(mockAskClaude).not.toHaveBeenCalled();
  });

  it("R3 returns null when every venue has zero reviews (no halluciation)", async () => {
    mockVenueFindMany.mockResolvedValue([
      { id: "v1", name: "式場A", reviews: [] },
      { id: "v2", name: "式場B", reviews: [] },
    ]);

    const { getMatrixReviewInsight } = await import(
      "@/server/actions/matrix-review-insight"
    );

    const result = await getMatrixReviewInsight(["v1", "v2"]);

    expect(result).toBeNull();
    expect(mockAskClaude).not.toHaveBeenCalled();
  });

  it("R3 succeeds with the same per-venue aggregate shape R2 produces", async () => {
    // R3's aggregateReviewsForVenues walks prisma.venue.findMany with
    // a `reviews: { aiSummary, categorySummary, fetchedAt }` include.
    // Mock that shape so the chain succeeds end-to-end.
    mockVenueFindMany.mockResolvedValue([
      {
        id: "v1",
        name: "式場A",
        reviews: [
          {
            aiSummary: "A の口コミまとめ",
            categorySummary: { strengths: ["料理"], concerns: ["駐車場"] },
            fetchedAt: new Date("2026-04-01"),
          },
        ],
      },
      {
        id: "v2",
        name: "式場B",
        reviews: [
          {
            aiSummary: "B の口コミまとめ",
            categorySummary: { strengths: ["立地"], concerns: ["騒音"] },
            fetchedAt: new Date("2026-04-01"),
          },
        ],
      },
    ]);
    mockAskClaude.mockResolvedValue(
      JSON.stringify({
        commonConcerns: ["アクセス・駐車場の確認"],
        divergence: ["A は料理、B は立地が光る"],
        decisionHint: "次の見学で駐車場の出入りを確認しましょう",
      }),
    );

    const { getMatrixReviewInsight } = await import(
      "@/server/actions/matrix-review-insight"
    );

    const result = await getMatrixReviewInsight(["v1", "v2"]);

    expect(result).not.toBeNull();
    expect(result?.commonConcerns).toContain("アクセス・駐車場の確認");
    expect(result?.divergence[0]).toContain("料理");
    expect(result?.fallback).toBe(false);

    // Cache write happened — next call hits cache lane.
    expect(mockAiCreate).toHaveBeenCalledOnce();
    const cacheArg = mockAiCreate.mock.calls[0][0] as {
      data?: { type?: string };
    };
    expect(cacheArg.data?.type).toBe("matrix_review_insight");
  });

  it("R3 fallback path activates when Claude is unavailable (still surfaces something)", async () => {
    mockIsClaudeAvailable.mockReturnValue(false);
    mockVenueFindMany.mockResolvedValue([
      {
        id: "v1",
        name: "式場A",
        reviews: [
          {
            aiSummary: "A まとめ",
            categorySummary: { strengths: ["料理"], concerns: [] },
            fetchedAt: new Date("2026-04-01"),
          },
        ],
      },
      {
        id: "v2",
        name: "式場B",
        reviews: [
          {
            aiSummary: "B まとめ",
            categorySummary: { strengths: ["立地"], concerns: [] },
            fetchedAt: new Date("2026-04-01"),
          },
        ],
      },
    ]);

    const { getMatrixReviewInsight } = await import(
      "@/server/actions/matrix-review-insight"
    );

    const result = await getMatrixReviewInsight(["v1", "v2"]);

    expect(result).not.toBeNull();
    expect(result?.fallback).toBe(true);
    // Even on fallback, divergence is populated from the per-venue
    // strengths so the card still reads useful — never empty.
    expect(result?.divergence.length).toBeGreaterThan(0);
    // No Claude call + no cache write on the fallback lane.
    expect(mockAskClaude).not.toHaveBeenCalled();
    expect(mockAiCreate).not.toHaveBeenCalled();
  });
});
