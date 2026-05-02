import { describe, it, expect } from "vitest";
import {
  isVisitInPhaseWindow,
  jstDateKey,
  jstTomorrowDateKey,
  visitReminderType,
} from "@/lib/visit-reminders";

/**
 * All fixtures use UTC Date instants but reason about JST wall-clock time.
 * The +9h offset is applied inside the helpers themselves; the test
 * fixtures intentionally state the JST reference in comments so the
 * wall-clock semantics stay easy to audit.
 */

// 2026-05-15 (Friday) 19:00 JST  =  2026-05-15 10:00 UTC (the day_before cron fire moment)
const FRI_19_JST = new Date(Date.UTC(2026, 4, 15, 10, 0, 0));
// 2026-05-15 (Friday) 08:00 JST  =  2026-05-14 23:00 UTC (the morning_of cron fire moment)
const FRI_08_JST = new Date(Date.UTC(2026, 4, 14, 23, 0, 0));

describe("jstDateKey", () => {
  it("returns the JST calendar date for a UTC instant inside the same JST day", () => {
    // 2026-05-15 19:00 JST → 2026-05-15
    expect(jstDateKey(FRI_19_JST)).toBe("2026-05-15");
  });

  it("crosses the date boundary correctly when UTC and JST disagree", () => {
    // 2026-05-15 16:00 UTC = 2026-05-16 01:00 JST → tomorrow JST
    const utc = new Date(Date.UTC(2026, 4, 15, 16, 0, 0));
    expect(jstDateKey(utc)).toBe("2026-05-16");
  });

  it("zero-pads month and day", () => {
    // 2026-01-05 00:00 UTC = 2026-01-05 09:00 JST
    const utc = new Date(Date.UTC(2026, 0, 5, 0, 0, 0));
    expect(jstDateKey(utc)).toBe("2026-01-05");
  });
});

describe("jstTomorrowDateKey", () => {
  it("returns the JST date 24h after the given instant", () => {
    expect(jstTomorrowDateKey(FRI_19_JST)).toBe("2026-05-16");
  });

  it("rolls month boundaries", () => {
    // 2026-05-31 19:00 JST → tomorrow = 2026-06-01
    const utc = new Date(Date.UTC(2026, 4, 31, 10, 0, 0));
    expect(jstTomorrowDateKey(utc)).toBe("2026-06-01");
  });
});

describe("isVisitInPhaseWindow — day_before", () => {
  it("matches when visit JST date equals tomorrow JST date", () => {
    // Visit at 2026-05-16 (Saturday) 14:00 JST
    const scheduledAt = new Date(Date.UTC(2026, 4, 16, 5, 0, 0));
    expect(
      isVisitInPhaseWindow("day_before", { scheduledAt, now: FRI_19_JST }),
    ).toBe(true);
  });

  it("does NOT match when visit JST date equals today JST (handled by morning_of)", () => {
    // Visit at 2026-05-15 23:00 JST — same JST calendar day as the
    // 19 JST cron fire. day_before should defer to morning_of for this.
    const scheduledAt = new Date(Date.UTC(2026, 4, 15, 14, 0, 0));
    expect(
      isVisitInPhaseWindow("day_before", { scheduledAt, now: FRI_19_JST }),
    ).toBe(false);
  });

  it("does NOT match when visit is two days away", () => {
    // Visit at 2026-05-17 14:00 JST → +2 JST days
    const scheduledAt = new Date(Date.UTC(2026, 4, 17, 5, 0, 0));
    expect(
      isVisitInPhaseWindow("day_before", { scheduledAt, now: FRI_19_JST }),
    ).toBe(false);
  });

  it("works across the JST month boundary", () => {
    // Cron fires 2026-05-31 19:00 JST, visit at 2026-06-01 morning JST
    const now = new Date(Date.UTC(2026, 4, 31, 10, 0, 0));
    const scheduledAt = new Date(Date.UTC(2026, 5, 1, 1, 0, 0)); // 2026-06-01 10:00 JST
    expect(
      isVisitInPhaseWindow("day_before", { scheduledAt, now }),
    ).toBe(true);
  });
});

describe("isVisitInPhaseWindow — morning_of", () => {
  it("matches when visit JST date equals today JST date", () => {
    // Cron fires 2026-05-15 08:00 JST. Visit at 2026-05-15 13:00 JST.
    const scheduledAt = new Date(Date.UTC(2026, 4, 15, 4, 0, 0));
    expect(
      isVisitInPhaseWindow("morning_of", { scheduledAt, now: FRI_08_JST }),
    ).toBe(true);
  });

  it("does NOT match when visit is tomorrow JST (handled by day_before)", () => {
    // Cron fires 2026-05-15 08:00 JST. Visit at 2026-05-16 morning JST.
    const scheduledAt = new Date(Date.UTC(2026, 4, 15, 22, 0, 0));
    expect(
      isVisitInPhaseWindow("morning_of", { scheduledAt, now: FRI_08_JST }),
    ).toBe(false);
  });

  it("does NOT match when visit is yesterday JST (already past)", () => {
    // Cron fires 2026-05-15 08:00 JST. Visit at 2026-05-14 14:00 JST → past
    const scheduledAt = new Date(Date.UTC(2026, 4, 14, 5, 0, 0));
    expect(
      isVisitInPhaseWindow("morning_of", { scheduledAt, now: FRI_08_JST }),
    ).toBe(false);
  });
});

describe("isVisitInPhaseWindow — way_home (Track B-2)", () => {
  // Cron fires 2026-05-15 22:00 JST = 2026-05-15 13:00 UTC
  const FRI_22_JST = new Date(Date.UTC(2026, 4, 15, 13, 0, 0));

  it("matches when the visit happened earlier today JST", () => {
    // Visit at 2026-05-15 14:00 JST (8h before the 22 JST cron)
    const scheduledAt = new Date(Date.UTC(2026, 4, 15, 5, 0, 0));
    expect(
      isVisitInPhaseWindow("way_home", { scheduledAt, now: FRI_22_JST }),
    ).toBe(true);
  });

  it("does NOT match when the visit is later this evening (still upcoming)", () => {
    // Visit at 2026-05-15 23:30 JST — same day but still future at 22 JST
    const scheduledAt = new Date(Date.UTC(2026, 4, 15, 14, 30, 0));
    expect(
      isVisitInPhaseWindow("way_home", { scheduledAt, now: FRI_22_JST }),
    ).toBe(false);
  });

  it("does NOT match when the visit was yesterday (out of recap window)", () => {
    const scheduledAt = new Date(Date.UTC(2026, 4, 14, 5, 0, 0)); // 5/14 14:00 JST
    expect(
      isVisitInPhaseWindow("way_home", { scheduledAt, now: FRI_22_JST }),
    ).toBe(false);
  });

  it("matches across the JST boundary (JST today, UTC yesterday)", () => {
    // Cron fires 2026-05-15 22:00 JST = 13:00 UTC same day; visit at
    // 2026-05-15 09:00 JST = 2026-05-15 00:00 UTC — both same JST day.
    const scheduledAt = new Date(Date.UTC(2026, 4, 15, 0, 0, 0));
    expect(
      isVisitInPhaseWindow("way_home", { scheduledAt, now: FRI_22_JST }),
    ).toBe(true);
  });
});

describe("isVisitInPhaseWindow — guards", () => {
  it("returns false for past visits regardless of phase (data-anomaly guard)", () => {
    const scheduledAt = new Date(FRI_19_JST.getTime() - 60 * 60 * 1000);
    expect(
      isVisitInPhaseWindow("day_before", { scheduledAt, now: FRI_19_JST }),
    ).toBe(false);
    expect(
      isVisitInPhaseWindow("morning_of", { scheduledAt, now: FRI_19_JST }),
    ).toBe(false);
  });

  it("returns false at delta=0 (visit literally now)", () => {
    expect(
      isVisitInPhaseWindow("day_before", {
        scheduledAt: FRI_19_JST,
        now: FRI_19_JST,
      }),
    ).toBe(false);
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
  });

  it("returns distinct strings per phase so dedupe across phases is safe", () => {
    const visitId = "v-1";
    expect(visitReminderType("day_before", visitId)).not.toEqual(
      visitReminderType("morning_of", visitId),
    );
  });
});
