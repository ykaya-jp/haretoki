import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Tests for the Upstash Redis rate-limit backend. The `@upstash/redis`
 * client is mocked so we can pin the sliding-window contract without
 * standing up a real Redis. The module under test (`./redis.ts`) only
 * touches Redis through the mocked surface, so the test exercises the
 * algorithm exactly as production would.
 */

interface MockClient {
  pipeline: ReturnType<typeof vi.fn>;
  zrange: ReturnType<typeof vi.fn>;
}

const pipelineState: {
  zremrangebyscoreCalls: Array<[string, number, number]>;
  zcardCalls: string[];
  zaddCalls: Array<{ key: string; score: number; member: string }>;
  expireCalls: Array<[string, number]>;
  // What the next pipeline.exec() should resolve to. Tests set this
  // before each call.
  nextExecResult: unknown[];
} = {
  zremrangebyscoreCalls: [],
  zcardCalls: [],
  zaddCalls: [],
  expireCalls: [],
  nextExecResult: [],
};

function makePipeline(): {
  zremrangebyscore: ReturnType<typeof vi.fn>;
  zcard: ReturnType<typeof vi.fn>;
  zadd: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
} {
  const pipe = {
    zremrangebyscore: vi.fn((key: string, min: number, max: number) => {
      pipelineState.zremrangebyscoreCalls.push([key, min, max]);
      return pipe;
    }),
    zcard: vi.fn((key: string) => {
      pipelineState.zcardCalls.push(key);
      return pipe;
    }),
    zadd: vi.fn(
      (key: string, opts: { score: number; member: string }) => {
        pipelineState.zaddCalls.push({
          key,
          score: opts.score,
          member: opts.member,
        });
        return pipe;
      },
    ),
    expire: vi.fn((key: string, sec: number) => {
      pipelineState.expireCalls.push([key, sec]);
      return pipe;
    }),
    exec: vi.fn(async () => pipelineState.nextExecResult),
  };
  return pipe;
}

const zrangeMock = vi.fn();

const mockClient: MockClient = {
  pipeline: vi.fn(makePipeline),
  zrange: zrangeMock,
};

vi.mock("@upstash/redis", () => ({
  Redis: class {
    pipeline = mockClient.pipeline;
    zrange = mockClient.zrange;
  },
}));

describe("redisBackend.check", () => {
  beforeEach(async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    pipelineState.zremrangebyscoreCalls.length = 0;
    pipelineState.zcardCalls.length = 0;
    pipelineState.zaddCalls.length = 0;
    pipelineState.expireCalls.length = 0;
    pipelineState.nextExecResult = [0, 0];
    zrangeMock.mockReset();
    mockClient.pipeline.mockClear();
    vi.resetModules();
    const mod = await import("@/lib/rate-limit/redis");
    mod._resetRedisClient();
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("admits the first request and records via ZADD", async () => {
    pipelineState.nextExecResult = [0, 0]; // 0 evicted, 0 in window

    const { redisBackend } = await import("@/lib/rate-limit/redis");
    const result = await redisBackend.check(
      "user:1",
      { limit: 3, windowMs: 60_000 },
      1_000,
    );

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.remaining).toBe(2);
    }

    // ZREMRANGEBYSCORE called with cutoff = now - windowMs
    expect(pipelineState.zremrangebyscoreCalls[0]).toEqual([
      "rl:user:1",
      0,
      1_000 - 60_000,
    ]);
    // ZADD called with the new timestamp
    expect(pipelineState.zaddCalls).toHaveLength(1);
    expect(pipelineState.zaddCalls[0].score).toBe(1_000);
    expect(pipelineState.zaddCalls[0].key).toBe("rl:user:1");
    // EXPIRE bumps with windowMs/1000 + 60s slack
    expect(pipelineState.expireCalls).toEqual([["rl:user:1", 120]]);
  });

  it("blocks once the limit is reached and computes retryAfter from the oldest score", async () => {
    // 3 entries already in the window — at the limit.
    pipelineState.nextExecResult = [0, 3];
    // ZRANGE returns the oldest entry — score = the now of the first hit.
    zrangeMock.mockResolvedValueOnce(["1000:abc123", 1_000]);

    const { redisBackend } = await import("@/lib/rate-limit/redis");
    const result = await redisBackend.check(
      "user:1",
      { limit: 3, windowMs: 60_000 },
      1_300,
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      // oldest = 1_000, window 60_000 → expires at 61_000.
      // now = 1_300 → retryAfterMs = 59_700 → ceil to 60s.
      expect(result.retryAfterSec).toBe(60);
      expect(result.limit).toBe(3);
      expect(result.windowMs).toBe(60_000);
    }
    // No ZADD on the rejection path.
    expect(pipelineState.zaddCalls).toHaveLength(0);
  });

  it("admits the request when invalid input is passed (graceful degrade)", async () => {
    const { redisBackend } = await import("@/lib/rate-limit/redis");

    const empty = await redisBackend.check("", { limit: 1, windowMs: 60_000 });
    expect(empty.allowed).toBe(true);

    const zeroLimit = await redisBackend.check("k", {
      limit: 0,
      windowMs: 60_000,
    });
    expect(zeroLimit.allowed).toBe(true);

    const zeroWindow = await redisBackend.check("k", {
      limit: 1,
      windowMs: 0,
    });
    expect(zeroWindow.allowed).toBe(true);

    // None of the bad-input paths should have touched Redis at all.
    expect(mockClient.pipeline).not.toHaveBeenCalled();
  });

  it("scopes by key (per-user isolation)", async () => {
    pipelineState.nextExecResult = [0, 0];

    const { redisBackend } = await import("@/lib/rate-limit/redis");
    await redisBackend.check("user:a", { limit: 1, windowMs: 60_000 }, 1_000);
    await redisBackend.check("user:b", { limit: 1, windowMs: 60_000 }, 1_000);

    expect(pipelineState.zaddCalls.map((c) => c.key)).toEqual([
      "rl:user:a",
      "rl:user:b",
    ]);
  });

  it("backend name is 'redis'", async () => {
    const { redisBackend } = await import("@/lib/rate-limit/redis");
    expect(redisBackend.name).toBe("redis");
  });
});
