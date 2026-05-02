import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Track B-3 — per-timing toggle server action coverage.
 *
 * Pins the contract the dispatcher relies on:
 *   - validation rejects bad phase / non-boolean BEFORE auth
 *   - upsert maps phase → boolean column atomically
 *   - first-time toggle CREATES the preference row with defaults
 *     (existing users without a row don't lose `auto` frequency)
 *   - DB failure surfaces a user-safe error (no exception)
 */

const mockUpsert = vi.fn();
const mockFindUnique = vi.fn();
const mockRequireUser = vi.fn();
const mockCaptureError = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    notificationPreference: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: (...a: unknown[]) => mockCaptureError(...a),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
  revalidateTag: vi.fn(),
}));

import {
  updateVisitReminderTiming,
  updatePartnerActivityToggle,
  getMyNotificationPreference,
} from "@/server/actions/notification-preferences";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1" });
});

describe("updateVisitReminderTiming — validation", () => {
  it("rejects an unknown phase BEFORE touching the DB", async () => {
    const result = await updateVisitReminderTiming({
      // @ts-expect-error — testing the runtime guard
      phase: "lunchtime",
      enabled: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/不正/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects non-boolean enabled BEFORE touching the DB", async () => {
    const result = await updateVisitReminderTiming({
      phase: "day_before",
      // @ts-expect-error — testing the runtime guard
      enabled: "yes",
    });
    expect(result.ok).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("updateVisitReminderTiming — upsert composition", () => {
  it("maps day_before → remindersDayBefore column", async () => {
    mockUpsert.mockResolvedValue({});
    const result = await updateVisitReminderTiming({
      phase: "day_before",
      enabled: false,
    });
    expect(result).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const args = mockUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: "user-1" });
    expect(args.update).toEqual({ remindersDayBefore: false });
    expect(args.create).toMatchObject({
      userId: "user-1",
      remindersDayBefore: false,
      // Other timing columns inherit schema defaults — explicitly NOT
      // set on the create branch so a future schema default change
      // doesn't get silently overridden by the upsert.
      emailEnabled: true,
      pushEnabled: false,
    });
    expect(args.create).not.toHaveProperty("remindersMorningOf");
    expect(args.create).not.toHaveProperty("remindersWayHome");
  });

  it("maps morning_of → remindersMorningOf column", async () => {
    mockUpsert.mockResolvedValue({});
    await updateVisitReminderTiming({ phase: "morning_of", enabled: true });
    const args = mockUpsert.mock.calls[0][0];
    expect(args.update).toEqual({ remindersMorningOf: true });
    expect(args.create.remindersMorningOf).toBe(true);
  });

  it("maps way_home → remindersWayHome column", async () => {
    mockUpsert.mockResolvedValue({});
    await updateVisitReminderTiming({ phase: "way_home", enabled: false });
    const args = mockUpsert.mock.calls[0][0];
    expect(args.update).toEqual({ remindersWayHome: false });
    expect(args.create.remindersWayHome).toBe(false);
  });

  it("revalidates /settings on success so a back-nav doesn't show stale state", async () => {
    mockUpsert.mockResolvedValue({});
    await updateVisitReminderTiming({ phase: "day_before", enabled: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("captures DB failure and returns a user-safe error (no throw)", async () => {
    mockUpsert.mockRejectedValue(new Error("connection timeout"));
    const result = await updateVisitReminderTiming({
      phase: "way_home",
      enabled: false,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/失敗/);
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("getMyNotificationPreference — defaults", () => {
  it("returns all-true reminder timings when no row exists yet", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getMyNotificationPreference();

    expect(result.reminderTimings).toEqual({
      dayBefore: true,
      morningOf: true,
      wayHome: true,
    });
    expect(result.frequency).toBe("auto");
  });

  it("projects all 3 reminder columns when a row exists", async () => {
    mockFindUnique.mockResolvedValue({
      frequency: "quiet",
      emailEnabled: false,
      pushEnabled: true,
      remindersDayBefore: true,
      remindersMorningOf: false,
      remindersWayHome: true,
      // P3 L3 W2 — 4 new partner-activity columns. All defaulted to
      // true by the schema; tests below cover the false case.
      notifyPartnerRating: true,
      notifyPartnerNote: true,
      notifyDecisionSaved: true,
      notifyWeddingDateSet: true,
    });

    const result = await getMyNotificationPreference();

    expect(result.reminderTimings).toEqual({
      dayBefore: true,
      morningOf: false,
      wayHome: true,
    });
    expect(result.frequency).toBe("quiet");
    expect(result.emailEnabled).toBe(false);
    expect(result.pushEnabled).toBe(true);
  });
});

describe("getMyNotificationPreference — P3 L3 W2 partner activity", () => {
  it("returns all-true partner activity flags when no row exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getMyNotificationPreference();

    expect(result.partnerActivity).toEqual({
      partnerRating: true,
      partnerNote: true,
      decisionSaved: true,
      weddingDateSet: true,
    });
  });

  it("projects all 4 partner activity columns when a row exists (mixed values)", async () => {
    mockFindUnique.mockResolvedValue({
      frequency: "auto",
      emailEnabled: true,
      pushEnabled: true,
      remindersDayBefore: true,
      remindersMorningOf: true,
      remindersWayHome: true,
      notifyPartnerRating: true,
      notifyPartnerNote: false,
      notifyDecisionSaved: true,
      notifyWeddingDateSet: false,
    });

    const result = await getMyNotificationPreference();

    expect(result.partnerActivity).toEqual({
      partnerRating: true,
      partnerNote: false,
      decisionSaved: true,
      weddingDateSet: false,
    });
  });
});

describe("updatePartnerActivityToggle — validation", () => {
  it("rejects an unknown event BEFORE touching the DB", async () => {
    const result = await updatePartnerActivityToggle({
      // @ts-expect-error — testing the runtime guard
      event: "ghost_appeared",
      enabled: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/不正/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects non-boolean enabled BEFORE touching the DB", async () => {
    const result = await updatePartnerActivityToggle({
      event: "partner_rating_added",
      // @ts-expect-error — testing the runtime guard
      enabled: 1,
    });
    expect(result.ok).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("updatePartnerActivityToggle — upsert composition", () => {
  it("maps partner_rating_added → notifyPartnerRating column", async () => {
    mockUpsert.mockResolvedValue({});
    const result = await updatePartnerActivityToggle({
      event: "partner_rating_added",
      enabled: false,
    });
    expect(result).toEqual({ ok: true });
    const args = mockUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: "user-1" });
    expect(args.update).toEqual({ notifyPartnerRating: false });
    expect(args.create).toMatchObject({
      userId: "user-1",
      notifyPartnerRating: false,
      emailEnabled: true,
      pushEnabled: false,
    });
    // CRITICAL: the other 3 partner columns are NOT in the create
    // payload — they must inherit the schema default (true).
    expect(args.create).not.toHaveProperty("notifyPartnerNote");
    expect(args.create).not.toHaveProperty("notifyDecisionSaved");
    expect(args.create).not.toHaveProperty("notifyWeddingDateSet");
  });

  it("maps partner_note_added → notifyPartnerNote column", async () => {
    mockUpsert.mockResolvedValue({});
    await updatePartnerActivityToggle({
      event: "partner_note_added",
      enabled: true,
    });
    expect(mockUpsert.mock.calls[0][0].update).toEqual({
      notifyPartnerNote: true,
    });
  });

  it("maps decision_saved → notifyDecisionSaved column", async () => {
    mockUpsert.mockResolvedValue({});
    await updatePartnerActivityToggle({
      event: "decision_saved",
      enabled: false,
    });
    expect(mockUpsert.mock.calls[0][0].update).toEqual({
      notifyDecisionSaved: false,
    });
  });

  it("maps wedding_date_set → notifyWeddingDateSet column", async () => {
    mockUpsert.mockResolvedValue({});
    await updatePartnerActivityToggle({
      event: "wedding_date_set",
      enabled: true,
    });
    expect(mockUpsert.mock.calls[0][0].update).toEqual({
      notifyWeddingDateSet: true,
    });
  });

  it("revalidates /settings on success", async () => {
    mockUpsert.mockResolvedValue({});
    await updatePartnerActivityToggle({
      event: "partner_rating_added",
      enabled: true,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("captures DB failure and returns user-safe error", async () => {
    mockUpsert.mockRejectedValue(new Error("connection lost"));
    const result = await updatePartnerActivityToggle({
      event: "partner_rating_added",
      enabled: false,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/失敗/);
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
