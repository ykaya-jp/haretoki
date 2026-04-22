/**
 * F2 (W15 audit) — pure iCalendar builder for a wedding-venue visit.
 *
 * Design: docs/designs/f2-visit-calendar-ics.md §2.3
 *
 * Responsibilities (intentionally narrow; keeps the function unit-testable):
 *   - Build a VCALENDAR string that Google / Apple / Outlook all understand
 *   - Emit VTIMEZONE for Asia/Tokyo (STANDARD only — Japan has no DST)
 *   - Use METHOD:PUBLISH to avoid Google's iTIP auto-reply path when
 *     ATTENDEEs are present (see design §2.3 METHOD row)
 *   - Keep UID stable across re-schedules (`${visit.id}@haretoki.app`) and
 *     advance SEQUENCE from the caller-supplied `visit.sequence` column
 *   - Emit two VALARMs (−1 day at 18:00 JST, −1 hour) per design §2.3
 *
 * Explicitly NOT in scope:
 *   - Database writes (handled by `markVisitCalendarExported` server action)
 *   - Auth checks (route handler's job)
 *   - Multi-visit feed (different assembly, same per-event helper though)
 */
import ical, {
    ICalAlarmType,
    ICalAttendeeRole,
    ICalAttendeeStatus,
    ICalCalendarMethod,
    ICalEventClass,
    ICalEventStatus,
} from "ical-generator";

export interface BuildVisitIcsInput {
    visit: {
        id: string;
        scheduledAt: Date;
        /** RFC 5545 SEQUENCE counter. 0 for first export, incremented on reschedule. */
        sequence: number;
        status: "scheduled" | "completed" | "cancelled";
        memo: string | null;
        /** Optional override; defaults to `${venue.name} 見学`. */
        title?: string | null;
    };
    venue: {
        id: string;
        name: string;
        location: string | null;
    };
    /** Attendee emails (owner + partner if known). Pass [] to emit no ATTENDEE. */
    attendees?: Array<{
        email: string;
        /** Display name (e.g. "オーナー" / "パートナー"). Optional but nicer in clients. */
        name?: string;
    }>;
    /** Public base URL, used for DESCRIPTION and URL fields. No trailing slash. */
    appBaseUrl?: string;
    /** DTSTAMP override for deterministic tests. Default = new Date(). */
    now?: Date;
    /** Event duration in minutes. Default 120 (2h) per design §2.3 DTEND row. */
    durationMinutes?: number;
}

export interface BuildMultipleVisitsIcsInput {
    visits: BuildVisitIcsInput["visit"][];
    venueById: Map<
        string,
        { id: string; name: string; location: string | null }
    >;
    /** Map<visitId, venueId> so we can look up each visit's venue. */
    venueIdByVisitId: Map<string, string>;
    attendees?: BuildVisitIcsInput["attendees"];
    appBaseUrl?: string;
    now?: Date;
    durationMinutes?: number;
}

export const HARETOKI_PRODID = "-//Haretoki//Visit Calendar 1.0//JA";
export const DEFAULT_APP_BASE_URL = "https://haretoki.app";
export const DEFAULT_DURATION_MINUTES = 120;

/**
 * Japan Standard Time VTIMEZONE block — no DST, single STANDARD rule.
 * Hand-written so we don't ship the full ical-timezones Olson dump for one tz.
 * Design §2.3a.
 */
const ASIA_TOKYO_VTIMEZONE = [
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Tokyo",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:JST",
    "END:STANDARD",
    "END:VTIMEZONE",
].join("\r\n");

function mapStatus(status: BuildVisitIcsInput["visit"]["status"]): ICalEventStatus {
    switch (status) {
        case "cancelled":
            return ICalEventStatus.CANCELLED;
        case "completed":
            // Completed visits still go out as CONFIRMED; Haretoki doesn't
            // re-export post-completion, but keep the mapping meaningful.
            return ICalEventStatus.CONFIRMED;
        case "scheduled":
        default:
            return ICalEventStatus.CONFIRMED;
    }
}

function pickMethod(status: BuildVisitIcsInput["visit"]["status"]): ICalCalendarMethod {
    // Design §2.3: PUBLISH (not REQUEST) to avoid Google iTIP auto-reply.
    // CANCEL stays CANCEL — that's how external calendars know to remove it.
    return status === "cancelled"
        ? ICalCalendarMethod.CANCEL
        : ICalCalendarMethod.PUBLISH;
}

function buildDescription(
    venueName: string,
    venueId: string,
    memo: string | null,
    appBaseUrl: string,
): string {
    const url = `${appBaseUrl}/venues/${venueId}#visit`;
    const memoBlock = memo ? `\n\nメモ:\n${memo}\n` : "";
    return [
        `${venueName} の見学です。`,
        "",
        "当日の持ち物やチェックリストはアプリでご確認いただけます。",
        `▶ ${url}`,
        memoBlock,
        "※ この予定は Haretoki で作成されました。",
        "  予定を変えたいときは Haretoki から更新すると、",
        "  このカレンダーにも反映されます。",
    ].join("\n");
}

function computeAlarmTriggers(scheduledAt: Date): {
    dayBefore1800Jst: Date;
    oneHourBefore: Date;
} {
    // JST = UTC+9. Compute "yesterday at 18:00 JST" in UTC.
    //
    // Why not subtract "X hours from scheduledAt"?
    //   The design (§2.3 VALARM #1) says *absolute* 18:00 JST the day before,
    //   which is a wall-clock time — not a fixed offset from the meeting.
    //   Doing it via epoch math + JST-offset keeps the computation TZ-correct
    //   regardless of the server's TZ env.
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const scheduledJstMs = scheduledAt.getTime() + JST_OFFSET_MS;
    const jst = new Date(scheduledJstMs);
    // Set to yesterday 18:00 in JST wall clock, then convert back to UTC.
    const yesterday1800JstMs = Date.UTC(
        jst.getUTCFullYear(),
        jst.getUTCMonth(),
        jst.getUTCDate() - 1,
        18,
        0,
        0,
        0,
    ) - JST_OFFSET_MS;
    return {
        dayBefore1800Jst: new Date(yesterday1800JstMs),
        oneHourBefore: new Date(scheduledAt.getTime() - 60 * 60 * 1000),
    };
}

function defaultTitle(venueName: string): string {
    return `【Haretoki】${venueName} 見学`;
}

function buildLocation(venue: { name: string; location: string | null }): string {
    return venue.location ? `${venue.name} (${venue.location})` : venue.name;
}

/**
 * Inject our hand-written Asia/Tokyo VTIMEZONE after the VCALENDAR preamble.
 * Done as a post-process because `ical-generator` won't emit a full VTIMEZONE
 * block unless you provide a full generator (e.g. ical-timezones). For a
 * single static JST rule, hand-writing is simpler + smaller.
 *
 * Order within a VCALENDAR is flexible per RFC 5545, but we place VTIMEZONE
 * before the first VEVENT for maximum compatibility with older clients.
 */
function injectTokyoVtimezone(calendarString: string): string {
    // Split at the first BEGIN:VEVENT and insert the VTIMEZONE before it.
    const idx = calendarString.indexOf("BEGIN:VEVENT");
    if (idx === -1) {
        // No events — still valid to return unchanged.
        return calendarString;
    }
    return (
        calendarString.slice(0, idx) +
        ASIA_TOKYO_VTIMEZONE +
        "\r\n" +
        calendarString.slice(idx)
    );
}

/**
 * Format a Date as a UTC iCalendar date-time (e.g. `20260415T120000Z`).
 * RFC 5545 §3.3.5 "UTC Time" form.
 */
function toIcsUtc(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
    );
}

/**
 * `ical-generator` serialises DTSTAMP using the *event's* timezone when set,
 * which for us is Asia/Tokyo. RFC 5545 §3.8.7.2 mandates DTSTAMP be UTC.
 * Rewrite any `DTSTAMP:YYYYMMDDTHHMMSS` (no Z, no TZID) to UTC using the
 * supplied reference instant. This keeps tz-correctness guaranteed regardless
 * of server/library quirks.
 */
function forceDtstampUtc(calendarString: string, stamp: Date): string {
    const utc = toIcsUtc(stamp);
    // Match DTSTAMP lines that are either bare local (no TZID, no Z) or
    // JST-labeled. Replace the value portion only.
    return calendarString.replace(
        /DTSTAMP(?:;TZID=[^:]+)?:\d{8}T\d{6}Z?/g,
        `DTSTAMP:${utc}`,
    );
}

/**
 * Build an iCalendar string for a single visit.
 *
 * @returns a CRLF-terminated VCALENDAR suitable for `Content-Type: text/calendar`.
 */
export function buildVisitIcs(input: BuildVisitIcsInput): string {
    const {
        visit,
        venue,
        attendees = [],
        appBaseUrl = DEFAULT_APP_BASE_URL,
        now = new Date(),
        durationMinutes = DEFAULT_DURATION_MINUTES,
    } = input;

    const method = pickMethod(visit.status);
    const cal = ical({
        prodId: HARETOKI_PRODID,
        method,
        // We inject VTIMEZONE ourselves below; `timezone` string here only
        // stamps a TZID header but doesn't emit the VTIMEZONE component.
        timezone: "Asia/Tokyo",
    });

    const endAt = new Date(
        visit.scheduledAt.getTime() + durationMinutes * 60 * 1000,
    );
    const title = visit.title?.trim() ? visit.title : defaultTitle(venue.name);

    const event = cal.createEvent({
        // UID: domain-scoped so it's globally unique across clients.
        id: `${visit.id}@haretoki.app`,
        start: visit.scheduledAt,
        end: endAt,
        // DTSTAMP must be UTC per RFC 5545 §3.8.7.2 — ical-generator emits it
        // as UTC ("Z") when a `Date` is passed without a TZID hint.
        stamp: now,
        timezone: "Asia/Tokyo",
        summary: title,
        location: buildLocation(venue),
        description: buildDescription(
            venue.name,
            venue.id,
            visit.memo,
            appBaseUrl,
        ),
        url: `${appBaseUrl}/venues/${venue.id}#visit`,
        sequence: visit.sequence,
        status: mapStatus(visit.status),
        class: ICalEventClass.PRIVATE,
        categories: [
            { name: "Haretoki" },
            { name: "Wedding" },
            { name: "Venue Visit" },
        ],
        organizer: {
            name: "Haretoki",
            email: "no-reply@haretoki.app",
        },
        attendees: attendees.map((a) => ({
            email: a.email,
            name: a.name,
            role: ICalAttendeeRole.REQ,
            status: ICalAttendeeStatus.ACCEPTED,
            rsvp: false,
        })),
    });

    // VALARM #1 — day before at 18:00 JST. Use an absolute Date trigger so the
    // wall-clock time survives client TZ differences.
    const { dayBefore1800Jst, oneHourBefore } = computeAlarmTriggers(
        visit.scheduledAt,
    );
    event.createAlarm({
        type: ICalAlarmType.display,
        trigger: dayBefore1800Jst,
        description: `明日は ${venue.name} の見学です。持ち物を確認しましょう。`,
    });
    // VALARM #2 — 1h before the event. Use a Date (absolute trigger) so we
    // don't need to care about "relatesTo" semantics.
    event.createAlarm({
        type: ICalAlarmType.display,
        trigger: oneHourBefore,
        description: `あと1時間で ${venue.name} の見学が始まります。`,
    });

    const raw = cal.toString();
    return injectTokyoVtimezone(forceDtstampUtc(raw, now));
}

/**
 * Build an iCalendar *feed* (multiple VEVENTs) for a whole project's upcoming
 * + completed visits. Used by `GET /api/projects/current/visits.ics`.
 */
export function buildMultipleVisitsIcs(
    input: BuildMultipleVisitsIcsInput,
): string {
    const {
        visits,
        venueById,
        venueIdByVisitId,
        attendees = [],
        appBaseUrl = DEFAULT_APP_BASE_URL,
        now = new Date(),
        durationMinutes = DEFAULT_DURATION_MINUTES,
    } = input;

    // For a feed we force PUBLISH regardless of individual status — iCalendar
    // only has one calendar-level METHOD, and PUBLISH is the safe read-only
    // flavour for mixed events.
    const cal = ical({
        prodId: HARETOKI_PRODID,
        method: ICalCalendarMethod.PUBLISH,
        timezone: "Asia/Tokyo",
    });

    for (const visit of visits) {
        const venueId = venueIdByVisitId.get(visit.id);
        if (!venueId) continue;
        const venue = venueById.get(venueId);
        if (!venue) continue;

        const endAt = new Date(
            visit.scheduledAt.getTime() + durationMinutes * 60 * 1000,
        );
        const title = visit.title?.trim()
            ? visit.title
            : defaultTitle(venue.name);
        const event = cal.createEvent({
            id: `${visit.id}@haretoki.app`,
            start: visit.scheduledAt,
            end: endAt,
            stamp: now,
            timezone: "Asia/Tokyo",
            summary: title,
            location: buildLocation(venue),
            description: buildDescription(
                venue.name,
                venue.id,
                visit.memo,
                appBaseUrl,
            ),
            url: `${appBaseUrl}/venues/${venue.id}#visit`,
            sequence: visit.sequence,
            status: mapStatus(visit.status),
            class: ICalEventClass.PRIVATE,
            categories: [
                { name: "Haretoki" },
                { name: "Wedding" },
                { name: "Venue Visit" },
            ],
            organizer: {
                name: "Haretoki",
                email: "no-reply@haretoki.app",
            },
            attendees: attendees.map((a) => ({
                email: a.email,
                name: a.name,
                role: ICalAttendeeRole.REQ,
                status: ICalAttendeeStatus.ACCEPTED,
                rsvp: false,
            })),
        });

        const { dayBefore1800Jst, oneHourBefore } = computeAlarmTriggers(
            visit.scheduledAt,
        );
        event.createAlarm({
            type: ICalAlarmType.display,
            trigger: dayBefore1800Jst,
            description: `明日は ${venue.name} の見学です。持ち物を確認しましょう。`,
        });
        event.createAlarm({
            type: ICalAlarmType.display,
            trigger: oneHourBefore,
            description: `あと1時間で ${venue.name} の見学が始まります。`,
        });
    }

    const raw = cal.toString();
    return injectTokyoVtimezone(forceDtstampUtc(raw, now));
}

/**
 * Build a filename for the .ics download. Example:
 *   haretoki-anniversaire-omotesando-20260420.ics
 */
export function buildIcsFileName(venueName: string, scheduledAt: Date): string {
    const slug = venueName
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jst = new Date(scheduledAt.getTime() + JST_OFFSET_MS);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    const datePart = `${y}${m}${d}`;
    return slug
        ? `haretoki-${slug}-${datePart}.ics`
        : `haretoki-visit-${datePart}.ics`;
}
