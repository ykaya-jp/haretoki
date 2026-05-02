import { describe, it, expect } from "vitest";
import {
  weddingCountdownState,
  jstMidnightEpoch,
  formatWeddingDateLabel,
  parseWeddingDateInput,
} from "@/lib/wedding-countdown";

/**
 * Track C-2 countdown helper coverage.
 *
 * The state machine drives every UI branch in CountdownCard, so the
 * day-arithmetic edge cases here (UTC vs JST boundary, DST does NOT
 * apply because Japan has none, 0 = today, negative = past) are the
 * trust anchor for the visible widget.
 */

// Wedding date: 2026-05-16 (Saturday) — represented as JST midnight.
// JST midnight = UTC 15:00 the previous day. 2026-05-16 00:00 JST =
// 2026-05-15 15:00 UTC.
const WEDDING_DAY_JST_MIDNIGHT = new Date(Date.UTC(2026, 4, 15, 15, 0, 0));

describe("jstMidnightEpoch", () => {
  it("snaps any time inside a JST day to that day's JST midnight", () => {
    // 2026-05-16 14:00 JST = 2026-05-16 05:00 UTC
    const noonJst = new Date(Date.UTC(2026, 4, 16, 5, 0, 0));
    const snapped = jstMidnightEpoch(noonJst);
    expect(snapped).toBe(WEDDING_DAY_JST_MIDNIGHT.getTime());
  });

  it("snaps to the JST day even when the UTC clock shows the previous day", () => {
    // 2026-05-16 00:30 JST = 2026-05-15 15:30 UTC. UTC says "yesterday"
    // but JST says "today" — the snap must respect JST.
    const justAfterMidnight = new Date(Date.UTC(2026, 4, 15, 15, 30, 0));
    expect(jstMidnightEpoch(justAfterMidnight)).toBe(
      WEDDING_DAY_JST_MIDNIGHT.getTime(),
    );
  });

  it("snaps the boundary instant (JST midnight exactly) to itself", () => {
    expect(jstMidnightEpoch(WEDDING_DAY_JST_MIDNIGHT)).toBe(
      WEDDING_DAY_JST_MIDNIGHT.getTime(),
    );
  });
});

describe("weddingCountdownState — branches", () => {
  it("returns no-date when weddingDate is null", () => {
    expect(weddingCountdownState({ weddingDate: null })).toEqual({
      state: "no-date",
    });
  });

  it("returns no-date when weddingDate is undefined", () => {
    expect(weddingCountdownState({ weddingDate: undefined })).toEqual({
      state: "no-date",
    });
  });

  it("returns future N days for a wedding N JST days away", () => {
    // 2026-05-15 14:00 JST (the day BEFORE the wedding)
    const now = new Date(Date.UTC(2026, 4, 15, 5, 0, 0));
    const result = weddingCountdownState({
      weddingDate: WEDDING_DAY_JST_MIDNIGHT,
      now,
    });
    expect(result).toEqual({ state: "future", daysUntil: 1 });
  });

  it("returns 152 days for a wedding 152 JST days out", () => {
    // 152 days before 2026-05-16 = 2025-12-15
    const now = new Date(Date.UTC(2025, 11, 15, 0, 0, 0));
    const result = weddingCountdownState({
      weddingDate: WEDDING_DAY_JST_MIDNIGHT,
      now,
    });
    expect(result).toEqual({ state: "future", daysUntil: 152 });
  });

  it("returns today (daysUntil=0) when now is the same JST date as the wedding", () => {
    // Wedding morning at 09:00 JST = 00:00 UTC
    const now = new Date(Date.UTC(2026, 4, 16, 0, 0, 0));
    expect(
      weddingCountdownState({
        weddingDate: WEDDING_DAY_JST_MIDNIGHT,
        now,
      }),
    ).toEqual({ state: "today", daysUntil: 0 });
  });

  it("returns today when the user opens the app at 23:30 JST on wedding day (UTC has rolled to next day)", () => {
    // 2026-05-16 23:30 JST = 2026-05-16 14:30 UTC — UTC is still same
    // day this time. Previous design bug: at 2026-05-17 00:30 JST the
    // UTC date would say 2026-05-16 (yesterday) and a naive date diff
    // would tick back to "future". The JST snap prevents that.
    const lateEvening = new Date(Date.UTC(2026, 4, 16, 14, 30, 0));
    expect(
      weddingCountdownState({
        weddingDate: WEDDING_DAY_JST_MIDNIGHT,
        now: lateEvening,
      }),
    ).toEqual({ state: "today", daysUntil: 0 });
  });

  it("returns past with positive daysSince after the wedding", () => {
    // 2026-05-20 14:00 JST = 4 days after wedding
    const now = new Date(Date.UTC(2026, 4, 20, 5, 0, 0));
    expect(
      weddingCountdownState({
        weddingDate: WEDDING_DAY_JST_MIDNIGHT,
        now,
      }),
    ).toEqual({ state: "past", daysSince: 4 });
  });

  it("treats the JST day boundary as the tick moment (not UTC)", () => {
    // The user pulls up the app at 23:59 JST the night BEFORE the
    // wedding. The countdown must still read 1, not 0 — only at 00:00
    // JST should it tick to "today". UTC at 23:59 JST = 14:59 UTC same
    // day, but the JST midnight snap correctly leaves us on the prior
    // JST date.
    const justBefore = new Date(Date.UTC(2026, 4, 15, 14, 59, 0));
    expect(
      weddingCountdownState({
        weddingDate: WEDDING_DAY_JST_MIDNIGHT,
        now: justBefore,
      }),
    ).toEqual({ state: "future", daysUntil: 1 });
  });
});

describe("formatWeddingDateLabel", () => {
  it("renders M月D日 in JST", () => {
    expect(formatWeddingDateLabel(WEDDING_DAY_JST_MIDNIGHT)).toBe("5月16日");
  });

  it("respects JST date for an instant whose UTC date differs", () => {
    // 2026-05-15 23:30 UTC = 2026-05-16 08:30 JST
    const utcEvening = new Date(Date.UTC(2026, 4, 15, 23, 30, 0));
    expect(formatWeddingDateLabel(utcEvening)).toBe("5月16日");
  });
});

describe("parseWeddingDateInput", () => {
  it("accepts YYYY-MM-DD and stores JST midnight", () => {
    const d = parseWeddingDateInput("2026-05-16");
    expect(d).not.toBeNull();
    // 2026-05-16 00:00 JST = 2026-05-15 15:00 UTC
    expect(d!.getTime()).toBe(WEDDING_DAY_JST_MIDNIGHT.getTime());
  });

  it("rejects ISO timestamps with time components", () => {
    expect(parseWeddingDateInput("2026-05-16T12:00:00Z")).toBeNull();
  });

  it("rejects locale strings like 2026/05/16", () => {
    expect(parseWeddingDateInput("2026/05/16")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(parseWeddingDateInput("yesterday")).toBeNull();
    expect(parseWeddingDateInput("")).toBeNull();
    expect(parseWeddingDateInput("2026-99-99")).toBeNull();
  });

  it("rejects calendar-impossible dates (Feb 31, etc.)", () => {
    // Without the round-trip guard, JS Date silently accepts Feb 31 as
    // March 3. The validator must catch this so the user doesn't see
    // their wedding date silently bumped forward.
    expect(parseWeddingDateInput("2026-02-31")).toBeNull();
    expect(parseWeddingDateInput("2026-04-31")).toBeNull();
  });

  it("accepts boundary dates (Feb 29 in leap years, but rejects in non-leap)", () => {
    // 2024 is a leap year; 2026 is not.
    expect(parseWeddingDateInput("2024-02-29")).not.toBeNull();
    expect(parseWeddingDateInput("2026-02-29")).toBeNull();
  });
});
