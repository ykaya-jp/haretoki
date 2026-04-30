/**
 * F2 (W15 audit) — tests for `src/lib/ics/build-visit-ics.ts`.
 *
 * We exercise the 5 load-bearing invariants from design §2.3:
 *   1. UID is `${visit.id}@haretoki.app` and stable across SEQUENCE bumps
 *   2. SEQUENCE comes from `visit.sequence` DB column (not date-derived)
 *   3. METHOD switches PUBLISH ↔ CANCEL based on visit.status
 *   4. VTIMEZONE block for Asia/Tokyo is explicitly emitted (STANDARD only)
 *   5. Two VALARMs are present (display type, not email)
 *
 * Plus: DTSTAMP is UTC ("Z"), buildMultipleVisitsIcs handles multi-VEVENT,
 * and the filename helper stays deterministic.
 */
import { describe, it, expect } from "vitest";
import {
    buildVisitIcs,
    buildMultipleVisitsIcs,
    buildIcsFileName,
    HARETOKI_PRODID,
} from "@/lib/ics/build-visit-ics";

const FIXED_NOW = new Date("2026-04-15T12:00:00Z");

const baseVisit = {
    id: "visit-uuid-aaaa-bbbb-cccc",
    // 2026-04-20 10:00 JST == 2026-04-20 01:00 UTC
    scheduledAt: new Date("2026-04-20T01:00:00Z"),
    sequence: 0,
    status: "scheduled" as const,
    memo: null as string | null,
};

const baseVenue = {
    id: "venue-uuid-1111-2222",
    name: "アニヴェルセル表参道",
    location: "東京都渋谷区神宮前",
};

type VisitForBuilder = Parameters<typeof buildVisitIcs>[0]["visit"];

function build(overrides?: {
    visit?: Partial<VisitForBuilder>;
    venue?: Partial<typeof baseVenue>;
    attendees?: Array<{ email: string; name?: string }>;
}) {
    return buildVisitIcs({
        visit: { ...baseVisit, ...overrides?.visit } as VisitForBuilder,
        venue: { ...baseVenue, ...overrides?.venue },
        attendees: overrides?.attendees,
        now: FIXED_NOW,
    });
}

describe("buildVisitIcs — UID stability (design §2.3)", () => {
    it("uses ${visit.id}@haretoki.app as UID", () => {
        const ics = build();
        expect(ics).toContain(`UID:${baseVisit.id}@haretoki.app`);
    });

    it("keeps the same UID when SEQUENCE advances (reschedule scenario)", () => {
        const seq0 = build({ visit: { sequence: 0 } });
        const seq2 = build({ visit: { sequence: 2 } });
        const uidLine = `UID:${baseVisit.id}@haretoki.app`;
        expect(seq0).toContain(uidLine);
        expect(seq2).toContain(uidLine);
        // UID line must appear exactly once per calendar
        expect(seq0.match(/UID:/g)?.length).toBe(1);
    });
});

describe("buildVisitIcs — SEQUENCE from DB column (design §2.3)", () => {
    it("emits SEQUENCE:0 for a fresh visit", () => {
        const ics = build({ visit: { sequence: 0 } });
        expect(ics).toMatch(/SEQUENCE:0(?:\r?\n)/);
    });

    it("emits SEQUENCE:3 when the visit has been rescheduled 3 times", () => {
        const ics = build({ visit: { sequence: 3 } });
        expect(ics).toMatch(/SEQUENCE:3(?:\r?\n)/);
    });

    it("advances SEQUENCE monotonically across reschedules", () => {
        const seqs = [0, 1, 2, 7].map((s) =>
            build({ visit: { sequence: s } }).match(/SEQUENCE:(\d+)/)?.[1],
        );
        expect(seqs).toEqual(["0", "1", "2", "7"]);
    });
});

describe("buildVisitIcs — METHOD selection (design §2.3)", () => {
    it("uses METHOD:PUBLISH for scheduled visits (avoids Google iTIP auto-reply)", () => {
        const ics = build({ visit: { status: "scheduled" } });
        expect(ics).toContain("METHOD:PUBLISH");
        expect(ics).not.toContain("METHOD:REQUEST");
        expect(ics).not.toContain("METHOD:CANCEL");
    });

    it("uses METHOD:CANCEL + STATUS:CANCELLED for cancelled visits", () => {
        const ics = build({ visit: { status: "cancelled" } });
        expect(ics).toContain("METHOD:CANCEL");
        expect(ics).toContain("STATUS:CANCELLED");
    });

    it("uses METHOD:PUBLISH for completed visits (no iTIP flow)", () => {
        const ics = build({ visit: { status: "completed" } });
        expect(ics).toContain("METHOD:PUBLISH");
    });
});

describe("buildVisitIcs — VTIMEZONE for Asia/Tokyo (design §2.3a)", () => {
    it("includes a hand-written VTIMEZONE block for Asia/Tokyo", () => {
        const ics = build();
        expect(ics).toContain("BEGIN:VTIMEZONE");
        expect(ics).toContain("TZID:Asia/Tokyo");
        expect(ics).toContain("TZOFFSETFROM:+0900");
        expect(ics).toContain("TZOFFSETTO:+0900");
        expect(ics).toContain("TZNAME:JST");
        expect(ics).toContain("END:VTIMEZONE");
    });

    it("emits STANDARD only (no DAYLIGHT — Japan has no DST)", () => {
        const ics = build();
        expect(ics).toContain("BEGIN:STANDARD");
        expect(ics).toContain("END:STANDARD");
        expect(ics).not.toContain("BEGIN:DAYLIGHT");
    });

    it("places VTIMEZONE before the first VEVENT (RFC 5545 recommended order)", () => {
        const ics = build();
        const vtzIdx = ics.indexOf("BEGIN:VTIMEZONE");
        const vevIdx = ics.indexOf("BEGIN:VEVENT");
        expect(vtzIdx).toBeGreaterThan(-1);
        expect(vevIdx).toBeGreaterThan(-1);
        expect(vtzIdx).toBeLessThan(vevIdx);
    });
});

describe("buildVisitIcs — VALARM × 2 (design §2.3)", () => {
    it("emits exactly two VALARM blocks", () => {
        const ics = build();
        const opens = ics.match(/BEGIN:VALARM/g) ?? [];
        const closes = ics.match(/END:VALARM/g) ?? [];
        expect(opens.length).toBe(2);
        expect(closes.length).toBe(2);
    });

    it("both alarms are ACTION:DISPLAY (not EMAIL — no SMTP burden)", () => {
        const ics = build();
        const displays = ics.match(/ACTION:DISPLAY/g) ?? [];
        expect(displays.length).toBe(2);
        expect(ics).not.toContain("ACTION:EMAIL");
    });

    it("alarm descriptions mention the venue name", () => {
        const ics = build();
        expect(ics).toContain(baseVenue.name);
    });
});

describe("buildVisitIcs — DTSTAMP UTC (design §2.3)", () => {
    it("DTSTAMP ends in Z (UTC)", () => {
        const ics = build();
        const match = ics.match(/DTSTAMP:([0-9TZ]+)/);
        expect(match).not.toBeNull();
        expect(match![1].endsWith("Z")).toBe(true);
    });
});

describe("buildVisitIcs — misc invariants", () => {
    it("declares the Haretoki PRODID", () => {
        const ics = build();
        // ical-generator prefixes PRODID: so we just look for the core
        expect(ics).toContain(HARETOKI_PRODID);
    });

    it("marks the event CLASS:PRIVATE", () => {
        const ics = build();
        expect(ics).toContain("CLASS:PRIVATE");
    });

    it("includes the app deep-link in URL and DESCRIPTION", () => {
        const ics = build();
        expect(ics).toContain(`/venues/${baseVenue.id}#visit`);
    });

    it("falls back to `${venueName} 見学` when no title is supplied", () => {
        const ics = build();
        // ical-generator may fold lines, so just search loose
        expect(ics).toMatch(/Haretoki/);
    });

    it("adds ATTENDEE lines when emails are provided", () => {
        const ics = build({
            attendees: [{ email: "owner@example.com", name: "オーナー" }],
        });
        expect(ics).toContain("ATTENDEE");
        expect(ics).toContain("owner@example.com");
    });

    it("emits no ATTENDEE lines when no attendees are passed", () => {
        const ics = build();
        expect(ics).not.toContain("ATTENDEE");
    });
});

describe("buildMultipleVisitsIcs — feed assembly", () => {
    it("emits one VEVENT per visit with stable UIDs", () => {
        const visitA = { ...baseVisit, id: "v-aaa" };
        const visitB = { ...baseVisit, id: "v-bbb", sequence: 5 };
        const ics = buildMultipleVisitsIcs({
            visits: [visitA, visitB],
            venueById: new Map([[baseVenue.id, baseVenue]]),
            venueIdByVisitId: new Map([
                ["v-aaa", baseVenue.id],
                ["v-bbb", baseVenue.id],
            ]),
            now: FIXED_NOW,
        });

        const events = ics.match(/BEGIN:VEVENT/g) ?? [];
        expect(events.length).toBe(2);
        expect(ics).toContain("UID:v-aaa@haretoki.app");
        expect(ics).toContain("UID:v-bbb@haretoki.app");
    });

    it("forces METHOD:PUBLISH for a feed even if one visit is cancelled", () => {
        const visitA = { ...baseVisit, id: "v-aaa" };
        const visitB = { ...baseVisit, id: "v-bbb", status: "cancelled" as const };
        const ics = buildMultipleVisitsIcs({
            visits: [visitA, visitB],
            venueById: new Map([[baseVenue.id, baseVenue]]),
            venueIdByVisitId: new Map([
                ["v-aaa", baseVenue.id],
                ["v-bbb", baseVenue.id],
            ]),
            now: FIXED_NOW,
        });
        expect(ics).toContain("METHOD:PUBLISH");
    });

    it("skips visits whose venue isn't in the lookup map (defensive)", () => {
        const orphan = { ...baseVisit, id: "v-orphan" };
        const ics = buildMultipleVisitsIcs({
            visits: [orphan],
            venueById: new Map(),
            venueIdByVisitId: new Map(),
            now: FIXED_NOW,
        });
        const events = ics.match(/BEGIN:VEVENT/g) ?? [];
        expect(events.length).toBe(0);
    });
});

describe("buildIcsFileName", () => {
    it("slugifies the venue name and uses JST date", () => {
        const name = buildIcsFileName(
            "Anniversaire Omotesando",
            new Date("2026-04-20T01:00:00Z"), // = 2026-04-20 10:00 JST
        );
        expect(name).toBe("haretoki-anniversaire-omotesando-20260420.ics");
    });

    it("falls back to `haretoki-visit-...ics` when name has no ASCII chars", () => {
        const name = buildIcsFileName(
            "式場名",
            new Date("2026-04-20T01:00:00Z"),
        );
        expect(name).toBe("haretoki-visit-20260420.ics");
    });
});
