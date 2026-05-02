import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * R1 — `batchImportReviewUrls` の契約テスト。
 *
 * 観点:
 *   1. zod cap (10 件超過) → error
 *   2. dedup: 既存 (venueId, source, sourceUrl) prefix-match で skip
 *   3. per-URL 失敗で loop 継続 (1 つ failed でも残りは saved 続行)
 *   4. rate-limit gate: URL_IMPORT 上限超で全体 reject
 *   5. allowlist 外ドメインは fail (loop は継続)
 *
 * モック方針: 「`analyzeVenueReviews` を呼ばずに済む」 path のみ unit
 * test する設計。`analyzeVenueReviews` は同 module 内の closure 経由
 * 呼び出しなので vi.spyOn では intercept できない (spread mock で export
 * を差し替えても batchImportReviewUrls 内の参照は元の関数を見続ける)。
 *
 * その制約下でも下記は **実 Claude / fetch を 1 度も呼ばずに** verify 可:
 *   - cap / empty / invalid URL → zod 段階で reject
 *   - venue 所有検証 → DB 1 query で reject
 *   - rate-limit → 1 query で reject
 *   - dedup (全件 既存マッチ) → analyze 呼ばずに all skip
 *   - disallowed domain → guard 段階で fail
 *   - in-batch dedup (重複 URL を全件既存にする) → all skip
 *
 * 「saved + failed の混在シナリオ」など analyze 経路を通す integration
 * テストは tests/integration/ で別途 cover する (analyzeVenueReviewsInner
 * の 200+ 行 mock を不要にするため、vitest 範囲外の dev-server 経由を
 * 推奨)。
 */

const mockReviewFindMany = vi.fn();
const mockVenueFindFirst = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    review: {
      findMany: (...a: unknown[]) => mockReviewFindMany(...a),
    },
    venue: {
      findFirst: (...a: unknown[]) => mockVenueFindFirst(...a),
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

// Avoid the real Claude SDK being imported (analyzeVenueReviews's deep
// dependency tree). Only the Result-shape / branch behaviour matters
// for this suite.
vi.mock("@/lib/anthropic", () => ({
  isClaudeAvailable: vi.fn(() => true),
  askClaude: vi.fn(async () => "{}"),
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  computeInputHash: vi.fn(() => "hash"),
  stripPII: vi.fn((s: string) => s),
}));

vi.mock("@/lib/ai-cache", () => ({
  cachedAskClaude: vi.fn(async () => null),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
  mockVenueFindFirst.mockResolvedValue({ id: "venue-1" });
  mockReviewFindMany.mockResolvedValue([]);
});

describe("batchImportReviewUrls — input validation (zod)", () => {
  it("rejects > 10 URLs with a friendly message and never hits rate limit", async () => {
    const { batchImportReviewUrls } = await import("@/server/actions/reviews");
    const urls = Array.from({ length: 11 }, (_, i) => `https://www.mwed.jp/hall/${i}/`);

    const result = await batchImportReviewUrls("venue-1", urls, "minna_no_wedding");

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/10|分割/);
    }
    // zod failure short-circuits before auth + rate-limit + DB
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockReviewFindMany).not.toHaveBeenCalled();
  });

  it("rejects an empty URL array", async () => {
    const { batchImportReviewUrls } = await import("@/server/actions/reviews");
    const result = await batchImportReviewUrls("venue-1", [], "minna_no_wedding");

    expect("error" in result).toBe(true);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("rejects non-URL strings via z.string().url()", async () => {
    const { batchImportReviewUrls } = await import("@/server/actions/reviews");
    const result = await batchImportReviewUrls(
      "venue-1",
      ["not-a-url"],
      "minna_no_wedding",
    );

    expect("error" in result).toBe(true);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });
});

describe("batchImportReviewUrls — auth + rate-limit gates", () => {
  it("returns 'venue not found' when venue ownership check fails", async () => {
    mockVenueFindFirst.mockResolvedValueOnce(null);
    const { batchImportReviewUrls } = await import("@/server/actions/reviews");

    const result = await batchImportReviewUrls(
      "venue-other",
      ["https://www.mwed.jp/hall/1/"],
      "minna_no_wedding",
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/式場が見つかりません/);
    }
    // Venue check happens before rate limit so the user isn't penalized
    // for a 404 on someone else's venue.
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("returns rate-limit error when URL_IMPORT bucket is full", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfterSec: 42,
    });
    const { batchImportReviewUrls } = await import("@/server/actions/reviews");

    const result = await batchImportReviewUrls(
      "venue-1",
      ["https://www.mwed.jp/hall/1/"],
      "minna_no_wedding",
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/42秒/);
    }
    // Venue + rate-limit both consulted but no DB reads on Review table
    expect(mockReviewFindMany).not.toHaveBeenCalled();
  });
});

describe("batchImportReviewUrls — dedup (analyze-free path)", () => {
  it("skips URLs whose base already exists in the venue's Reviews", async () => {
    // Pre-populate the dedup set with all input URLs so the analyze
    // call NEVER fires (= the test stays inside the unit boundary).
    mockReviewFindMany.mockResolvedValueOnce([
      { sourceUrl: "https://www.mwed.jp/hall/1/" },
      // Existing row may carry a #rev-{hash} fragment (from
      // saveExtractedReviews); the dedup stripper must ignore it.
      { sourceUrl: "https://www.mwed.jp/hall/2/#rev-abc12345" },
      { sourceUrl: "https://www.mwed.jp/hall/3/" },
    ]);
    const { batchImportReviewUrls } = await import("@/server/actions/reviews");

    const result = await batchImportReviewUrls(
      "venue-1",
      [
        "https://www.mwed.jp/hall/1/", // skipped (exact match)
        "https://www.mwed.jp/hall/2/", // skipped (base of existing #rev-...)
        "https://www.mwed.jp/hall/3/", // skipped (exact)
      ],
      "minna_no_wedding",
    );

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.summary).toEqual({ saved: 0, skipped: 3, failed: 0 });
      expect(result.perUrl).toHaveLength(3);
      expect(result.perUrl.every((r) => r.status === "skipped")).toBe(true);
      expect(result.perUrl[0].message).toMatch(/取り込み済/);
    }
  });

  it("counts a batch as exactly ONE rate-limit hit", async () => {
    // All 5 URLs already exist → analyze never called, but the rate
    // limit query still fires exactly once for the batch.
    mockReviewFindMany.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, i) => ({
        sourceUrl: `https://www.mwed.jp/hall/${i}/`,
      })),
    );
    const { batchImportReviewUrls } = await import("@/server/actions/reviews");

    const urls = Array.from({ length: 5 }, (_, i) => `https://www.mwed.jp/hall/${i}/`);
    await batchImportReviewUrls("venue-1", urls, "minna_no_wedding");

    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "url_import:user-1",
      expect.objectContaining({ limit: 5, windowMs: 60_000 }),
    );
  });
});

describe("batchImportReviewUrls — domain allowlist + loop continuation", () => {
  it("rejects URLs from disallowed domains as failed (loop continues over allowed-but-deduped)", async () => {
    // Pre-populate dedup so the allowed URL is "skipped" (not "saved")
    // — that lets us verify failed + skipped coexist without invoking
    // analyzeVenueReviews.
    mockReviewFindMany.mockResolvedValueOnce([
      { sourceUrl: "https://www.mwed.jp/hall/1/" },
    ]);
    const { batchImportReviewUrls } = await import("@/server/actions/reviews");

    const result = await batchImportReviewUrls(
      "venue-1",
      [
        "https://www.mwed.jp/hall/1/", // skipped (existing)
        "https://example.com/page", // failed (not in allowlist)
        "https://attacker.example/x", // failed (not in allowlist)
      ],
      "minna_no_wedding",
    );

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.summary).toEqual({ saved: 0, skipped: 1, failed: 2 });
      expect(result.perUrl[0].status).toBe("skipped");
      expect(result.perUrl[1].status).toBe("failed");
      expect(result.perUrl[1].message).toMatch(/対応していない/);
      expect(result.perUrl[2].status).toBe("failed");
    }
  });

  it("rejects non-https schemes via guardExternalUrl (loop continues)", async () => {
    mockReviewFindMany.mockResolvedValueOnce([
      { sourceUrl: "https://www.mwed.jp/hall/1/" },
    ]);
    const { batchImportReviewUrls } = await import("@/server/actions/reviews");

    const result = await batchImportReviewUrls(
      "venue-1",
      [
        "https://www.mwed.jp/hall/1/", // skipped
        "http://www.mwed.jp/hall/2/", // failed (scheme = http, not https)
      ],
      "minna_no_wedding",
    );

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.summary).toEqual({ saved: 0, skipped: 1, failed: 1 });
      expect(result.perUrl[1].status).toBe("failed");
      expect(result.perUrl[1].message).toMatch(/HTTPS/);
    }
  });
});
