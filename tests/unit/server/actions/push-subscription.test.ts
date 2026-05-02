import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Track B-1 server-action coverage.
 *
 * Validates the contracts the client lib relies on:
 *   - validation rejects malformed payloads BEFORE auth so probing routes
 *     can't be used to enumerate users
 *   - upsert key is `endpoint` (the W3C-guaranteed unique handle), not id —
 *     re-subscribing the same browser must refresh the row, never duplicate
 *   - removeSubscription is auth-scoped via deleteMany so a leaked endpoint
 *     can't delete someone else's row
 *
 * Prisma + auth are mocked so this stays a pure unit test (no DB / no
 * Supabase). Sentry is replaced with a no-op so error-path tests don't
 * spam the sink.
 */

const mockUpsert = vi.fn();
const mockDeleteMany = vi.fn();
const mockFindMany = vi.fn();
const mockRequireUser = vi.fn();
const mockCaptureError = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    pushSubscription: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

import {
  saveSubscription,
  removeSubscription,
  listMySubscriptions,
} from "@/server/actions/push-subscription";

const VALID_INPUT = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh: "BLc4xRzKlKORKW2-FHowR0nMrr_x_iBtu-3T1cxchQAr",
    auth: "k8JV6sjdbhAi91k7n_DvEA",
  },
  userAgent: "Mozilla/5.0 Test",
};

describe("saveSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ id: "user-1" });
  });

  it("rejects malformed payloads with a user-safe error (no exception)", async () => {
    const result = await saveSubscription({
      endpoint: "not a url",
      keys: { p256dh: "x", auth: "y" },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/不正/);
    // Critical: never reach prisma when the payload didn't validate.
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects empty p256dh / auth", async () => {
    const result = await saveSubscription({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "", auth: "y" },
    });
    expect(result.ok).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upserts on endpoint (NOT id) so the same browser re-subscribing doesn't duplicate", async () => {
    mockUpsert.mockResolvedValue({ id: "row-uuid" });

    const result = await saveSubscription(VALID_INPUT);

    expect(result.ok).toBe(true);
    expect(result.id).toBe("row-uuid");
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const args = mockUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ endpoint: VALID_INPUT.endpoint });
    expect(args.create.userId).toBe("user-1");
    expect(args.create.endpoint).toBe(VALID_INPUT.endpoint);
    expect(args.create.p256dh).toBe(VALID_INPUT.keys.p256dh);
    expect(args.create.auth).toBe(VALID_INPUT.keys.auth);
    expect(args.update.userId).toBe("user-1");
  });

  it("truncates oversized userAgent to 256 chars (matches audit_logs convention)", async () => {
    mockUpsert.mockResolvedValue({ id: "row-uuid" });
    const longUa = "x".repeat(500);

    await saveSubscription({ ...VALID_INPUT, userAgent: longUa });

    const args = mockUpsert.mock.calls[0][0];
    expect(args.create.userAgent).toBe("x".repeat(256));
    expect(args.update.userAgent).toBe("x".repeat(256));
  });

  it("stores null userAgent when caller omits it", async () => {
    mockUpsert.mockResolvedValue({ id: "row-uuid" });
    const { userAgent: _drop, ...withoutUa } = VALID_INPUT;
    void _drop;

    await saveSubscription(withoutUa);

    const args = mockUpsert.mock.calls[0][0];
    expect(args.create.userAgent).toBeNull();
    expect(args.update.userAgent).toBeNull();
  });

  it("captures + returns user-safe error on DB failure (does not re-throw)", async () => {
    mockUpsert.mockRejectedValue(new Error("constraint violation"));

    const result = await saveSubscription(VALID_INPUT);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/失敗/);
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    const [, ctx] = mockCaptureError.mock.calls[0];
    expect(ctx).toMatchObject({ component: "auth" });
  });
});

describe("removeSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ id: "user-1" });
  });

  it("rejects malformed endpoint without touching the DB", async () => {
    const result = await removeSubscription({ endpoint: "not a url" });
    expect(result.ok).toBe(false);
    expect(result.removed).toBe(0);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("scopes the delete to the calling user (defends against guessable endpoints)", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const result = await removeSubscription({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    });

    expect(result.ok).toBe(true);
    expect(result.removed).toBe(1);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    const args = mockDeleteMany.mock.calls[0][0];
    expect(args.where).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      userId: "user-1",
    });
  });

  it("returns ok+0 when the endpoint belongs to someone else (no leak)", async () => {
    // Auth-scoped delete returns count=0 silently — the caller can't tell
    // "no such row" from "not yours". This is intentional.
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const result = await removeSubscription({
      endpoint: "https://fcm.googleapis.com/fcm/send/foreign",
    });

    expect(result).toEqual({ ok: true, removed: 0 });
  });

  it("captures DB failure without re-throwing", async () => {
    mockDeleteMany.mockRejectedValue(new Error("connection timeout"));

    const result = await removeSubscription({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    });

    expect(result).toEqual({ ok: false, removed: 0 });
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
  });
});

describe("listMySubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ id: "user-1" });
  });

  it("scopes the query to the calling user and projects only safe fields", async () => {
    const now = new Date();
    mockFindMany.mockResolvedValue([
      { id: "row-1", userAgent: "iPhone Safari", createdAt: now },
    ]);

    const rows = await listMySubscriptions();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "row-1",
      userAgent: "iPhone Safari",
      createdAt: now,
    });

    const args = mockFindMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: "user-1" });
    // Critical: never project p256dh / auth — those are write-only secrets.
    expect(args.select).toEqual({
      id: true,
      userAgent: true,
      createdAt: true,
    });
  });
});
