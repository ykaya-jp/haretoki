import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { buildVenueWhere } from "@/server/actions/venue-filters";
import { parseSavedSearchFilters } from "@/lib/schemas";
import { recordCronRun } from "@/lib/cron-audit";

/**
 * GET/POST /api/cron/saved-search-notify
 *
 * Daily cron (09:00 JST = 00:00 UTC). Scans all SavedSearch rows,
 * detects venues created/updated after lastNotifiedAt that match the
 * stored filters, and creates Notification rows for the owners.
 * Updates lastNotifiedAt after processing each search.
 *
 * Auth: Bearer CRON_SECRET.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const now = new Date();

  // Batch-fetch all saved searches with their project info
  const savedSearches = await prisma.savedSearch.findMany({
    select: {
      id: true,
      projectId: true,
      userId: true,
      label: true,
      filters: true,
      lastNotifiedAt: true,
    },
  });

  let notified = 0;
  let skipped = 0;

  for (const search of savedSearches) {
    const f = parseSavedSearchFilters(search.filters);
    if (!f) {
      skipped++;
      continue;
    }
    const since = search.lastNotifiedAt ?? new Date(0);

    // Build venue filter for this project + saved filter conditions
    const where = {
      ...buildVenueWhere(search.projectId, {
        areas: f.area,
        budgetMax: f.budgetMax,
        guestCount: f.capacityMin,
        query: f.keyword,
        styles: f.vibeTags,
      }),
      // Only venues created or updated after the last notification
      OR: [
        { createdAt: { gt: since } },
        { updatedAt: { gt: since } },
      ],
    };

    const matchingVenues = await prisma.venue.findMany({
      where,
      select: { id: true, name: true },
      take: 5, // cap for notification body
    });

    if (matchingVenues.length === 0) {
      skipped++;
      // Still update lastNotifiedAt so next run only checks from now
      await prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastNotifiedAt: now },
      });
      continue;
    }

    const venueNames = matchingVenues.map((v) => v.name).join("、");
    const body =
      matchingVenues.length === 1
        ? `「${venueNames}」が「${search.label}」の条件に一致しました`
        : `${matchingVenues.length}件の式場が「${search.label}」の条件に一致しました（${venueNames}）`;

    await prisma.$transaction([
      prisma.notification.create({
        data: {
          userId: search.userId,
          type: "saved_search_match",
          title: "新しい式場が見つかりました",
          body,
          href: "/explore",
        },
      }),
      prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastNotifiedAt: now },
      }),
    ]);

    notified++;
  }

  await recordCronRun("saved-search-notify", {
    ok: true,
    durationMs: Date.now() - start,
  });
  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    total: savedSearches.length,
    notified,
    skipped,
  });
}
