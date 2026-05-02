import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

/**
 * Track B-2 cron handler — race-safety + scheduledAt-invalidation.
 *
 * Specifically pins the designer-flagged failure modes:
 *   1. Two concurrent invocations book the same (user, visit, phase,
 *      day): the second prisma.create throws P2002 → counted as
 *      `skipped`, no double-send to email or push.
 *   2. After the first send is recorded, a follow-up tick the same day
 *      is suppressed (idempotent — repeated cron retries don't spam).
 *   3. Push delivery is best-effort — a thrown error inside
 *      sendPushToUser MUST NOT abort the email leg or the loop.
 *   4. NotificationPreference.frequency === "off" silences all surfaces
 *      AND skips dedupe creation (so a later "auto" toggle still sends).
 */

const mockVisitFindMany = vi.fn();
const mockMemberFindMany = vi.fn();
const mockSentCreate = vi.fn();
const mockNotificationCreate = vi.fn();
const mockNotificationUpdate = vi.fn();
const mockSendEmail = vi.fn();
const mockSendPushToUser = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    visit: { findMany: (...a: unknown[]) => mockVisitFindMany(...a) },
    projectMember: { findMany: (...a: unknown[]) => mockMemberFindMany(...a) },
    visitReminderSent: { create: (...a: unknown[]) => mockSentCreate(...a) },
    notification: {
      create: (...a: unknown[]) => mockNotificationCreate(...a),
      update: (...a: unknown[]) => mockNotificationUpdate(...a),
    },
  },
}));

vi.mock("@/lib/email/send", () => ({
  isEmailAvailable: vi.fn(() => true),
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

// Email render is a pure function; the handler only consumes the result
// shape (subject / html / text), so a static stub keeps the test focused.
vi.mock("@/lib/email/templates/visit-reminder", () => ({
  renderVisitReminderEmail: vi.fn(() => ({
    subject: "subj",
    html: "<p>html</p>",
    text: "text",
  })),
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

import { runVisitReminderCron } from "@/server/cron/visit-reminder-handler";

const NOW_FRI_19_JST = new Date(Date.UTC(2026, 4, 15, 10, 0, 0)); // day_before fire moment
const VISIT_SAT_14_JST = new Date(Date.UTC(2026, 4, 16, 5, 0, 0)); // tomorrow 14 JST

const baseVisit = {
  id: "visit-1",
  scheduledAt: VISIT_SAT_14_JST,
  title: null,
  memo: null,
  venueId: "venue-1",
  venue: {
    id: "venue-1",
    name: "ガーデンテラス青山",
    accessInfo: null,
    projectId: "proj-1",
    ceremonyStyles: ["chapel"],
  },
};

const baseMember = {
  userId: "user-A",
  user: {
    email: "couple@example.com",
    notificationPreference: { frequency: "auto", emailEnabled: true },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSendPushToUser.mockResolvedValue({
    attempted: 1,
    succeeded: 1,
    pruned: 0,
    transient: 0,
    fatal: 0,
  });
  mockSendEmail.mockResolvedValue({ success: true, messageId: "msg-id" });
  mockNotificationCreate.mockResolvedValue({ id: "notif-1" });
  mockNotificationUpdate.mockResolvedValue({});
});

describe("runVisitReminderCron — happy path", () => {
  it("creates dedupe row, sends push + email, updates Notification with messageId", async () => {
    mockVisitFindMany.mockResolvedValue([baseVisit]);
    mockMemberFindMany.mockResolvedValue([baseMember]);
    mockSentCreate.mockResolvedValue({ id: "sent-1" });

    const result = await runVisitReminderCron("day_before", NOW_FRI_19_JST);

    expect(result.candidates).toBe(1);
    expect(result.notified).toBe(1);
    expect(result.emailed).toBe(1);
    expect(result.pushed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errored).toBe(0);

    // Dedupe row composition: includes scheduledDateKey for invalidation.
    expect(mockSentCreate).toHaveBeenCalledTimes(1);
    expect(mockSentCreate.mock.calls[0][0].data).toEqual({
      userId: "user-A",
      visitId: "visit-1",
      phase: "day_before",
      scheduledDateKey: "2026-05-16", // JST date of VISIT_SAT_14_JST
    });
  });
});

describe("runVisitReminderCron — designer race / dedupe gate", () => {
  it("a P2002 from concurrent ticks is silently skipped (no double email / push)", async () => {
    mockVisitFindMany.mockResolvedValue([baseVisit]);
    mockMemberFindMany.mockResolvedValue([baseMember]);
    // Simulate the OTHER tick winning the unique-constraint race.
    mockSentCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "stub",
      }),
    );

    const result = await runVisitReminderCron("day_before", NOW_FRI_19_JST);

    expect(result.skipped).toBe(1);
    expect(result.notified).toBe(0);
    expect(result.emailed).toBe(0);
    expect(result.pushed).toBe(0);
    expect(result.errored).toBe(0);

    // Critical: no email + no push when dedupe gate rejects.
    expect(mockNotificationCreate).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("a non-P2002 prisma error propagates to the per-visit catch (counted as errored)", async () => {
    mockVisitFindMany.mockResolvedValue([baseVisit]);
    mockMemberFindMany.mockResolvedValue([baseMember]);
    mockSentCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("FK violation", {
        code: "P2003",
        clientVersion: "stub",
      }),
    );

    const result = await runVisitReminderCron("day_before", NOW_FRI_19_JST);

    expect(result.errored).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.emailed).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("runVisitReminderCron — frequency=off silences all surfaces", () => {
  it("skips dedupe creation so a later 'auto' toggle re-arms the user", async () => {
    mockVisitFindMany.mockResolvedValue([baseVisit]);
    mockMemberFindMany.mockResolvedValue([
      {
        ...baseMember,
        user: {
          ...baseMember.user,
          notificationPreference: { frequency: "off", emailEnabled: true },
        },
      },
    ]);

    const result = await runVisitReminderCron("day_before", NOW_FRI_19_JST);

    expect(result.skipped).toBe(1);
    expect(result.notified).toBe(0);
    expect(result.emailed).toBe(0);
    expect(result.pushed).toBe(0);
    // CRITICAL: no dedupe row, so the user can re-enable later.
    expect(mockSentCreate).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("runVisitReminderCron — push and email are independent", () => {
  it("push failure does NOT block the email leg", async () => {
    mockVisitFindMany.mockResolvedValue([baseVisit]);
    mockMemberFindMany.mockResolvedValue([baseMember]);
    mockSentCreate.mockResolvedValue({ id: "sent-1" });
    mockSendPushToUser.mockRejectedValue(new Error("push provider down"));

    const result = await runVisitReminderCron("day_before", NOW_FRI_19_JST);

    expect(result.notified).toBe(1);
    expect(result.emailed).toBe(1); // email still went through
    expect(result.pushed).toBe(0);
    expect(result.errored).toBe(0); // push failure doesn't trip the loop catch
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("emailEnabled=false silences only email; push and in-app still fire", async () => {
    mockVisitFindMany.mockResolvedValue([baseVisit]);
    mockMemberFindMany.mockResolvedValue([
      {
        ...baseMember,
        user: {
          ...baseMember.user,
          notificationPreference: { frequency: "auto", emailEnabled: false },
        },
      },
    ]);
    mockSentCreate.mockResolvedValue({ id: "sent-1" });

    const result = await runVisitReminderCron("day_before", NOW_FRI_19_JST);

    expect(result.notified).toBe(1);
    expect(result.pushed).toBe(1);
    expect(result.emailed).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("runVisitReminderCron — phase windows", () => {
  it("rejects out-of-window candidates without sending (defence in depth)", async () => {
    // Visit 5 days from now — outside any phase window. The query already
    // filters by 50h, but if a future query change ever returns it, the
    // per-visit window check should still reject it.
    const farFuture = {
      ...baseVisit,
      scheduledAt: new Date(NOW_FRI_19_JST.getTime() + 5 * 24 * 60 * 60 * 1000),
    };
    mockVisitFindMany.mockResolvedValue([farFuture]);

    const result = await runVisitReminderCron("day_before", NOW_FRI_19_JST);

    expect(result.skipped).toBe(1);
    expect(result.notified).toBe(0);
    expect(mockMemberFindMany).not.toHaveBeenCalled();
  });

  it("way_home queries past-today visits with status in {scheduled, completed}", async () => {
    const NOW_FRI_22_JST = new Date(Date.UTC(2026, 4, 15, 13, 0, 0));
    const visitedToday = {
      ...baseVisit,
      scheduledAt: new Date(Date.UTC(2026, 4, 15, 5, 0, 0)), // 5/15 14 JST
    };
    mockVisitFindMany.mockResolvedValue([visitedToday]);
    mockMemberFindMany.mockResolvedValue([baseMember]);
    mockSentCreate.mockResolvedValue({ id: "sent-1" });

    const result = await runVisitReminderCron("way_home", NOW_FRI_22_JST);

    expect(result.notified).toBe(1);
    // Verify the query was scoped to past-today via status filter shape.
    const queryArgs = mockVisitFindMany.mock.calls[0][0];
    expect(queryArgs.where.status).toEqual({ in: ["scheduled", "completed"] });
    expect(queryArgs.where.scheduledAt).toHaveProperty("gte");
    expect(queryArgs.where.scheduledAt).toHaveProperty("lt");
  });
});

describe("runVisitReminderCron — multi-member fan-out", () => {
  it("two members both get dedupe rows + delivery; one P2002 doesn't block the other", async () => {
    mockVisitFindMany.mockResolvedValue([baseVisit]);
    mockMemberFindMany.mockResolvedValue([
      baseMember,
      {
        ...baseMember,
        userId: "user-B",
        user: { ...baseMember.user, email: "partner@example.com" },
      },
    ]);
    // First member wins, second member loses the race (already-booked by
    // a previous tick). Result: 1 notified, 1 skipped — no crash.
    mockSentCreate
      .mockResolvedValueOnce({ id: "sent-A" })
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("dup", {
          code: "P2002",
          clientVersion: "stub",
        }),
      );

    const result = await runVisitReminderCron("day_before", NOW_FRI_19_JST);

    expect(result.notified).toBe(1);
    expect(result.emailed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendPushToUser).toHaveBeenCalledTimes(1);
  });
});
