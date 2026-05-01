import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for `src/lib/ai-cache.ts` — generic AiCache-backed Claude
 * memoisation. Prisma + askClaude are mocked so we can exercise the
 * cache contract (hit vs miss vs expired) without touching the DB or
 * spending real Claude credits.
 */

const computeInputHashMock = vi.fn(
  (input: string) => `hash:${input.length}:${input.slice(0, 4)}`,
);
const askClaudeMock = vi.fn();
const withRetryMock = vi.fn(
  (fn: () => Promise<unknown>) => fn(),
);

const findUniqueMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    aiCache: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

vi.mock("@/lib/anthropic", () => ({
  computeInputHash: (input: string) => computeInputHashMock(input),
  askClaude: (...args: unknown[]) => askClaudeMock(...args),
  withRetry: (fn: () => Promise<unknown>) => withRetryMock(fn),
}));

vi.mock("@/lib/models", () => ({
  MODEL: {
    HAIKU: "test-haiku",
    SONNET: "test-sonnet",
    OPUS: "test-opus",
  },
}));

describe("ai-cache: getCachedResponse", () => {
  beforeEach(() => {
    vi.resetModules();
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    askClaudeMock.mockReset();
    withRetryMock.mockClear();
  });

  it("returns the stored response on hit (within TTL)", async () => {
    findUniqueMock.mockResolvedValueOnce({
      response: "cached body",
      createdAt: new Date(Date.now() - 60_000),
    });
    const mod = await import("@/lib/ai-cache");
    const result = await mod.getCachedResponse("hash-A");
    expect(result).toBe("cached body");
  });

  it("returns null on miss", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const mod = await import("@/lib/ai-cache");
    const result = await mod.getCachedResponse("hash-B");
    expect(result).toBeNull();
  });

  it("returns null when row is older than 30-day TTL", async () => {
    findUniqueMock.mockResolvedValueOnce({
      response: "stale",
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });
    const mod = await import("@/lib/ai-cache");
    const result = await mod.getCachedResponse("hash-C");
    expect(result).toBeNull();
  });

  it("returns null on DB error (best-effort)", async () => {
    findUniqueMock.mockRejectedValueOnce(new Error("db down"));
    const mod = await import("@/lib/ai-cache");
    const result = await mod.getCachedResponse("hash-D");
    expect(result).toBeNull();
  });
});

describe("ai-cache: setCachedResponse", () => {
  beforeEach(() => {
    vi.resetModules();
    upsertMock.mockReset();
  });

  it("upserts the row with the given hash, response, and model", async () => {
    upsertMock.mockResolvedValueOnce({});
    const mod = await import("@/lib/ai-cache");
    await mod.setCachedResponse("hash-E", "body", "test-model");
    expect(upsertMock).toHaveBeenCalledOnce();
    const args = upsertMock.mock.calls[0][0];
    expect(args.where).toEqual({ inputHash: "hash-E" });
    expect(args.create.inputHash).toBe("hash-E");
    expect(args.create.response).toBe("body");
    expect(args.create.model).toBe("test-model");
  });

  it("swallows write errors (cache write is non-fatal)", async () => {
    upsertMock.mockRejectedValueOnce(new Error("constraint"));
    const mod = await import("@/lib/ai-cache");
    await expect(
      mod.setCachedResponse("hash-F", "body", "test-model"),
    ).resolves.toBeUndefined();
  });
});

describe("ai-cache: cachedAskClaude", () => {
  beforeEach(() => {
    vi.resetModules();
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    askClaudeMock.mockReset();
    withRetryMock.mockClear();
  });

  it("returns cached response without invoking Claude on hit", async () => {
    findUniqueMock.mockResolvedValueOnce({
      response: "cached output",
      createdAt: new Date(),
    });
    const mod = await import("@/lib/ai-cache");
    const result = await mod.cachedAskClaude({
      system: "system",
      userMessage: "user",
      promptVersion: 1,
    });
    expect(result).toBe("cached output");
    expect(askClaudeMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("calls Claude on miss, persists the result, and returns it", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    askClaudeMock.mockResolvedValueOnce("fresh response");
    upsertMock.mockResolvedValueOnce({});

    const mod = await import("@/lib/ai-cache");
    const result = await mod.cachedAskClaude({
      system: "system",
      userMessage: "user",
      promptVersion: 1,
    });
    expect(result).toBe("fresh response");
    expect(askClaudeMock).toHaveBeenCalledOnce();
    expect(upsertMock).toHaveBeenCalledOnce();
  });

  it("hash recipe distinguishes prompt versions — bumping version misses prior cache", async () => {
    findUniqueMock.mockResolvedValue(null);
    askClaudeMock.mockResolvedValue("anything");

    const mod = await import("@/lib/ai-cache");
    await mod.cachedAskClaude({
      system: "system",
      userMessage: "user",
      promptVersion: 1,
    });
    await mod.cachedAskClaude({
      system: "system",
      userMessage: "user",
      promptVersion: 2,
    });

    // Both calls compute distinct hashes → both look up the cache, both
    // miss, both invoke Claude.
    expect(askClaudeMock).toHaveBeenCalledTimes(2);
    const hashCall1 = computeInputHashMock.mock.calls.at(-2)?.[0];
    const hashCall2 = computeInputHashMock.mock.calls.at(-1)?.[0];
    expect(hashCall1).not.toEqual(hashCall2);
  });

  it("hash recipe distinguishes model overrides — same prompt different model misses", async () => {
    findUniqueMock.mockResolvedValue(null);
    askClaudeMock.mockResolvedValue("anything");

    const mod = await import("@/lib/ai-cache");
    // Use real ModelId literals so the test type-checks; the hash input
    // is the only thing that matters for this assertion (computeInputHash
    // is mocked to a length+prefix shape).
    await mod.cachedAskClaude({
      system: "system",
      userMessage: "user",
      promptVersion: 1,
      model: "claude-haiku-4-5-20251001",
    });
    await mod.cachedAskClaude({
      system: "system",
      userMessage: "user",
      promptVersion: 1,
      model: "claude-sonnet-4-6",
    });

    expect(askClaudeMock).toHaveBeenCalledTimes(2);
    const hashCall1 = computeInputHashMock.mock.calls.at(-2)?.[0];
    const hashCall2 = computeInputHashMock.mock.calls.at(-1)?.[0];
    expect(hashCall1).not.toEqual(hashCall2);
  });

  it("returns null when Claude itself throws — caller decides fatality", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    askClaudeMock.mockRejectedValueOnce(new Error("rate limited"));

    const mod = await import("@/lib/ai-cache");
    const result = await mod.cachedAskClaude({
      system: "system",
      userMessage: "user",
      promptVersion: 1,
    });
    expect(result).toBeNull();
    // No cache write on failure path.
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retry: false bypasses withRetry — calls askClaude directly", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    askClaudeMock.mockResolvedValueOnce("ok");

    const mod = await import("@/lib/ai-cache");
    await mod.cachedAskClaude({
      system: "system",
      userMessage: "user",
      promptVersion: 1,
      retry: false,
    });
    expect(withRetryMock).not.toHaveBeenCalled();
    expect(askClaudeMock).toHaveBeenCalledOnce();
  });
});
