/**
 * Unit tests for getMatrixReviewInsight (R3).
 *
 * Mirror of tests/unit/server/actions/matrix-insight.test.ts since
 * R3 reuses the W18-7 cache + retry + fallback recipe wholesale.
 *
 * Coverage:
 *   1. < 2 venues → returns null without touching the DB or Claude
 *   2. zero reviews across the selection → returns null without
 *      calling Claude (couples shouldn't see hallucinated insights)
 *   3. cache hit on the (project, type, hash) tuple → returns
 *      stored output, never calls Claude
 *   4. cache miss + Claude success → JSON parsed, persisted, returned
 *   5. Claude unavailable → deterministic template fallback
 *      (`fallback: true`), still cacheable on the next call (no
 *      cache write on fallback paths to avoid pinning the empty
 *      synthesis)
 *   6. AiAnalysisType enum literally exposes `matrix_review_insight`
 *      so the additive migration is honoured by the generated
 *      Prisma client
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------

const mockAiFindFirst = vi.fn();
const mockAiCreate = vi.fn();
const mockVenueFindMany = vi.fn();
const mockAskClaude = vi.fn();
const mockIsClaudeAvailable = vi.fn(() => true);

vi.mock("@/server/db", () => ({
  prisma: {
    aiAnalysis: {
      findFirst: (...args: unknown[]) => mockAiFindFirst(...args),
      create: (...args: unknown[]) => mockAiCreate(...args),
    },
    venue: {
      findMany: (...args: unknown[]) => mockVenueFindMany(...args),
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

vi.mock("@/lib/anthropic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anthropic")>(
    "@/lib/anthropic",
  );
  return {
    ...actual,
    isClaudeAvailable: () => mockIsClaudeAvailable(),
    askClaude: (...args: unknown[]) => mockAskClaude(...args),
    withRetry: async (fn: () => Promise<unknown>) => fn(),
  };
});

import { getMatrixReviewInsight } from "@/server/actions/matrix-review-insight";
import { MODEL } from "@/lib/models";
import { AiAnalysisType } from "@/generated/prisma/enums";

function venueRow(
  id: string,
  name: string,
  reviews: Array<{ aiSummary?: string; categorySummary?: unknown }>,
) {
  return {
    id,
    name,
    reviews: reviews.map((r) => ({
      aiSummary: r.aiSummary ?? null,
      categorySummary: r.categorySummary ?? null,
      fetchedAt: new Date("2026-05-01"),
    })),
  };
}

describe("getMatrixReviewInsight", () => {
  beforeEach(() => {
    mockAiFindFirst.mockReset();
    mockAiCreate.mockReset().mockResolvedValue({ id: "cache-1" });
    mockVenueFindMany.mockReset();
    mockAskClaude.mockReset();
    mockIsClaudeAvailable.mockReset().mockReturnValue(true);
  });

  it("returns null when fewer than 2 venueIds passed", async () => {
    const result = await getMatrixReviewInsight(["v1"]);
    expect(result).toBeNull();
    expect(mockVenueFindMany).not.toHaveBeenCalled();
    expect(mockAskClaude).not.toHaveBeenCalled();
  });

  it("returns null when every selected venue has zero reviews", async () => {
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", "式場A", []),
      venueRow("v2", "式場B", []),
    ]);

    const result = await getMatrixReviewInsight(["v1", "v2"]);

    expect(result).toBeNull();
    expect(mockAskClaude).not.toHaveBeenCalled();
    // No cache write either — we never produced an output.
    expect(mockAiCreate).not.toHaveBeenCalled();
  });

  it("returns cached Claude output on hash match without calling Claude", async () => {
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", "式場A", [
        { aiSummary: "式場 A の口コミまとめ", categorySummary: { strengths: ["料理"], concerns: [] } },
      ]),
      venueRow("v2", "式場B", [
        { aiSummary: "式場 B の口コミまとめ", categorySummary: { strengths: ["立地"], concerns: ["駐車場"] } },
      ]),
    ]);
    mockAiFindFirst.mockResolvedValue({
      output: JSON.stringify({
        commonConcerns: ["（キャッシュ済み）アクセス面"],
        divergence: ["A は料理、B は立地"],
        decisionHint: "見学で駐車場の出入りを確認しましょう",
      }),
    });

    const result = await getMatrixReviewInsight(["v1", "v2"]);

    expect(mockAskClaude).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      commonConcerns: [expect.stringContaining("キャッシュ済み")],
      divergence: [expect.stringContaining("料理")],
      decisionHint: expect.stringContaining("駐車場"),
      fallback: false,
    });
  });

  it("calls Claude with the Haiku model on cache miss + persists JSON", async () => {
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", "式場A", [
        { aiSummary: "式場 A の口コミまとめ", categorySummary: { strengths: ["料理"], concerns: [] } },
      ]),
      venueRow("v2", "式場B", [
        { aiSummary: "式場 B の口コミまとめ", categorySummary: { strengths: ["立地"], concerns: ["駐車場"] } },
      ]),
    ]);
    mockAiFindFirst.mockResolvedValue(null);
    mockAskClaude.mockResolvedValue(
      JSON.stringify({
        commonConcerns: ["アクセス面の確認"],
        divergence: ["A は料理が、B は立地が光る"],
        decisionHint: "次の見学で駐車場の出入りを確認しましょう",
      }),
    );

    const result = await getMatrixReviewInsight(["v1", "v2"]);

    expect(mockAskClaude).toHaveBeenCalledOnce();
    const arg = mockAskClaude.mock.calls[0][0] as {
      model?: string;
      maxTokens?: number;
      system?: string;
      userMessage?: string;
    };
    expect(arg.model).toBe(MODEL.HAIKU);
    expect(arg.maxTokens).toBe(768);
    // System prompt must encode the brand voice rules — non-strict
    // contains check rather than full prompt match so re-tunings of
    // the prose don't churn this test on every prompt edit.
    expect(arg.system).toMatch(/中立/);
    expect(arg.system).toMatch(/急かさない/);
    // User message must include both venue names + the section
    // headers that drive prompt parsing.
    expect(arg.userMessage).toContain("式場A");
    expect(arg.userMessage).toContain("式場B");
    expect(arg.userMessage).toMatch(/口コミまとめ/);

    expect(result).toMatchObject({
      commonConcerns: [expect.any(String)],
      divergence: [expect.any(String)],
      decisionHint: expect.any(String),
      fallback: false,
    });
    // Cache write happened so next call hits the cache lane.
    expect(mockAiCreate).toHaveBeenCalledOnce();
    const cacheArg = mockAiCreate.mock.calls[0][0] as {
      data?: { type?: string };
    };
    expect(cacheArg.data?.type).toBe("matrix_review_insight");
  });

  it("renders template fallback when Claude is unavailable", async () => {
    mockIsClaudeAvailable.mockReturnValue(false);
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", "式場A", [
        { aiSummary: "A の口コミまとめ", categorySummary: { strengths: ["料理"], concerns: [] } },
      ]),
      venueRow("v2", "式場B", [
        { aiSummary: "B の口コミまとめ", categorySummary: { strengths: ["立地"], concerns: [] } },
      ]),
    ]);

    const result = await getMatrixReviewInsight(["v1", "v2"]);

    expect(result).not.toBeNull();
    expect(result?.fallback).toBe(true);
    expect(result?.divergence.length).toBeGreaterThan(0);
    // No Claude / no cache write on the fallback path.
    expect(mockAskClaude).not.toHaveBeenCalled();
    expect(mockAiCreate).not.toHaveBeenCalled();
  });

  it("renders template fallback when Claude returns malformed JSON", async () => {
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", "式場A", [
        { aiSummary: "A まとめ", categorySummary: { strengths: ["料理"] } },
      ]),
      venueRow("v2", "式場B", [
        { aiSummary: "B まとめ", categorySummary: { strengths: ["立地"] } },
      ]),
    ]);
    mockAiFindFirst.mockResolvedValue(null);
    mockAskClaude.mockResolvedValue("not actually json {");

    const result = await getMatrixReviewInsight(["v1", "v2"]);

    expect(result?.fallback).toBe(true);
    // Malformed Claude output should NOT be persisted as cache.
    expect(mockAiCreate).not.toHaveBeenCalled();
  });

  it("dedupes + sorts venueIds so the cache key is order-insensitive", async () => {
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", "式場A", [
        { aiSummary: "A まとめ", categorySummary: { strengths: ["料理"] } },
      ]),
      venueRow("v2", "式場B", [
        { aiSummary: "B まとめ", categorySummary: { strengths: ["立地"] } },
      ]),
    ]);
    mockAiFindFirst.mockResolvedValue(null);
    mockAskClaude.mockResolvedValue(
      JSON.stringify({
        commonConcerns: [],
        divergence: ["A は料理、B は立地"],
        decisionHint: "次の見学で確認しましょう",
      }),
    );

    // Call twice with the same selection in different orders.
    await getMatrixReviewInsight(["v2", "v1"]);
    const firstHash = (mockAiFindFirst.mock.calls[0][0] as {
      where?: { inputHash?: string };
    }).where?.inputHash;

    mockAiFindFirst.mockClear();
    await getMatrixReviewInsight(["v1", "v2", "v1"]);
    const secondHash = (mockAiFindFirst.mock.calls[0][0] as {
      where?: { inputHash?: string };
    }).where?.inputHash;

    expect(firstHash).toBe(secondHash);
  });
});

describe("AiAnalysisType enum integrity", () => {
  it("exposes the matrix_review_insight enum value (additive migration check)", () => {
    expect(AiAnalysisType.matrix_review_insight).toBe("matrix_review_insight");
  });
});
