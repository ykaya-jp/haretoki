import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for `src/server/ai/cache.ts` — AiAnalysis-backed type-tagged
 * cache layer. Prisma is mocked so we can exercise the TTL_DAYS map
 * and (project, type, hash) read/write contract without touching the DB.
 */

const findFirstMock = vi.fn();
const createMock = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    aiAnalysis: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

describe("server/ai/cache: getCachedAnalysis", () => {
  beforeEach(() => {
    vi.resetModules();
    findFirstMock.mockReset();
    createMock.mockReset();
  });

  it("returns the stored output when a row matches within TTL", async () => {
    findFirstMock.mockResolvedValueOnce({ output: "stored body" });
    const mod = await import("@/server/ai/cache");
    const result = await mod.getCachedAnalysis("p-1", "comparison", "hash-A");
    expect(result).toBe("stored body");

    const args = findFirstMock.mock.calls[0][0];
    expect(args.where.projectId).toBe("p-1");
    expect(args.where.type).toBe("comparison");
    expect(args.where.inputHash).toBe("hash-A");
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("returns null on miss", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const mod = await import("@/server/ai/cache");
    const result = await mod.getCachedAnalysis("p-1", "comparison", "hash-B");
    expect(result).toBeNull();
  });

  it("returns null for types without TTL (coach_chat is not cacheable)", async () => {
    const mod = await import("@/server/ai/cache");
    const result = await mod.getCachedAnalysis("p-1", "coach_chat", "hash-C");
    expect(result).toBeNull();
    // Skipped lookup entirely — no DB roundtrip for known-uncacheable types.
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("comparison cutoff is exactly 3 days back from now", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const mod = await import("@/server/ai/cache");
    const before = Date.now();
    await mod.getCachedAnalysis("p-1", "comparison", "h");
    const args = findFirstMock.mock.calls[0][0];
    const cutoffMs = (args.where.createdAt.gte as Date).getTime();
    const expectedFloor = before - 3 * 24 * 60 * 60 * 1000;
    const expectedCeil = Date.now() - 3 * 24 * 60 * 60 * 1000;
    expect(cutoffMs).toBeGreaterThanOrEqual(expectedFloor);
    expect(cutoffMs).toBeLessThanOrEqual(expectedCeil);
  });
});

describe("server/ai/cache: setCachedAnalysis", () => {
  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
  });

  it("creates a new aiAnalysis row with required fields", async () => {
    createMock.mockResolvedValueOnce({});
    const mod = await import("@/server/ai/cache");
    await mod.setCachedAnalysis({
      projectId: "p-1",
      type: "comparison",
      inputHash: "h",
      output: "body",
    });
    expect(createMock).toHaveBeenCalledOnce();
    const args = createMock.mock.calls[0][0];
    expect(args.data.projectId).toBe("p-1");
    expect(args.data.type).toBe("comparison");
    expect(args.data.inputHash).toBe("h");
    expect(args.data.output).toBe("body");
    expect(args.data.venueId).toBeNull();
  });

  it("propagates venueId when supplied", async () => {
    createMock.mockResolvedValueOnce({});
    const mod = await import("@/server/ai/cache");
    await mod.setCachedAnalysis({
      projectId: "p-1",
      type: "fit_reason",
      inputHash: "h",
      output: "body",
      venueId: "v-1",
    });
    const args = createMock.mock.calls[0][0];
    expect(args.data.venueId).toBe("v-1");
  });

  it("swallows write errors (cache write is best-effort)", async () => {
    createMock.mockRejectedValueOnce(new Error("constraint"));
    const mod = await import("@/server/ai/cache");
    await expect(
      mod.setCachedAnalysis({
        projectId: "p-1",
        type: "comparison",
        inputHash: "h",
        output: "body",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("server/ai/cache: getCacheTtlDays", () => {
  it("returns the configured TTL for known types", async () => {
    const mod = await import("@/server/ai/cache");
    expect(mod.getCacheTtlDays("comparison")).toBe(3);
    expect(mod.getCacheTtlDays("review_summary")).toBe(30);
    expect(mod.getCacheTtlDays("matrix_insight")).toBe(3);
    expect(mod.getCacheTtlDays("fit_reason")).toBe(14);
  });

  it("returns null for the uncacheable types (coach_chat)", async () => {
    const mod = await import("@/server/ai/cache");
    expect(mod.getCacheTtlDays("coach_chat")).toBeNull();
  });
});
