/**
 * F2 (W15 audit) — single-visit iCalendar download.
 *
 * Design: docs/designs/f2-visit-calendar-ics.md §2.2
 *
 * CRITICAL: this handler MUST NOT write to the DB. Link-prefetch and
 * preview bots can hit the URL without user intent; writing
 * `calendarExportedAt` here would produce false-positive metrics.
 * The client calls `markVisitCalendarExported()` explicitly after a
 * successful download (see §2.2a).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, requireVisitAccess } from "@/server/auth";
import {
    buildVisitIcs,
    buildIcsFileName,
    DEFAULT_APP_BASE_URL,
} from "@/lib/ics/build-visit-ics";

// Next.js 16 + cacheComponents rejects both `runtime` and `dynamic` route
// segment config keys. Node.js runtime is the default. We rely on the
// presence of `Cache-Control: no-store` on the response + an auth call
// (`requireUser`) per request to prevent caching — Route Handlers with
// runtime authentication are not statically rendered anyway.

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ visitId: string }> },
): Promise<Response> {
    const { visitId } = await params;
    const user = await requireUser();
    const { projectId } = await requireVisitAccess(user.id, visitId);

    // We intentionally re-read the visit (requireVisitAccess already fetched
    // it but without venue/project member details). One extra query keeps
    // the auth helper narrow.
    const visit = await prisma.visit.findUnique({
        where: { id: visitId },
        include: {
            venue: {
                select: {
                    id: true,
                    name: true,
                    location: true,
                },
            },
        },
    });

    if (!visit || !visit.scheduledAt) {
        return new NextResponse("Visit not found or not scheduled", {
            status: 404,
        });
    }

    // Attendees: resolve from ProjectMember + User.email. Partner email may be
    // missing (onboarding hasn't captured it); that row just gets omitted.
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

    const ics = buildVisitIcs({
        visit: {
            id: visit.id,
            scheduledAt: visit.scheduledAt,
            sequence: visit.sequence,
            status: visit.status,
            memo: visit.memo,
            title: visit.title,
        },
        venue: visit.venue,
        attendees,
        appBaseUrl: baseUrl,
    });

    const filename = buildIcsFileName(visit.venue.name, visit.scheduledAt);

    return new NextResponse(ics, {
        status: 200,
        headers: {
            // METHOD=PUBLISH hint — some clients use it to pick the import
            // path (read-only publish vs interactive invite).
            "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
        },
    });
}
