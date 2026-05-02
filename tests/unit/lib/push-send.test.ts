import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * Track B-2 push delivery coverage.
 *
 * Pins the per-endpoint failure protocol the cron handler depends on:
 *   - 410 / 404 → row deletion (otherwise next cron leaks an HTTP call)
 *   - 5xx / 429 → keep row, captureMessage warning, transient counter
 *   - other 4xx → captureError, fatal counter
 *   - VAPID env missing → fatal counter, NEVER throw
 */

const mockSendNotification = vi.fn();
const mockSetVapidDetails = vi.fn();

// web-push surfaces both as default + named exports (CJS interop). The
// helper imports the default export and uses .sendNotification on it.
vi.mock("web-push", () => ({
  default: {
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
  },
  setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

const mockFindMany = vi.fn();
const mockDeleteMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    pushSubscription: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

const mockCaptureError = vi.fn();
const mockCaptureMessage = vi.fn();
vi.mock("@/lib/sentry", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

const mockLogEvent = vi.fn();
vi.mock("@/lib/observability", () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

import {
  sendOneSubscription,
  sendPushToUser,
  __resetVapidStateForTests,
} from "@/lib/push/send";

const VALID_SUB = {
  id: "sub-1",
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  p256dh: "BLc4xRzKlKORKW2-FHowR0nMrr_x_iBtu",
  auth: "k8JV6sjdbhAi91k7n_DvEA",
};

const ORIGINAL_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const ORIGINAL_PRIVATE = process.env.VAPID_PRIVATE_KEY;

function setVapidEnv() {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "fake-public-key";
  process.env.VAPID_PRIVATE_KEY = "fake-private-key";
  __resetVapidStateForTests();
}

function clearVapidEnv() {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  __resetVapidStateForTests();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendOneSubscription", () => {
  it("returns vapid-missing without throwing when env is unset", async () => {
    clearVapidEnv();

    const result = await sendOneSubscription(VALID_SUB, {
      title: "t",
      body: "b",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("vapid-missing");
    }
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("returns ok with statusCode on 201 success", async () => {
    setVapidEnv();
    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    const result = await sendOneSubscription(VALID_SUB, {
      title: "明日、テスト式場 の見学",
      body: "持ち物の確認",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.statusCode).toBe(201);
    }
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    const [sub, payload, opts] = mockSendNotification.mock.calls[0];
    expect(sub).toEqual({
      endpoint: VALID_SUB.endpoint,
      keys: { p256dh: VALID_SUB.p256dh, auth: VALID_SUB.auth },
    });
    // Payload is a JSON string per Web Push protocol.
    expect(JSON.parse(payload)).toEqual({
      title: "明日、テスト式場 の見学",
      body: "持ち物の確認",
    });
    // TTL = 1h matches the relevance window decision.
    expect(opts).toEqual({ TTL: 3600 });
  });

  it("classifies 410 (Gone) as 'gone' so the caller can prune the row", async () => {
    setVapidEnv();
    const err = Object.assign(new Error("Gone"), {
      statusCode: 410,
      body: "<gone>",
    });
    mockSendNotification.mockRejectedValue(err);

    const result = await sendOneSubscription(VALID_SUB, { title: "t", body: "b" });

    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "gone") {
      expect(result.statusCode).toBe(410);
      expect(result.endpoint).toBe(VALID_SUB.endpoint);
    } else {
      throw new Error(`expected reason=gone, got ${(result as { reason?: string }).reason}`);
    }
  });

  it("classifies 404 (Not Found) as 'gone' (FCM returns 404 for dropped subs)", async () => {
    setVapidEnv();
    mockSendNotification.mockRejectedValue(
      Object.assign(new Error("Not Found"), { statusCode: 404 }),
    );

    const result = await sendOneSubscription(VALID_SUB, { title: "t", body: "b" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("gone");
  });

  it("classifies 503 as 'transient' (caller keeps the row, retries next tick)", async () => {
    setVapidEnv();
    mockSendNotification.mockRejectedValue(
      Object.assign(new Error("Service Unavailable"), { statusCode: 503 }),
    );

    const result = await sendOneSubscription(VALID_SUB, { title: "t", body: "b" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("transient");
  });

  it("classifies 429 as 'transient' (rate limit, not a permanent block)", async () => {
    setVapidEnv();
    mockSendNotification.mockRejectedValue(
      Object.assign(new Error("Too Many Requests"), { statusCode: 429 }),
    );

    const result = await sendOneSubscription(VALID_SUB, { title: "t", body: "b" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("transient");
  });

  it("classifies other 4xx (e.g. 400 malformed) as 'fatal' so it surfaces in Sentry", async () => {
    setVapidEnv();
    mockSendNotification.mockRejectedValue(
      Object.assign(new Error("Bad Request"), {
        statusCode: 400,
        body: "malformed payload",
      }),
    );

    const result = await sendOneSubscription(VALID_SUB, { title: "t", body: "b" });

    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "fatal") {
      expect(result.statusCode).toBe(400);
    } else {
      throw new Error("expected fatal");
    }
  });

  it("classifies non-HTTP errors as 'fatal' with statusCode=null", async () => {
    setVapidEnv();
    mockSendNotification.mockRejectedValue(new Error("DNS lookup failed"));

    const result = await sendOneSubscription(VALID_SUB, { title: "t", body: "b" });

    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "fatal") {
      expect(result.statusCode).toBeNull();
      expect(result.message).toMatch(/DNS/);
    } else {
      throw new Error("expected fatal");
    }
  });
});

describe("sendPushToUser fan-out", () => {
  beforeEach(() => {
    setVapidEnv();
  });

  it("returns zero counters when user has no subscriptions (no DB delete leak)", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await sendPushToUser("user-1", { title: "t", body: "b" });

    expect(result).toEqual({
      attempted: 0,
      succeeded: 0,
      pruned: 0,
      transient: 0,
      fatal: 0,
    });
    expect(mockSendNotification).not.toHaveBeenCalled();
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("succeeds across multiple devices and counts each", async () => {
    mockFindMany.mockResolvedValue([
      { ...VALID_SUB, id: "sub-1" },
      { ...VALID_SUB, id: "sub-2", endpoint: "https://fcm.googleapis.com/fcm/send/xyz" },
    ]);
    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    const result = await sendPushToUser("user-1", { title: "t", body: "b" });

    expect(result.attempted).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.pruned).toBe(0);
  });

  it("prunes a 410 endpoint inline (deleteMany called for that row only)", async () => {
    mockFindMany.mockResolvedValue([
      { ...VALID_SUB, id: "sub-dead" },
      { ...VALID_SUB, id: "sub-live", endpoint: "https://fcm.googleapis.com/fcm/send/live" },
    ]);
    mockSendNotification
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }))
      .mockResolvedValueOnce({ statusCode: 201 });
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const result = await sendPushToUser("user-1", { title: "t", body: "b" });

    expect(result.attempted).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.pruned).toBe(1);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany.mock.calls[0][0]).toEqual({
      where: { id: "sub-dead" },
    });
  });

  it("counts 5xx as transient WITHOUT deleting the row", async () => {
    mockFindMany.mockResolvedValue([{ ...VALID_SUB, id: "sub-flaky" }]);
    mockSendNotification.mockRejectedValue(
      Object.assign(new Error("Server Error"), { statusCode: 503 }),
    );

    const result = await sendPushToUser("user-1", { title: "t", body: "b" });

    expect(result.transient).toBe(1);
    expect(result.pruned).toBe(0);
    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
  });

  it("never throws — fatal errors go to Sentry, loop continues", async () => {
    mockFindMany.mockResolvedValue([
      { ...VALID_SUB, id: "sub-bad" },
      { ...VALID_SUB, id: "sub-good", endpoint: "https://fcm.googleapis.com/fcm/send/good" },
    ]);
    mockSendNotification
      .mockRejectedValueOnce(new Error("DNS exploded"))
      .mockResolvedValueOnce({ statusCode: 201 });

    const result = await sendPushToUser("user-1", { title: "t", body: "b" });

    expect(result.fatal).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(mockCaptureError).toHaveBeenCalled();
  });

  it("vapid-missing aborts further sends for this user (no per-row spam)", async () => {
    clearVapidEnv();
    mockFindMany.mockResolvedValue([
      { ...VALID_SUB, id: "sub-1" },
      { ...VALID_SUB, id: "sub-2", endpoint: "https://fcm.googleapis.com/fcm/send/x" },
    ]);

    const result = await sendPushToUser("user-1", { title: "t", body: "b" });

    expect(result.fatal).toBe(1);
    // Loop broke after the first vapid-missing — second sub never got a try.
    expect(result.succeeded).toBe(0);
    expect(result.pruned).toBe(0);
  });
});

// Restore env once the suite finishes (vitest globals are per-process).
afterAll(() => {
  if (ORIGINAL_PUBLIC === undefined)
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = ORIGINAL_PUBLIC;
  if (ORIGINAL_PRIVATE === undefined) delete process.env.VAPID_PRIVATE_KEY;
  else process.env.VAPID_PRIVATE_KEY = ORIGINAL_PRIVATE;
});

