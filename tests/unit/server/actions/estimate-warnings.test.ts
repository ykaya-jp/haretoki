/**
 * Unit tests for generateEstimateWarnings.
 *
 * Focus areas:
 *   1. Happy path — items + budget → JSON parse succeeds → warnings array
 *      flows back with cached:false.
 *   2. Empty estimate (no items) → empty result without calling Claude.
 *   3. Malformed JSON from Claude → empty result (degrade, never throw).
 *   4. Claude unavailable → empty result without calling cachedAskClaude.
 *
 * cachedAskClaude is mocked at the module boundary so tests don't depend
 * on the AiCache table or the Anthropic SDK.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
const mockEstimateFindFirst = vi.fn();
const mockVenueFindUnique = vi.fn();
const mockProjectFindUnique = vi.fn();
const mockCachedAskClaude = vi.fn();
const mockIsClaudeAvailable = vi.fn(() => true);

vi.mock("@/server/db", () => ({
  prisma: {
    estimate: {
      findFirst: (...args: unknown[]) => mockEstimateFindFirst(...args),
    },
    venue: {
      findUnique: (...args: unknown[]) => mockVenueFindUnique(...args),
    },
    project: {
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireVenueAccess: vi.fn(async () => ({
    projectId: "proj-1",
    venue: { id: "venue-1", projectId: "proj-1" },
  })),
}));

vi.mock("@/lib/claude", () => ({
  isClaudeAvailable: () => mockIsClaudeAvailable(),
}));

vi.mock("@/lib/ai-cache", () => ({
  cachedAskClaude: (...args: unknown[]) => mockCachedAskClaude(...args),
}));

import { generateEstimateWarnings } from "@/server/actions/estimate-warnings";

const FULL_ESTIMATE = {
  total: 4_500_000,
  items: [
    { category: "venue_fee", itemName: "会場使用料", amount: 300_000, tier: "standard" },
    { category: "cuisine", itemName: "コース料理", amount: 1_400_000, tier: "standard" },
    { category: "attire", itemName: "ドレス", amount: 350_000, tier: "minimum" },
    { category: "photo_video", itemName: "写真撮影", amount: 280_000, tier: "minimum" },
    { category: "av_equipment", itemName: "音響", amount: 120_000, tier: "minimum" },
  ],
};

const VALID_RESPONSE = JSON.stringify({
  warnings: [
    {
      severity: "alert",
      title: "ドレス持ち込み料が未記載",
      message: "持ち込み料 +30〜50 万円の事例多数。",
      relatedItem: "ドレス",
    },
    {
      severity: "warn",
      title: "予算上限を 12% 超過",
      message: "見直し候補を 3 つ検討してください。",
    },
    {
      severity: "info",
      title: "音響オプションは要確認",
      message: "基本のみだと写真と合わせて +40 万円事例。",
      relatedItem: "音響",
    },
  ],
});

describe("generateEstimateWarnings", () => {
  beforeEach(() => {
    mockEstimateFindFirst.mockReset();
    mockVenueFindUnique.mockReset();
    mockProjectFindUnique.mockReset();
    mockCachedAskClaude.mockReset();
    mockIsClaudeAvailable.mockReset().mockReturnValue(true);

    mockVenueFindUnique.mockResolvedValue({ location: "東京都渋谷区" });
    mockProjectFindUnique.mockResolvedValue({
      conditions: { budget: { min: 3_000_000, max: 4_000_000 } },
    });
  });

  it("returns warnings array on happy path with budget + items", async () => {
    mockEstimateFindFirst.mockResolvedValue(FULL_ESTIMATE);
    mockCachedAskClaude.mockResolvedValue(VALID_RESPONSE);

    const result = await generateEstimateWarnings("venue-1");

    expect(mockCachedAskClaude).toHaveBeenCalledOnce();
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toMatchObject({
      severity: "alert",
      title: "ドレス持ち込み料が未記載",
      relatedItem: "ドレス",
    });
    expect(result.cached).toBe(false);
  });

  it("clamps the warnings array to 5 even if Claude returns more", async () => {
    mockEstimateFindFirst.mockResolvedValue(FULL_ESTIMATE);
    mockCachedAskClaude.mockResolvedValue(
      JSON.stringify({
        warnings: Array.from({ length: 7 }, (_, i) => ({
          severity: "info",
          title: `項目 ${i + 1}`,
          message: "...",
        })),
      }),
    );

    const result = await generateEstimateWarnings("venue-1");
    expect(result.warnings).toHaveLength(5);
  });

  it("returns empty when estimate has no items (nothing to review)", async () => {
    mockEstimateFindFirst.mockResolvedValue({ total: 0, items: [] });

    const result = await generateEstimateWarnings("venue-1");

    expect(mockCachedAskClaude).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
    expect(result.cached).toBe(false);
  });

  it("returns empty when no estimate exists for the venue", async () => {
    mockEstimateFindFirst.mockResolvedValue(null);

    const result = await generateEstimateWarnings("venue-1");

    expect(mockCachedAskClaude).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
  });

  it("returns empty when Claude returns malformed JSON (no throw)", async () => {
    mockEstimateFindFirst.mockResolvedValue(FULL_ESTIMATE);
    mockCachedAskClaude.mockResolvedValue("not-json-at-all");

    const result = await generateEstimateWarnings("venue-1");
    expect(result.warnings).toEqual([]);
  });

  it("returns empty when Claude returns wrong shape (zod mismatch)", async () => {
    mockEstimateFindFirst.mockResolvedValue(FULL_ESTIMATE);
    mockCachedAskClaude.mockResolvedValue(
      JSON.stringify({ result: ["wrong-key"] }),
    );

    const result = await generateEstimateWarnings("venue-1");
    expect(result.warnings).toEqual([]);
  });

  it("returns empty when Claude returns null (timeout / 5xx)", async () => {
    mockEstimateFindFirst.mockResolvedValue(FULL_ESTIMATE);
    mockCachedAskClaude.mockResolvedValue(null);

    const result = await generateEstimateWarnings("venue-1");
    expect(result.warnings).toEqual([]);
  });

  it("does not call Claude when isClaudeAvailable is false", async () => {
    mockIsClaudeAvailable.mockReturnValue(false);

    const result = await generateEstimateWarnings("venue-1");

    expect(mockCachedAskClaude).not.toHaveBeenCalled();
    expect(mockEstimateFindFirst).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
  });

  it("strips ```json fences before parsing", async () => {
    mockEstimateFindFirst.mockResolvedValue(FULL_ESTIMATE);
    mockCachedAskClaude.mockResolvedValue(
      "```json\n" + VALID_RESPONSE + "\n```",
    );

    const result = await generateEstimateWarnings("venue-1");
    expect(result.warnings).toHaveLength(3);
  });

  it("works when budgetMax is null (project conditions missing)", async () => {
    mockProjectFindUnique.mockResolvedValue({ conditions: null });
    mockEstimateFindFirst.mockResolvedValue(FULL_ESTIMATE);
    mockCachedAskClaude.mockResolvedValue(VALID_RESPONSE);

    const result = await generateEstimateWarnings("venue-1");
    expect(result.warnings).toHaveLength(3);

    // The user message passed to Claude should reflect the missing budget
    const callArg = mockCachedAskClaude.mock.calls[0][0] as {
      userMessage: string;
    };
    expect(callArg.userMessage).toContain("予算上限: 未設定");
  });
});
