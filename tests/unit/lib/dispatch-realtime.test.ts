import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

/**
 * P3 L3 W2 dispatcher coverage — the designer-warned race +
 * invalidation surface.
 *
 * Pinned contracts:
 *   1. Concurrent dispatchRealtimeEvent calls within the same hour
 *      result in exactly ONE push per recipient — P2002 from the
 *      composite unique catches the loser silently. (race-safe)
 *   2. Same kind/scope on the next hour-bucket fires a fresh push.
 *      (hour-bucket invalidation — equivalent to B-2's
 *      scheduledAt-day invalidation pattern)
 *   3. Per-event opt-out skips WITHOUT recording a PushSendLog row,
 *      so re-enabling later still fires the next event. (matches
 *      B-3 reminder-toggle semantics exactly — the "stale dedupe
 *      swallowing toggle-back-on" failure mode is the bug this
 *      pattern was invented to prevent.)
 *   4. Actor never receives own-event push. (ProjectMember query
 *      excludes actor.)
 *   5. Multi-recipient fan-out: one recipient's P2002 doesn't block
 *      the other recipients in the loop.
 *   6. frequency=off blanket-silences AND skips the throttle row
 *      (matches visit-reminder dispatcher's frequency=off branch).
 *   7. sendPushToUser failure is captured but doesn't crash the loop.
 */

const mockMemberFindMany = vi.fn();
const mockUserFindUnique = vi.fn();
const mockPushSendLogCreate = vi.fn();
const mockSendPushToUser = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    projectMember: { findMany: (...a: unknown[]) => mockMemberFindMany(...a) },
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    pushSendLog: { create: (...a: unknown[]) => mockPushSendLogCreate(...a) },
  },
}));

vi.mock("@/lib/push/send", () => ({
  sendPushToUser: (...a: unknown[]) => mockSendPushToUser(...a),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  logEvent: vi.fn(),
}));

import { dispatchRealtimeEvent } from "@/lib/push/dispatch-realtime";

const PROJECT_ID = "proj-1";
const ACTOR_ID = "actor-1";
const VENUE_ID = "venue-1";
const NOW = new Date("2026-05-03T10:30:00Z"); // bucket = floor(epoch/3600s)

function makeMember(overrides: {
  userId?: string;
  frequency?: string;
  toggles?: Partial<{
    notifyPartnerRating: boolean;
    notifyPartnerNote: boolean;
    notifyDecisionSaved: boolean;
    notifyWeddingDateSet: boolean;
  }>;
}) {
  return {
    userId: overrides.userId ?? "recipient-A",
    user: {
      notificationPreference: {
        frequency: overrides.frequency ?? "auto",
        notifyPartnerRating: overrides.toggles?.notifyPartnerRating ?? true,
        notifyPartnerNote: overrides.toggles?.notifyPartnerNote ?? true,
        notifyDecisionSaved: overrides.toggles?.notifyDecisionSaved ?? true,
        notifyWeddingDateSet: overrides.toggles?.notifyWeddingDateSet ?? true,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUserFindUnique.mockResolvedValue({ name: "Yuki", email: null });
  mockSendPushToUser.mockResolvedValue({
    attempted: 1,
    succeeded: 1,
    pruned: 0,
    transient: 0,
    fatal: 0,
  });
  mockPushSendLogCreate.mockResolvedValue({ id: "log-1" });
});

describe("dispatchRealtimeEvent — happy path", () => {
  it("creates throttle row, sends push to one recipient, returns counters", async () => {
    mockMemberFindMany.mockResolvedValue([makeMember({})]);

    const result = await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      venueName: "ガーデンテラス青山",
      now: NOW,
    });

    expect(result.attempted).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.skippedThrottled).toBe(0);
    expect(result.skippedOptOut).toBe(0);
    expect(result.errors).toBe(0);

    // Throttle row composition includes hour bucket + scope.
    expect(mockPushSendLogCreate).toHaveBeenCalledTimes(1);
    const data = mockPushSendLogCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      recipientUserId: "recipient-A",
      kind: "partner_rating_added",
      scopeId: VENUE_ID,
    });
    expect(typeof data.hourBucket).toBe("number");
    expect(data.hourBucket).toBe(Math.floor(NOW.getTime() / 3600000));

    expect(mockSendPushToUser).toHaveBeenCalledTimes(1);
  });

  it("queries members EXCLUDING the actor (no self-pings)", async () => {
    mockMemberFindMany.mockResolvedValue([makeMember({})]);

    await dispatchRealtimeEvent({
      kind: "decision_saved",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    const args = mockMemberFindMany.mock.calls[0][0];
    expect(args.where.projectId).toBe(PROJECT_ID);
    expect(args.where.userId).toEqual({ not: ACTOR_ID });
    expect(args.where.acceptedAt).toEqual({ not: null });
  });
});

describe("dispatchRealtimeEvent — race-safe throttle (designer warning)", () => {
  it("P2002 from concurrent dispatch is silently skipped — NO double send", async () => {
    mockMemberFindMany.mockResolvedValue([makeMember({})]);
    // Simulate the OTHER call winning the unique-constraint race.
    mockPushSendLogCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "stub",
      }),
    );

    const result = await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    expect(result.skippedThrottled).toBe(1);
    expect(result.sent).toBe(0);
    expect(result.errors).toBe(0);
    // CRITICAL: no push when the throttle gate rejects.
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("non-P2002 prisma error is captured + counted as error (not silent)", async () => {
    mockMemberFindMany.mockResolvedValue([makeMember({})]);
    mockPushSendLogCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("FK violation", {
        code: "P2003",
        clientVersion: "stub",
      }),
    );

    const result = await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    expect(result.errors).toBe(1);
    expect(result.skippedThrottled).toBe(0);
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });
});

describe("dispatchRealtimeEvent — hour-bucket invalidation", () => {
  it("first call records bucket N; same call in bucket N+1 records a NEW row", async () => {
    mockMemberFindMany.mockResolvedValue([makeMember({})]);

    const hourMs = 60 * 60 * 1000;
    const inHour1 = new Date(NOW.getTime());
    const inHour2 = new Date(NOW.getTime() + hourMs);

    await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: inHour1,
    });
    await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: inHour2,
    });

    expect(mockPushSendLogCreate).toHaveBeenCalledTimes(2);
    const bucket1 = mockPushSendLogCreate.mock.calls[0][0].data.hourBucket;
    const bucket2 = mockPushSendLogCreate.mock.calls[1][0].data.hourBucket;
    expect(bucket2 - bucket1).toBe(1);
  });
});

describe("dispatchRealtimeEvent — per-event opt-out (no throttle row recorded)", () => {
  it("notifyPartnerRating=false skips WITHOUT creating a throttle row", async () => {
    mockMemberFindMany.mockResolvedValue([
      makeMember({ toggles: { notifyPartnerRating: false } }),
    ]);

    const result = await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    expect(result.skippedOptOut).toBe(1);
    expect(result.sent).toBe(0);
    // CRITICAL: no throttle row. Re-enabling later must let the next
    // event through — the failure mode this guards against is the same
    // "stale dedupe swallows toggle-back-on" bug we caught in B-3.
    expect(mockPushSendLogCreate).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("each event maps to its own toggle (notifyPartnerNote vs notifyPartnerRating)", async () => {
    // Recipient has notifyPartnerNote=false but notifyPartnerRating=true.
    // A rating event should still fire.
    mockMemberFindMany.mockResolvedValue([
      makeMember({
        toggles: { notifyPartnerNote: false, notifyPartnerRating: true },
      }),
    ]);

    const ratingResult = await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    expect(ratingResult.sent).toBe(1);
    expect(ratingResult.skippedOptOut).toBe(0);
  });

  it("missing notificationPreference (null) treats every event as enabled", async () => {
    mockMemberFindMany.mockResolvedValue([
      {
        userId: "recipient-A",
        user: { notificationPreference: null },
      },
    ]);

    const result = await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    expect(result.sent).toBe(1);
    expect(result.skippedOptOut).toBe(0);
  });
});

describe("dispatchRealtimeEvent — frequency=off blanket silence", () => {
  it("skips without throttle row when frequency=off (re-enable still works)", async () => {
    mockMemberFindMany.mockResolvedValue([
      makeMember({ frequency: "off" }),
    ]);

    const result = await dispatchRealtimeEvent({
      kind: "decision_saved",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    expect(result.skippedFrequencyOff).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockPushSendLogCreate).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });
});

describe("dispatchRealtimeEvent — multi-recipient fan-out", () => {
  it("one recipient's P2002 doesn't block other recipients in the loop", async () => {
    mockMemberFindMany.mockResolvedValue([
      makeMember({ userId: "recipient-A" }),
      makeMember({ userId: "recipient-B" }),
    ]);
    mockPushSendLogCreate
      .mockResolvedValueOnce({ id: "log-A" })
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("dup", {
          code: "P2002",
          clientVersion: "stub",
        }),
      );

    const result = await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    expect(result.attempted).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.skippedThrottled).toBe(1);
    expect(mockSendPushToUser).toHaveBeenCalledTimes(1);
  });

  it("counts noSubscription separately when sendPushToUser returns attempted=0", async () => {
    mockMemberFindMany.mockResolvedValue([makeMember({})]);
    mockSendPushToUser.mockResolvedValue({
      attempted: 0,
      succeeded: 0,
      pruned: 0,
      transient: 0,
      fatal: 0,
    });

    const result = await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    expect(result.noSubscription).toBe(1);
    expect(result.sent).toBe(0);
    // CRITICAL: throttle row WAS created (recipient is opted in,
    // gate already passed) — the no-subscription state is a delivery
    // failure, not an opt-out, so the 1h cool-down still applies.
    expect(mockPushSendLogCreate).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchRealtimeEvent — sendPushToUser failure handling", () => {
  it("a thrown error in sendPushToUser is captured but doesn't crash the loop", async () => {
    mockMemberFindMany.mockResolvedValue([
      makeMember({ userId: "recipient-A" }),
      makeMember({ userId: "recipient-B" }),
    ]);
    mockSendPushToUser
      .mockRejectedValueOnce(new Error("push provider down"))
      .mockResolvedValueOnce({
        attempted: 1,
        succeeded: 1,
        pruned: 0,
        transient: 0,
        fatal: 0,
      });

    const result = await dispatchRealtimeEvent({
      kind: "partner_rating_added",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: VENUE_ID,
      now: NOW,
    });

    expect(result.errors).toBe(1);
    expect(result.sent).toBe(1); // second recipient still got through
    expect(mockPushSendLogCreate).toHaveBeenCalledTimes(2);
  });
});

describe("dispatchRealtimeEvent — empty member list", () => {
  it("returns zero counters when actor is the only project member", async () => {
    mockMemberFindMany.mockResolvedValue([]);

    const result = await dispatchRealtimeEvent({
      kind: "wedding_date_set",
      projectId: PROJECT_ID,
      actorUserId: ACTOR_ID,
      scopeId: PROJECT_ID,
      now: NOW,
    });

    expect(result.attempted).toBe(0);
    expect(result.sent).toBe(0);
    expect(mockPushSendLogCreate).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });
});
