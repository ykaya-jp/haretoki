import { describe, it, expect } from "vitest";
import {
  pickReminderCopy,
  pickVenueKind,
  visitReminderDedupeDateKey,
  TIMING_FOR_PHASE,
  PUSH_TITLE_MAX,
  PUSH_BODY_MAX,
  type ReminderTiming,
  type VenueKind,
} from "@/lib/visit-reminder/copy";

/**
 * Track B-2 copy table coverage. Pinned to docs/ai/notifications/visit-
 * reminder.md content — if these specs fail, the copy table drifted from
 * the design doc and the drift hook should already be screaming. Either
 * fix the table or sync the spec; never just delete the assertion.
 */

describe("pickVenueKind", () => {
  it("returns 'fallback' for null / undefined / empty", () => {
    expect(pickVenueKind(null)).toBe("fallback");
    expect(pickVenueKind(undefined)).toBe("fallback");
    expect(pickVenueKind([])).toBe("fallback");
  });

  it("classifies chapel-flavoured ceremonyStyles", () => {
    expect(pickVenueKind(["chapel"])).toBe("chapel");
    expect(pickVenueKind(["Christian"])).toBe("chapel");
    expect(pickVenueKind(["catholic-style"])).toBe("chapel");
  });

  it("classifies garden / outdoor / resort venues", () => {
    expect(pickVenueKind(["garden"])).toBe("garden");
    expect(pickVenueKind(["resort hotel"])).toBe("garden");
    expect(pickVenueKind(["outdoor terrace"])).toBe("garden");
  });

  it("classifies hotel / banquet / ballroom venues", () => {
    expect(pickVenueKind(["hotel"])).toBe("hotel");
    expect(pickVenueKind(["Grand Ballroom"])).toBe("hotel");
    expect(pickVenueKind(["banquet hall"])).toBe("hotel");
  });

  it("returns 'fallback' for unknown styles", () => {
    expect(pickVenueKind(["restaurant", "cruise"])).toBe("fallback");
  });

  it("first-match wins (chapel before garden when both keywords present)", () => {
    // The rules array orders chapel first, so a venue tagged with both
    // "garden chapel" should classify as chapel — matches B-0 doc order.
    expect(pickVenueKind(["garden chapel"])).toBe("chapel");
  });

  it("matching is case-insensitive", () => {
    expect(pickVenueKind(["CHAPEL"])).toBe("chapel");
    expect(pickVenueKind(["HOTEL"])).toBe("hotel");
  });
});

describe("TIMING_FOR_PHASE", () => {
  it("maps every phase to its B-0 timing label", () => {
    expect(TIMING_FOR_PHASE.day_before).toBe("T-24h");
    expect(TIMING_FOR_PHASE.morning_of).toBe("T-1h");
    expect(TIMING_FOR_PHASE.way_home).toBe("T+30m");
  });
});

describe("pickReminderCopy — every (timing × venueKind) cell is reachable", () => {
  // Mechanical 12-cell sweep ensures the table never has a missing entry —
  // B-0 promises 3 timings × 4 kinds = 12 cells, all populated.
  const TIMINGS: ReminderTiming[] = ["T-24h", "T-1h", "T+30m"];
  const KINDS: VenueKind[] = ["chapel", "garden", "hotel", "fallback"];

  for (const timing of TIMINGS) {
    for (const venueKind of KINDS) {
      it(`returns non-empty title+body for (${timing}, ${venueKind})`, () => {
        const out = pickReminderCopy({
          timing,
          venueKind,
          venueName: "テスト式場",
        });
        expect(out.title.length).toBeGreaterThan(0);
        expect(out.body.length).toBeGreaterThan(0);
      });
    }
  }
});

describe("pickReminderCopy — variable interpolation", () => {
  it("substitutes {venueName}", () => {
    const out = pickReminderCopy({
      timing: "T-24h",
      venueKind: "chapel",
      venueName: "ガーデンテラス青山",
    });
    expect(out.title).toContain("ガーデンテラス青山");
  });

  it("does not leak {venueName} placeholder when substituted", () => {
    const out = pickReminderCopy({
      timing: "T-1h",
      venueKind: "hotel",
      venueName: "X",
    });
    expect(out.title).not.toContain("{venueName}");
    expect(out.body).not.toContain("{venueName}");
  });

  it("strips HTML tags from venueName (XSS / future inbox HTML rendering defence)", () => {
    const out = pickReminderCopy({
      timing: "T-24h",
      venueKind: "fallback",
      venueName: "<script>alert(1)</script>会場",
    });
    expect(out.title).not.toContain("<");
    expect(out.title).not.toContain("script");
    expect(out.title).toContain("会場");
  });

  it("collapses runs of whitespace inside venueName", () => {
    const out = pickReminderCopy({
      timing: "T-24h",
      venueKind: "garden",
      venueName: "東京  ガーデン  ホール",
    });
    expect(out.title).toContain("東京 ガーデン ホール");
  });

  it("caps title at PUSH_TITLE_MAX even with a pathologically long venueName", () => {
    const longName = "あ".repeat(200);
    const out = pickReminderCopy({
      timing: "T-24h",
      venueKind: "fallback",
      venueName: longName,
    });
    expect(out.title.length).toBeLessThanOrEqual(PUSH_TITLE_MAX);
  });

  it("caps body at PUSH_BODY_MAX", () => {
    const longName = "あ".repeat(500);
    const out = pickReminderCopy({
      timing: "T+30m",
      venueKind: "fallback",
      venueName: longName,
    });
    expect(out.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX);
  });
});

describe("visitReminderDedupeDateKey — designer warning: scheduledAt invalidation", () => {
  it("returns the JST date key for a visit instant", () => {
    // 2026-05-15 14:00 JST = 2026-05-15 05:00 UTC
    const utc = new Date(Date.UTC(2026, 4, 15, 5, 0, 0));
    expect(visitReminderDedupeDateKey(utc)).toBe("2026-05-15");
  });

  it("DIFFERENT keys when scheduledAt moves to a different JST day (rescheduled)", () => {
    // CRITICAL invariant per designer warning: dedupe key must include
    // the scheduled date so a re-scheduled visit is NOT suppressed by
    // the prior dedupe row.
    const original = new Date(Date.UTC(2026, 4, 15, 5, 0, 0)); // 5/15 JST
    const rescheduled = new Date(Date.UTC(2026, 4, 22, 5, 0, 0)); // 5/22 JST
    expect(visitReminderDedupeDateKey(original)).not.toEqual(
      visitReminderDedupeDateKey(rescheduled),
    );
  });

  it("SAME key when scheduledAt only shifts within the same JST day (cron should not re-send)", () => {
    // Same-day time tweaks reuse the dedupe key so the cron doesn't spam
    // the user. This is the desired behaviour — the user got the morning
    // notification at 8 JST already; moving the visit from 14:00 to
    // 16:00 same day shouldn't fire a second send.
    const morning = new Date(Date.UTC(2026, 4, 15, 5, 0, 0)); // 14:00 JST
    const afternoon = new Date(Date.UTC(2026, 4, 15, 7, 0, 0)); // 16:00 JST
    expect(visitReminderDedupeDateKey(morning)).toEqual(
      visitReminderDedupeDateKey(afternoon),
    );
  });
});
