import { describe, it, expect } from "vitest";
import {
  aggregateActionCounts,
  aggregateDailyCounts,
  detectSuspiciousAuditPatterns,
  maxCount,
  type AuditRowLite,
} from "@/lib/audit-aggregations";

/**
 * Pin the audit chart + anomaly thresholds. Production thresholds
 * change rarely, so any threshold flip lands here as one obvious
 * diff alongside the rule edit.
 */

function row(overrides: Partial<AuditRowLite> & { hoursAgo?: number }): AuditRowLite {
  const NOW = new Date("2026-05-02T12:00:00Z");
  const hoursAgo = overrides.hoursAgo ?? 0;
  return {
    action: overrides.action ?? "user.export",
    actorId: overrides.actorId ?? "actor-x",
    ipAddress: overrides.ipAddress ?? null,
    createdAt: new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000),
  };
}

const NOW = new Date("2026-05-02T12:00:00Z");

describe("aggregateActionCounts", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateActionCounts([])).toEqual([]);
  });

  it("groups + sorts descending by count", () => {
    const rows = [
      row({ action: "user.export" }),
      row({ action: "admin.audit.viewed" }),
      row({ action: "admin.audit.viewed" }),
      row({ action: "admin.audit.viewed" }),
      row({ action: "user.delete.requested" }),
      row({ action: "user.delete.requested" }),
    ];
    expect(aggregateActionCounts(rows)).toEqual([
      { action: "admin.audit.viewed", count: 3 },
      { action: "user.delete.requested", count: 2 },
      { action: "user.export", count: 1 },
    ]);
  });

  it("breaks ties alphabetically (stable order across reruns)", () => {
    const rows = [
      row({ action: "z.action" }),
      row({ action: "a.action" }),
      row({ action: "m.action" }),
    ];
    const out = aggregateActionCounts(rows);
    // All count=1 — alphabetical tiebreak.
    expect(out.map((c) => c.action)).toEqual(["a.action", "m.action", "z.action"]);
  });
});

describe("aggregateDailyCounts", () => {
  it("returns N empty buckets when there are no rows", () => {
    const out = aggregateDailyCounts([], { days: 7, now: NOW });
    expect(out).toHaveLength(7);
    expect(out.every((d) => d.count === 0)).toBe(true);
    // Last bucket = today UTC.
    expect(out[out.length - 1].date).toBe("2026-05-02");
    // First bucket = 6 days back.
    expect(out[0].date).toBe("2026-04-26");
  });

  it("places today's events in the trailing bucket", () => {
    const rows = [
      row({ hoursAgo: 1 }), // 11:00 UTC same day → today bucket
      row({ hoursAgo: 5 }), // 07:00 UTC same day → today bucket
    ];
    const out = aggregateDailyCounts(rows, { days: 3, now: NOW });
    expect(out[out.length - 1]).toEqual({ date: "2026-05-02", count: 2 });
    expect(out[0]).toEqual({ date: "2026-04-30", count: 0 });
  });

  it("buckets by UTC date (not host TZ)", () => {
    // 23:30 UTC on the previous calendar day. JST would call this
    // 'tomorrow'; the helper deliberately uses UTC so operators
    // outside JST get the same picture.
    const rows = [
      {
        action: "user.export",
        actorId: "x",
        ipAddress: null,
        createdAt: new Date("2026-05-01T23:30:00Z"),
      },
    ];
    const out = aggregateDailyCounts(rows, { days: 3, now: NOW });
    const may1 = out.find((d) => d.date === "2026-05-01");
    expect(may1?.count).toBe(1);
  });

  it("ignores events older than the horizon", () => {
    const rows = [row({ hoursAgo: 24 * 30 + 1 })]; // outside 7-day window
    const out = aggregateDailyCounts(rows, { days: 7, now: NOW });
    expect(out.reduce((s, d) => s + d.count, 0)).toBe(0);
  });

  it("clamps days to ≥ 1", () => {
    const out = aggregateDailyCounts([], { days: 0, now: NOW });
    expect(out.length).toBeGreaterThanOrEqual(1);
  });
});

describe("maxCount", () => {
  it("returns 1 for empty input (avoids division-by-zero in the renderer)", () => {
    expect(maxCount([])).toBe(1);
  });
  it("returns 1 when all counts are 0 (same reason)", () => {
    expect(maxCount([{ count: 0 }, { count: 0 }])).toBe(1);
  });
  it("returns the actual max otherwise", () => {
    expect(maxCount([{ count: 3 }, { count: 7 }, { count: 2 }])).toBe(7);
  });
});

describe("detectSuspiciousAuditPatterns — rule 1: delete-failure burst", () => {
  it("fires CRITICAL when one actor produces ≥ 5 user.delete.failed in 1h", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row({
        action: "user.delete.failed",
        actorId: "attacker-1",
        hoursAgo: 0.1 * i,
      }),
    );
    const out = detectSuspiciousAuditPatterns(rows, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      severity: "critical",
      count: 5,
      id: "delete-failure-burst:attacker-1",
    });
    expect(out[0].hint).toContain("attacker-1");
  });

  it("does NOT fire at 4 failures (just under threshold)", () => {
    const rows = Array.from({ length: 4 }, () =>
      row({ action: "user.delete.failed", actorId: "user-1" }),
    );
    expect(detectSuspiciousAuditPatterns(rows, NOW)).toHaveLength(0);
  });

  it("does NOT fire when failures span > 1 hour (window-bounded)", () => {
    const rows = [
      row({ action: "user.delete.failed", actorId: "u", hoursAgo: 0 }),
      row({ action: "user.delete.failed", actorId: "u", hoursAgo: 0.2 }),
      row({ action: "user.delete.failed", actorId: "u", hoursAgo: 0.4 }),
      row({ action: "user.delete.failed", actorId: "u", hoursAgo: 0.6 }),
      // 5th is 2h ago — outside the 1h window.
      row({ action: "user.delete.failed", actorId: "u", hoursAgo: 2 }),
    ];
    expect(detectSuspiciousAuditPatterns(rows, NOW)).toHaveLength(0);
  });

  it("treats different actors independently", () => {
    const rows = [
      ...Array.from({ length: 4 }, () =>
        row({ action: "user.delete.failed", actorId: "user-a" }),
      ),
      ...Array.from({ length: 4 }, () =>
        row({ action: "user.delete.failed", actorId: "user-b" }),
      ),
    ];
    // 4 + 4 — neither hits 5.
    expect(detectSuspiciousAuditPatterns(rows, NOW)).toHaveLength(0);
  });
});

describe("detectSuspiciousAuditPatterns — rule 2: family-view flood", () => {
  it("fires WARNING when one /24 produces ≥ 10 family.invitation.viewed in 1h", () => {
    const rows = Array.from({ length: 10 }, () =>
      row({
        action: "family.invitation.viewed",
        ipAddress: "203.0.113.0/24",
      }),
    );
    const out = detectSuspiciousAuditPatterns(rows, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      severity: "warning",
      count: 10,
      id: "family-view-flood:203.0.113.0/24",
    });
  });

  it("ignores rows with null ipAddress (no group key)", () => {
    const rows = Array.from({ length: 50 }, () =>
      row({ action: "family.invitation.viewed", ipAddress: null }),
    );
    expect(detectSuspiciousAuditPatterns(rows, NOW)).toHaveLength(0);
  });

  it("treats different /24 networks independently", () => {
    const rows = [
      ...Array.from({ length: 5 }, () =>
        row({ action: "family.invitation.viewed", ipAddress: "192.0.2.0/24" }),
      ),
      ...Array.from({ length: 9 }, () =>
        row({ action: "family.invitation.viewed", ipAddress: "198.51.100.0/24" }),
      ),
    ];
    expect(detectSuspiciousAuditPatterns(rows, NOW)).toHaveLength(0);
  });
});

describe("detectSuspiciousAuditPatterns — rule 3: admin-view burst", () => {
  it("fires WARNING when one admin opens audit page ≥ 20 times in 1h", () => {
    const rows = Array.from({ length: 20 }, () =>
      row({ action: "admin.audit.viewed", actorId: "admin-1" }),
    );
    const out = detectSuspiciousAuditPatterns(rows, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      severity: "warning",
      count: 20,
      id: "admin-view-burst:admin-1",
    });
  });

  it("does NOT fire at 19 (just under)", () => {
    const rows = Array.from({ length: 19 }, () =>
      row({ action: "admin.audit.viewed", actorId: "admin-1" }),
    );
    expect(detectSuspiciousAuditPatterns(rows, NOW)).toHaveLength(0);
  });
});

describe("detectSuspiciousAuditPatterns — composition", () => {
  it("returns multiple anomalies when several rules fire", () => {
    const rows = [
      ...Array.from({ length: 5 }, () =>
        row({ action: "user.delete.failed", actorId: "attacker" }),
      ),
      ...Array.from({ length: 10 }, () =>
        row({
          action: "family.invitation.viewed",
          ipAddress: "203.0.113.0/24",
        }),
      ),
    ];
    const out = detectSuspiciousAuditPatterns(rows, NOW);
    expect(out).toHaveLength(2);
    const ids = out.map((a) => a.id).sort();
    expect(ids).toEqual([
      "delete-failure-burst:attacker",
      "family-view-flood:203.0.113.0/24",
    ]);
  });

  it("returns [] for completely normal traffic", () => {
    const rows = [
      row({ action: "user.export", actorId: "u" }),
      row({ action: "admin.cost.viewed", actorId: "admin-1" }),
      row({
        action: "family.invitation.viewed",
        ipAddress: "192.0.2.0/24",
      }),
    ];
    expect(detectSuspiciousAuditPatterns(rows, NOW)).toEqual([]);
  });
});
