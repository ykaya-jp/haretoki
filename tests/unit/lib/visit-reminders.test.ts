import { describe, it, expect } from "vitest";
import {
  classifyVisitReminderPhase,
  visitReminderType,
} from "@/lib/visit-reminders";

/**
 * All fixtures use UTC Date instants but reason about JST wall-clock time.
 * The ±9h offset is applied inside `classifyVisitReminderPhase` itself; the
 * test fixtures intentionally state the JST reference in comments so the
 * wall-clock semantics stay easy to audit.
 */

// 2026-05-15 (Friday) 18:00 JST  =  2026-05-15 09:00 UTC
const FRI_18_JST = new Date(Date.UTC(2026, 4, 15, 9, 0, 0));
// 2026-05-15 (Friday) 08:00 JST  =  2026-05-14 23:00 UTC
const FRI_08_JST = new Date(Date.UTC(2026, 4, 14, 23, 0, 0));
// 2026-05-15 (Friday) 13:00 JST  =  2026-05-15 04:00 UTC
const FRI_13_JST = new Date(Date.UTC(2026, 4, 15, 4, 0, 0));

describe("classifyVisitReminderPhase", () => {
  describe("day_before", () => {
    it("fires at 18 JST when visit is tomorrow JST", () => {
      // Visit at 2026-05-16 (Saturday) 14:00 JST
      const scheduledAt = new Date(Date.UTC(2026, 4, 16, 5, 0, 0));
      const phase = classifyVisitReminderPhase({
        scheduledAt,
        now: FRI_18_JST,
      });
      expect(phase).toBe("day_before");
    });

    it("fires at 20 JST (last hour of evening window)", () => {
      // 2026-05-15 20:00 JST = 11:00 UTC
      const now = new Date(Date.UTC(2026, 4, 15, 11, 0, 0));
      const scheduledAt = new Date(Date.UTC(2026, 4, 16, 5, 0, 0));
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBe(
        "day_before",
      );
    });

    it("does NOT fire at 17 JST (before window opens)", () => {
      const now = new Date(Date.UTC(2026, 4, 15, 8, 0, 0)); // 17:00 JST
      const scheduledAt = new Date(Date.UTC(2026, 4, 16, 5, 0, 0));
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBeNull();
    });

    it("does NOT fire at 21 JST (after window closes)", () => {
      const now = new Date(Date.UTC(2026, 4, 15, 12, 0, 0)); // 21:00 JST
      const scheduledAt = new Date(Date.UTC(2026, 4, 16, 5, 0, 0));
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBeNull();
    });

    it("does NOT fire when visit is two days away", () => {
      // Visit Sunday 2026-05-17 14:00 JST
      const scheduledAt = new Date(Date.UTC(2026, 4, 17, 5, 0, 0));
      expect(
        classifyVisitReminderPhase({ scheduledAt, now: FRI_18_JST }),
      ).toBeNull();
    });
  });

  describe("morning_of", () => {
    it("fires at 8 JST when visit is later today JST with > 3h runway", () => {
      // Visit at 2026-05-15 13:00 JST (5h away)
      const phase = classifyVisitReminderPhase({
        scheduledAt: FRI_13_JST,
        now: FRI_08_JST,
      });
      expect(phase).toBe("morning_of");
    });

    it("fires at 7 JST (start of window)", () => {
      const now = new Date(Date.UTC(2026, 4, 14, 22, 0, 0)); // 7:00 JST
      // Visit 11:00 JST (4h away)
      const scheduledAt = new Date(Date.UTC(2026, 4, 15, 2, 0, 0));
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBe(
        "morning_of",
      );
    });

    it("does NOT fire at 6 JST (before window opens)", () => {
      const now = new Date(Date.UTC(2026, 4, 14, 21, 0, 0)); // 6:00 JST
      const scheduledAt = new Date(Date.UTC(2026, 4, 15, 4, 0, 0));
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBeNull();
    });

    it("does NOT fire at 10 JST (after window closes)", () => {
      const now = new Date(Date.UTC(2026, 4, 15, 1, 0, 0)); // 10:00 JST
      const scheduledAt = new Date(Date.UTC(2026, 4, 15, 8, 0, 0)); // 17:00 JST
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBeNull();
    });

    it("falls through to before_departure when visit is < 3h away", () => {
      // Visit at 10:00 JST (2h away from 8 JST). 3h floor on morning_of
      // protects the before_departure handover.
      const scheduledAt = new Date(Date.UTC(2026, 4, 15, 1, 0, 0));
      const phase = classifyVisitReminderPhase({
        scheduledAt,
        now: FRI_08_JST,
      });
      expect(phase).toBe("before_departure");
    });
  });

  describe("before_departure", () => {
    it("fires when visit is exactly 2h away", () => {
      const scheduledAt = new Date(FRI_13_JST.getTime());
      const now = new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1000);
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBe(
        "before_departure",
      );
    });

    it("fires at 1.5h floor", () => {
      const scheduledAt = new Date(FRI_13_JST.getTime());
      const now = new Date(scheduledAt.getTime() - 1.5 * 60 * 60 * 1000);
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBe(
        "before_departure",
      );
    });

    it("fires at 2.5h ceiling", () => {
      const scheduledAt = new Date(FRI_13_JST.getTime());
      const now = new Date(scheduledAt.getTime() - 2.5 * 60 * 60 * 1000);
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBe(
        "before_departure",
      );
    });

    it("does NOT fire when visit is 1h away (too close — no useful runway)", () => {
      const scheduledAt = new Date(FRI_13_JST.getTime());
      const now = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBeNull();
    });

    it("does NOT fire when visit is 3h away (above ceiling)", () => {
      const scheduledAt = new Date(FRI_13_JST.getTime());
      const now = new Date(scheduledAt.getTime() - 3 * 60 * 60 * 1000);
      expect(classifyVisitReminderPhase({ scheduledAt, now })).toBeNull();
    });
  });

  describe("guards", () => {
    it("returns null for past visits", () => {
      const scheduledAt = new Date(FRI_18_JST.getTime() - 60 * 60 * 1000);
      expect(
        classifyVisitReminderPhase({ scheduledAt, now: FRI_18_JST }),
      ).toBeNull();
    });

    it("returns null for in-progress (delta = 0)", () => {
      expect(
        classifyVisitReminderPhase({
          scheduledAt: FRI_18_JST,
          now: FRI_18_JST,
        }),
      ).toBeNull();
    });
  });
});

describe("visitReminderType", () => {
  it("encodes phase + visitId for exact-match dedupe", () => {
    expect(visitReminderType("day_before", "abc-123")).toBe(
      "visit_reminder_day_before:abc-123",
    );
    expect(visitReminderType("morning_of", "abc-123")).toBe(
      "visit_reminder_morning_of:abc-123",
    );
    expect(visitReminderType("before_departure", "abc-123")).toBe(
      "visit_reminder_before_departure:abc-123",
    );
  });

  it("returns distinct strings per phase so dedupe across phases is safe", () => {
    const visitId = "v-1";
    const types = (
      ["day_before", "morning_of", "before_departure"] as const
    ).map((p) => visitReminderType(p, visitId));
    expect(new Set(types).size).toBe(3);
  });
});
