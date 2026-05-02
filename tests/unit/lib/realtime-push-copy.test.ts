import { describe, it, expect } from "vitest";
import {
  pickRealtimeCopy,
  pickRealtimeUrl,
  hourBucketOf,
  PUSH_TITLE_MAX,
  PUSH_BODY_MAX,
  type RealtimePushEvent,
} from "@/lib/push/realtime-copy";

/**
 * P3 L3 W2 copy table coverage. Pinned to docs/ai/notifications/
 * realtime-push.md content — drift hook should already shout if either
 * side moves.
 */

describe("pickRealtimeCopy — every event renders a non-empty cell", () => {
  const events: RealtimePushEvent[] = [
    "partner_rating_added",
    "partner_note_added",
    "decision_saved",
    "wedding_date_set",
  ];

  for (const kind of events) {
    it(`returns non-empty title+body for ${kind}`, () => {
      const out = pickRealtimeCopy({
        kind,
        venueName: "テスト式場",
        partnerName: "Yuki",
      });
      expect(out.title.length).toBeGreaterThan(0);
      expect(out.body.length).toBeGreaterThan(0);
      // No raw placeholder leaked.
      expect(out.title).not.toContain("{venueName}");
      expect(out.title).not.toContain("{partnerName}");
      expect(out.body).not.toContain("{venueName}");
      expect(out.body).not.toContain("{partnerName}");
    });
  }
});

describe("pickRealtimeCopy — variable interpolation", () => {
  it("substitutes both venueName and partnerName", () => {
    const out = pickRealtimeCopy({
      kind: "partner_rating_added",
      venueName: "ガーデンテラス青山",
      partnerName: "Yuki",
    });
    expect(out.title).toContain("Yuki");
    expect(out.body).toContain("ガーデンテラス青山");
  });

  it("falls back to placeholder when venueName missing on a venue event", () => {
    // Realtime push must never block on missing copy variables —
    // freshness over polish. Fallback "お選びの式場" is the doc spec.
    const out = pickRealtimeCopy({
      kind: "partner_rating_added",
      venueName: null,
      partnerName: "Yuki",
    });
    expect(out.body).toContain("お選びの式場");
  });

  it("falls back to placeholder when partnerName missing", () => {
    const out = pickRealtimeCopy({
      kind: "partner_rating_added",
      venueName: "X",
      partnerName: null,
    });
    expect(out.title).toContain("相手の方");
  });

  it("ignores venueName for the no-venue event (wedding_date_set)", () => {
    const out = pickRealtimeCopy({
      kind: "wedding_date_set",
      venueName: "ignored-venue",
      partnerName: null,
    });
    // The cell has neither variable — the venueName argument is a
    // no-op, the rendered body should NOT mention the value.
    expect(out.body).not.toContain("ignored-venue");
  });

  it("strips HTML tags from venueName / partnerName (XSS / future inbox HTML rendering)", () => {
    const out = pickRealtimeCopy({
      kind: "partner_rating_added",
      venueName: "<script>alert(1)</script>会場",
      partnerName: "<b>Yuki</b>",
    });
    expect(out.title).not.toContain("<");
    expect(out.title).not.toContain("script");
    expect(out.title).toContain("Yuki");
    expect(out.body).toContain("会場");
  });

  it("caps title at PUSH_TITLE_MAX even with pathological inputs", () => {
    const out = pickRealtimeCopy({
      kind: "partner_rating_added",
      venueName: "あ".repeat(500),
      partnerName: "い".repeat(200),
    });
    expect(out.title.length).toBeLessThanOrEqual(PUSH_TITLE_MAX);
    expect(out.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX);
  });
});

describe("pickRealtimeUrl — every event has a deep link", () => {
  it("partner_rating_added → /venues/{scopeId}", () => {
    expect(pickRealtimeUrl("partner_rating_added", "v-1")).toBe("/venues/v-1");
  });
  it("partner_note_added → /venues/{scopeId}#visit", () => {
    expect(pickRealtimeUrl("partner_note_added", "v-2")).toBe(
      "/venues/v-2#visit",
    );
  });
  it("decision_saved → /journey", () => {
    expect(pickRealtimeUrl("decision_saved", "v-3")).toBe("/journey");
  });
  it("wedding_date_set → /home", () => {
    expect(pickRealtimeUrl("wedding_date_set", "p-1")).toBe("/home");
  });
});

describe("hourBucketOf — designer warning: hour-bucket invalidation", () => {
  it("returns the same bucket for two instants in the same UTC hour", () => {
    const a = new Date("2026-05-03T10:00:00Z");
    const b = new Date("2026-05-03T10:59:59Z");
    expect(hourBucketOf(a)).toBe(hourBucketOf(b));
  });

  it("returns DIFFERENT buckets for instants in adjacent hours (the invalidation tick)", () => {
    // CRITICAL invariant per designer warning: 1h cool-down works only
    // if the hour bucket flips at the hour boundary. Without this, a
    // permanent throttle row would suppress every future event.
    const before = new Date("2026-05-03T10:59:59Z");
    const after = new Date("2026-05-03T11:00:00Z");
    expect(hourBucketOf(before)).not.toBe(hourBucketOf(after));
    expect(hourBucketOf(after) - hourBucketOf(before)).toBe(1);
  });

  it("buckets are integer-sized (suitable for SQL int column)", () => {
    const bucket = hourBucketOf(new Date());
    expect(Number.isInteger(bucket)).toBe(true);
    // Bucket shouldn't blow past 32-bit signed range for the next
    // 200000+ years; stays safe in INT4.
    expect(bucket).toBeLessThan(2 ** 31);
    expect(bucket).toBeGreaterThan(0);
  });
});
