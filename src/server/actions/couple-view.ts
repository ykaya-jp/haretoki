"use server";

import { prisma } from "@/server/db";
import { cacheTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

export interface CoupleOverviewItem {
  venueId: string;
  venueName: string;
  photoUrl: string | null;
  location: string | null;
  likedByMe: boolean;
  likedByPartner: boolean;
}

export interface CoupleOverview {
  hasPartner: boolean;
  meName: string | null;
  partnerName: string | null;
  bothCount: number;
  gaps: CoupleOverviewItem[]; // 片方だけが❤️している式場
  both: CoupleOverviewItem[];
}

async function fetchOverview(
  projectId: string,
  userId: string,
): Promise<CoupleOverview> {
  "use cache";
  cacheTag(`project:${projectId}`);

  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    select: {
      userId: true,
      user: { select: { firstName: true } },
    },
  });
  const partner = members.find((m) => m.userId !== userId);
  const me = members.find((m) => m.userId === userId);
  const hasPartner = !!partner;

  const favorites = await prisma.venueFavorite.findMany({
    where: { venue: { projectId } },
    include: {
      venue: {
        select: {
          id: true,
          name: true,
          location: true,
          photoUrls: true,
        },
      },
    },
  });

  const map = new Map<
    string,
    { venue: typeof favorites[number]["venue"]; likers: Set<string> }
  >();
  for (const f of favorites) {
    const entry = map.get(f.venueId);
    if (entry) entry.likers.add(f.userId);
    else map.set(f.venueId, { venue: f.venue, likers: new Set([f.userId]) });
  }

  const items: CoupleOverviewItem[] = Array.from(map.values()).map(
    ({ venue, likers }) => ({
      venueId: venue.id,
      venueName: venue.name,
      photoUrl: venue.photoUrls?.[0] ?? null,
      location: venue.location,
      likedByMe: likers.has(userId),
      likedByPartner: partner ? likers.has(partner.userId) : false,
    }),
  );

  const both = items.filter((i) => i.likedByMe && i.likedByPartner);
  const gaps = hasPartner
    ? items.filter((i) => i.likedByMe !== i.likedByPartner)
    : [];

  return {
    hasPartner,
    meName: me?.user?.firstName ?? null,
    partnerName: partner?.user?.firstName ?? null,
    bothCount: both.length,
    gaps,
    both,
  };
}

export async function getCoupleOverview(): Promise<CoupleOverview> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return fetchOverview(projectId, user.id);
}
