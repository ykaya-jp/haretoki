"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

/**
 * Cross-venue VisitNote excerpt for the /compare board.
 *
 * Surfaces the most recent visit note per venue so couples can read
 * "what we actually felt" alongside the score grid. The score row
 * tells you the answer (4.2 vs 3.8); the note row tells you the
 * texture ("光が入ってあたたかい" vs "音響が籠もる感じ"). Together
 * they make the comparison visceral.
 *
 * Returns max one excerpt per venue (latest non-deleted note across
 * all visits at that venue). Excerpts are clamped to 80 chars so the
 * cross-venue layout doesn't balloon vertically — full text lives on
 * the venue detail page.
 */
export interface VenueVisitNotePreview {
  venueId: string;
  noteId: string;
  excerpt: string;
  authorName: string | null;
  visitDate: Date;
  hasMedia: boolean;
  totalNotesAtVenue: number;
}

const EXCERPT_MAX = 80;

export async function getMatrixVisitNotes(
  venueIds: string[],
): Promise<VenueVisitNotePreview[]> {
  if (venueIds.length === 0) return [];

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const notes = await prisma.visitNote.findMany({
    where: {
      deletedAt: null,
      visit: {
        deletedAt: null,
        venueId: { in: venueIds },
        venue: { projectId, deletedAt: null },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      visit: {
        select: {
          venueId: true,
          scheduledAt: true,
          completedAt: true,
        },
      },
      user: { select: { name: true, email: true } },
      media: { select: { id: true }, take: 1 },
    },
  });

  // Aggregate: per venue, take latest excerpt + total count.
  const totalByVenue = new Map<string, number>();
  for (const n of notes) {
    totalByVenue.set(
      n.visit.venueId,
      (totalByVenue.get(n.visit.venueId) ?? 0) + 1,
    );
  }

  const seen = new Set<string>();
  const previews: VenueVisitNotePreview[] = [];
  for (const n of notes) {
    if (seen.has(n.visit.venueId)) continue;
    seen.add(n.visit.venueId);

    const excerpt =
      n.content.length > EXCERPT_MAX
        ? `${n.content.slice(0, EXCERPT_MAX).trimEnd()}…`
        : n.content;

    previews.push({
      venueId: n.visit.venueId,
      noteId: n.id,
      excerpt,
      authorName: n.user?.name ?? n.user?.email ?? null,
      // Prefer scheduled/completed date over note created date so the
      // displayed date matches "the day we visited".
      visitDate: n.visit.completedAt ?? n.visit.scheduledAt ?? n.createdAt,
      hasMedia: n.media.length > 0,
      totalNotesAtVenue: totalByVenue.get(n.visit.venueId) ?? 0,
    });
  }

  return previews;
}
