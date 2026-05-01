import { describe, it, expect, vi } from "vitest";

// session-history-sheet.tsx imports the `SessionListItem` *type* from
// @/server/actions/coach for typing only, but the resolver still pulls
// in coach.ts → @/server/db → Prisma → DATABASE_URL. We don't need any
// of that here (groupSessions is pure), so stub the module out.
vi.mock("@/server/actions/coach", () => ({}));
vi.mock("@/server/db", () => ({ prisma: {} }));

import { groupSessions } from "@/components/coach/session-history-sheet";

/**
 * W21-6: bucket math for the coach session drawer.
 *
 * The function partitions sessions into 5 relative buckets anchored on
 * the user's local clock:
 *   今日 → 昨日 → 今週 (7 days) → 今月 → それ以前
 *
 * We pin `now` per test so the boundaries don't drift across runs.
 * Empty buckets are dropped by `groupSessions` (groups.filter(length>0)),
 * so each test asserts the returned shape, not all five labels.
 */

interface SessionShape {
  id: string;
  title: string | null;
  updatedAt: Date;
  preview: string;
}

function s(id: string, updatedAt: Date): SessionShape {
  return { id, title: null, updatedAt, preview: "" };
}

describe("groupSessions — relative buckets", () => {
  // Anchor "now" mid-month so 今月 has room above 今週 (≥ 8 days from
  // start-of-month). 2026-05-15 12:00 local — first day of the test
  // month is 2026-05-01, start-of-week is 2026-05-08 00:00.
  const now = new Date(2026, 4, 15, 12, 0, 0); // local time

  it("buckets a 'just now' session into 今日", () => {
    const result = groupSessions(
      [s("a", new Date(2026, 4, 15, 9, 30))],
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("今日");
    expect(result[0].items.map((i) => i.id)).toEqual(["a"]);
  });

  it("buckets a yesterday-evening session into 昨日, not 今日", () => {
    const result = groupSessions(
      [s("a", new Date(2026, 4, 14, 23, 59))],
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("昨日");
  });

  it("buckets a 3-days-ago session into 今週", () => {
    const result = groupSessions(
      [s("a", new Date(2026, 4, 12, 12, 0))],
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("今週");
  });

  it("buckets a same-month-but-older-than-7-days session into 今月", () => {
    // 2026-05-04 is in the same month but ≥ 8 days before 2026-05-15,
    // so it must land in 今月, not 今週.
    const result = groupSessions(
      [s("a", new Date(2026, 4, 4, 12, 0))],
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("今月");
  });

  it("buckets a previous-month session into それ以前", () => {
    const result = groupSessions(
      [s("a", new Date(2026, 3, 20, 12, 0))], // 2026-04-20
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("それ以前");
  });

  it("partitions a mixed set across all five buckets in declared order", () => {
    const sessions = [
      s("today", new Date(2026, 4, 15, 8, 0)),
      s("yesterday", new Date(2026, 4, 14, 18, 0)),
      s("this-week", new Date(2026, 4, 11, 10, 0)),
      s("this-month", new Date(2026, 4, 5, 10, 0)),
      s("prev-month", new Date(2026, 3, 30, 10, 0)),
    ];
    const result = groupSessions(sessions, now);
    expect(result.map((g) => g.label)).toEqual([
      "今日",
      "昨日",
      "今週",
      "今月",
      "それ以前",
    ]);
    expect(result.map((g) => g.items.map((i) => i.id))).toEqual([
      ["today"],
      ["yesterday"],
      ["this-week"],
      ["this-month"],
      ["prev-month"],
    ]);
  });

  it("drops empty buckets so the UI doesn't render dead headers", () => {
    // Only today + previous-month populated → drawer should render two
    // labels, not five with three empties.
    const result = groupSessions(
      [
        s("today", new Date(2026, 4, 15, 8, 0)),
        s("ages-ago", new Date(2026, 0, 1, 12, 0)),
      ],
      now,
    );
    expect(result.map((g) => g.label)).toEqual(["今日", "それ以前"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(groupSessions([], now)).toEqual([]);
  });

  it("when now sits in the first 7 days of the month, 今月 stays empty", () => {
    // 2026-06-03 — startOfWeek = 2026-05-27 (last month), startOfMonth
    // = 2026-06-01. Anything older than startOfWeek but newer than
    // startOfMonth would have to be inside [2026-06-01, 2026-05-27),
    // which is empty (startOfMonth > startOfWeek). 今月 must be filtered.
    const earlyMonthNow = new Date(2026, 5, 3, 12, 0);
    const sessions = [
      s("today", new Date(2026, 5, 3, 9, 0)),
      s("late-may", new Date(2026, 4, 28, 12, 0)), // → 今週
      s("early-may", new Date(2026, 4, 5, 12, 0)), // → それ以前 (before startOfWeek AND startOfMonth)
    ];
    const result = groupSessions(sessions, earlyMonthNow);
    // 今月 should be absent; either of 今週 / それ以前 may be present.
    expect(result.map((g) => g.label)).not.toContain("今月");
  });

  it("treats `now` as the boundary inclusive on the start side (≥ today)", () => {
    // A session whose updatedAt equals startOfToday (00:00:00 local)
    // must land in 今日.
    const startOfToday = new Date(2026, 4, 15, 0, 0, 0);
    const result = groupSessions([s("edge", startOfToday)], now);
    expect(result[0].label).toBe("今日");
  });
});
