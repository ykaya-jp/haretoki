import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Tests for `src/lib/botid.ts` — Vercel BotID server wrapper. The
 * underlying `checkBotId()` from `botid/server` is mocked so we can
 * assert the wrapper's enforcement-vs-graceful-degrade contract
 * without actually hitting Vercel's bot-detection service.
 */

const checkBotIdMock = vi.fn();

vi.mock("botid/server", () => ({
  checkBotId: () => checkBotIdMock(),
}));

vi.mock("@/lib/sentry", () => ({
  captureMessage: vi.fn(),
}));

describe("lib/botid: isBotIdEnabled", () => {
  const originalEnv = process.env.BOT_ID_ENABLED;

  afterEach(() => {
    process.env.BOT_ID_ENABLED = originalEnv;
    vi.resetModules();
  });

  it("returns false when BOT_ID_ENABLED is unset", async () => {
    delete process.env.BOT_ID_ENABLED;
    const mod = await import("@/lib/botid");
    expect(mod.isBotIdEnabled()).toBe(false);
  });

  it("returns true when BOT_ID_ENABLED=1", async () => {
    process.env.BOT_ID_ENABLED = "1";
    const mod = await import("@/lib/botid");
    expect(mod.isBotIdEnabled()).toBe(true);
  });

  it("returns true when BOT_ID_ENABLED=true (case-insensitive convention)", async () => {
    process.env.BOT_ID_ENABLED = "true";
    const mod = await import("@/lib/botid");
    expect(mod.isBotIdEnabled()).toBe(true);
  });

  it("returns false for any other value (strict allow-list)", async () => {
    process.env.BOT_ID_ENABLED = "yes";
    const mod = await import("@/lib/botid");
    expect(mod.isBotIdEnabled()).toBe(false);
  });
});

describe("lib/botid: detectBot", () => {
  const originalEnv = process.env.BOT_ID_ENABLED;

  beforeEach(() => {
    checkBotIdMock.mockReset();
  });

  afterEach(() => {
    process.env.BOT_ID_ENABLED = originalEnv;
    vi.resetModules();
  });

  it("short-circuits to { blocked: false } when BotID is disabled", async () => {
    delete process.env.BOT_ID_ENABLED;
    const { detectBot } = await import("@/lib/botid");
    const result = await detectBot("test-scope");
    expect(result).toEqual({ blocked: false });
    // Don't even call the SDK when feature flag is off.
    expect(checkBotIdMock).not.toHaveBeenCalled();
  });

  it("returns { blocked: true, reason } when BotID flags the request", async () => {
    process.env.BOT_ID_ENABLED = "1";
    checkBotIdMock.mockResolvedValueOnce({ isBot: true });
    const { detectBot } = await import("@/lib/botid");
    const result = await detectBot("test-scope");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("bot-detected");
  });

  it("returns { blocked: false } when BotID approves the request", async () => {
    process.env.BOT_ID_ENABLED = "1";
    checkBotIdMock.mockResolvedValueOnce({ isBot: false });
    const { detectBot } = await import("@/lib/botid");
    const result = await detectBot("test-scope");
    expect(result).toEqual({ blocked: false });
  });

  it("fails open when checkBotId throws (transient outage)", async () => {
    // Critical: we'd rather let one bot through than block every legit
    // user when the BotID service hiccups. This test pins fail-open as
    // the explicit contract.
    process.env.BOT_ID_ENABLED = "1";
    checkBotIdMock.mockRejectedValueOnce(new Error("upstream timeout"));
    const { detectBot } = await import("@/lib/botid");
    const result = await detectBot("test-scope");
    expect(result).toEqual({ blocked: false });
  });
});
