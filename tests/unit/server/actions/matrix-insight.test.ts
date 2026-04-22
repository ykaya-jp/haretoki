/**
 * Integration test for getMatrixInsight.
 *
 * Focus areas for W13-2:
 *   1. Cache hit returns the persisted Claude output without calling Claude.
 *   2. Cache miss calls Claude with the tradeoff-framing system prompt, parses
 *      its JSON, and persists the result (incl. model in the hash key).
 *   3. Claude unavailable / failure → template fallback (never silent fail).
 *   4. <2 venues → null.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockProjectFindUnique = vi.fn();
const mockGetMatrixData = vi.fn();
const mockAskClaude = vi.fn();
const mockIsClaudeAvailable = vi.fn(() => true);

vi.mock("@/server/db", () => ({
  prisma: {
    aiAnalysis: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    project: {
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
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

vi.mock("@/server/actions/matrix", () => ({
  getMatrixData: (...args: unknown[]) => mockGetMatrixData(...args),
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

vi.mock("@/lib/schemas", () => ({
  parseConditions: () => null,
}));

vi.mock("@/lib/constants", () => ({
  DIMENSION_LABELS: { taste: "料理", location: "立地", cost: "費用感" },
}));

import { getMatrixInsight } from "@/server/actions/matrix-insight";
import { MODEL } from "@/lib/models";

const baseMatrix = {
  venues: [
    {
      id: "v1",
      name: "式場A",
      totalScore: 4.2,
      scoresByDimension: { taste: 4.5, location: 3.5, cost: 3.0 },
      latestEstimateTotal: 3_500_000,
      costMax: null,
      costMin: null,
    },
    {
      id: "v2",
      name: "式場B",
      totalScore: 3.9,
      scoresByDimension: { taste: 3.5, location: 4.5, cost: 4.0 },
      latestEstimateTotal: 2_800_000,
      costMax: null,
      costMin: null,
    },
  ],
  winners: { taste: "v1", location: "v2", total: "v1" },
};

describe("getMatrixInsight", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockCreate.mockReset().mockResolvedValue({ id: "cache-1" });
    mockProjectFindUnique.mockReset().mockResolvedValue({ conditions: null });
    mockGetMatrixData.mockReset();
    mockAskClaude.mockReset();
    mockIsClaudeAvailable.mockReset().mockReturnValue(true);
  });

  it("returns null when fewer than 2 venues (nothing to compare)", async () => {
    mockGetMatrixData.mockResolvedValue({
      venues: [baseMatrix.venues[0]],
      winners: {},
    });
    const result = await getMatrixInsight();
    expect(result).toBeNull();
    expect(mockAskClaude).not.toHaveBeenCalled();
  });

  it("returns cached Claude output on hash match without calling Claude", async () => {
    mockGetMatrixData.mockResolvedValue(baseMatrix);
    mockFindFirst.mockResolvedValue({
      output: JSON.stringify({
        summary: "（キャッシュ済み）各式場のトレードオフをここに書きます。",
        nextActions: ["見学で料理を確認する"],
      }),
    });

    const result = await getMatrixInsight();

    expect(mockAskClaude).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      summary: expect.stringContaining("キャッシュ済み"),
      nextActions: ["見学で料理を確認する"],
      fallback: false,
    });
  });

  it("calls Claude with the Haiku model when cache misses", async () => {
    mockGetMatrixData.mockResolvedValue(baseMatrix);
    mockFindFirst.mockResolvedValue(null);
    mockAskClaude.mockResolvedValue(
      JSON.stringify({
        summary: "式場Aは料理、式場Bは立地が光ります。",
        nextActions: ["料理の重要度を仮置きしてみる"],
      }),
    );

    const result = await getMatrixInsight();

    expect(mockAskClaude).toHaveBeenCalledOnce();
    const arg = mockAskClaude.mock.calls[0][0] as {
      model?: string;
      maxTokens?: number;
      system?: string;
    };
    expect(arg.model).toBe(MODEL.HAIKU);
    expect(arg.maxTokens).toBe(512);
    expect(arg.system).toMatch(/トレードオフ/);
    expect(result).toMatchObject({
      summary: expect.stringContaining("料理"),
      fallback: false,
    });
    // Result was persisted so next request hits cache
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("handles ```json fenced responses (Claude sometimes wraps output)", async () => {
    mockGetMatrixData.mockResolvedValue(baseMatrix);
    mockFindFirst.mockResolvedValue(null);
    mockAskClaude.mockResolvedValue(
      "```json\n" +
        JSON.stringify({ summary: "fenced ok", nextActions: ["a"] }) +
        "\n```",
    );

    const result = await getMatrixInsight();
    expect(result?.summary).toBe("fenced ok");
    expect(result?.fallback).toBe(false);
  });

  it("falls back to a deterministic template when Claude is unavailable", async () => {
    mockIsClaudeAvailable.mockReturnValue(false);
    mockGetMatrixData.mockResolvedValue(baseMatrix);

    const result = await getMatrixInsight();

    expect(mockAskClaude).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.fallback).toBe(true);
    expect(result!.summary.length).toBeGreaterThan(0);
    expect(result!.nextActions.length).toBeGreaterThan(0);
  });

  it("falls back to template when Claude throws (never silent fail)", async () => {
    mockGetMatrixData.mockResolvedValue(baseMatrix);
    mockFindFirst.mockResolvedValue(null);
    mockAskClaude.mockRejectedValue(new Error("upstream boom"));

    const result = await getMatrixInsight();

    expect(result).not.toBeNull();
    expect(result!.fallback).toBe(true);
    expect(result!.summary.length).toBeGreaterThan(0);
  });

  it("falls back to template when Claude returns malformed JSON", async () => {
    mockGetMatrixData.mockResolvedValue(baseMatrix);
    mockFindFirst.mockResolvedValue(null);
    mockAskClaude.mockResolvedValue("not-json-at-all");

    const result = await getMatrixInsight();
    expect(result!.fallback).toBe(true);
  });
});
