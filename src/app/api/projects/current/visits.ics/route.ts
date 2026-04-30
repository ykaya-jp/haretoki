/**
 * F2 (W15 audit) — whole-project iCalendar feed.
 *
 * Design: docs/designs/f2-visit-calendar-ics.md §2.2, §4.4 "複数 visit の一括"
 *
 * A single `.ics` file containing every scheduled + completed visit across
 * the signed-in user's current project. Intended as a "bulk download"
 * convenience (not a long-lived subscription URL — it's auth-scoped via
 * Supabase cookies, so subscribing externally wouldn't work anyway without
 * a token-based variant, deferred to R2).
 *
 * No DB writes — same reasoning as the single-visit route.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import {
    buildMultipleVisitsIcs,
    DEFAULT_APP_BASE_URL,
} from "@/lib/ics/build-visit-ics";

// See note in src/app/api/visits/[visitId]/ics/route.ts — Next.js 16 with
// cacheComponents rejects both `runtime` and `dynamic` config keys. The
// auth call keeps responses per-user; we rely on the `Cache-Control:
// no-store` header below rather than a route-segment directive. Earlier
// drafts used `private, max-age=300` but the cache-pollution risk in
// shared-device cases (and the lack of `Vary: Cookie`) outweighed the
// 5-minute saving on a low-frequency action.

export async function GET(): Promise<Response> {
    const user = await requireUser();
    const { projectId } = await requireProjectMembership(user.id);

    const venues = await prisma.venue.findMany({
        where: { projectId },
        select: {
            id: true,
            name: true,
            location: true,
            visits: {
                where: {
                    scheduledAt: { not: null },
                    status: { in: ["scheduled", "completed"] },
                },
                select: {
                    id: true,
                    scheduledAt: true,
                    sequence: true,
                    status: true,
                    memo: true,
                    title: true,
                },
            },
        },
    });

    const venueById = new Map(
        venues.map((v) => [
            v.id,
            { id: v.id, name: v.name, location: v.location },
        ]),
    );
    const venueIdByVisitId = new Map<string, string>();
    const allVisits: Array<{
        id: string;
        scheduledAt: Date;
        sequence: number;
        status: "scheduled" | "completed" | "cancelled";
        memo: string | null;
        title: string | null;
    }> = [];
    for (const v of venues) {
        for (const visit of v.visits) {
            if (!visit.scheduledAt) continue;
            venueIdByVisitId.set(visit.id, v.id);
            allVisits.push({
                id: visit.id,
                scheduledAt: visit.scheduledAt,
                sequence: visit.sequence,
                status: visit.status,
                memo: visit.memo,
                title: visit.title,
            });
        }
    }

    // Attendees shared across all events in this feed.
    const members = await prisma.projectMember.findMany({
        where: { projectId, acceptedAt: { not: null } },
        include: { user: { select: { email: true, name: true } } },
    });
    const attendees = members
        .map((m) => ({
            email: m.user.email,
            name:
                m.user.name ??
                (m.role === "owner" ? "オーナー" : "パートナー"),
        }))
        .filter((a) => !!a.email);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_BASE_URL;

    const ics = buildMultipleVisitsIcs({
        visits: allVisits,
        venueById,
        venueIdByVisitId,
        attendees,
        appBaseUrl: baseUrl,
    });

    return new NextResponse(ics, {
        status: 200,
        headers: {
            "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
            "Content-Disposition":
                'attachment; filename="haretoki-visits.ics"',
            // No-store keeps each request authoritative and avoids cache
            // pollution in shared-device cases. The auth call ensures each
            // request is per-user; the bulk feed is low-frequency so the
            // 5-minute saving is not worth the `Vary: Cookie` complexity.
            "Cache-Control": "no-store",
        },
    });
}
