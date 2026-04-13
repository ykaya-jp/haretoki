"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

interface HomeData {
  project: {
    id: string;
    name: string;
    conditions: Record<string, unknown> | null;
  };
  hasPartner: boolean;
  recentVenues: Array<{
    id: string;
    name: string;
    location: string | null;
    photoUrls: string[];
    status: string;
    scores: Array<{ dimension: string; score: number; source: string }>;
  }>;
  progress: {
    totalVenues: number;
    visitedVenues: number;
    estimateCount: number;
    favoriteCount: number;
    hasDecision: boolean;
    percentage: number;
  };
  userName: string;
}

/**
 * Home screen data in a single Server Action call.
 * Progress % logic:
 * - Venue added: 20% (1+ venues)
 * - Visit completed: 20% (1+ visited)
 * - Estimate entered: 20% (1+ estimates)
 * - Favorites selected: 20% (2+ favorites)
 * - Decision made: 20% (Decision exists)
 */
export async function getHomeData(): Promise<HomeData> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, name: true, conditions: true },
  });

  const [venues, estimateCount, favoriteCount, decision, memberCount] = await Promise.all([
    prisma.venue.findMany({
      where: { projectId },
      include: {
        scores: {
          where: { source: "user_rating" },
          select: { dimension: true, score: true, source: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.estimate.count({ where: { projectId } }),
    prisma.venueFavorite.count({ where: { userId: user.id, venue: { projectId } } }),
    prisma.decision.findUnique({ where: { projectId } }),
    prisma.projectMember.count({ where: { projectId, acceptedAt: { not: null } } }),
  ]);

  const totalVenues = venues.length;
  const visitedVenues = venues.filter((v) => v.status === "visited" || v.status === "selected").length;
  const hasDecision = decision !== null;

  // Calculate progress
  let steps = 0;
  if (totalVenues > 0) steps++;
  if (visitedVenues > 0) steps++;
  if (estimateCount > 0) steps++;
  if (favoriteCount >= 2) steps++;
  if (hasDecision) steps++;
  const percentage = Math.round((steps / 5) * 100);

  return {
    project: {
      id: project.id,
      name: project.name,
      conditions: project.conditions as Record<string, unknown> | null,
    },
    hasPartner: memberCount >= 2,
    recentVenues: venues.slice(0, 5).map((v) => ({
      id: v.id,
      name: v.name,
      location: v.location,
      photoUrls: v.photoUrls,
      status: v.status,
      scores: v.scores.map((s) => ({
        dimension: s.dimension,
        score: Number(s.score),
        source: s.source,
      })),
    })),
    progress: {
      totalVenues,
      visitedVenues,
      estimateCount,
      favoriteCount,
      hasDecision,
      percentage,
    },
    userName: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "ゲスト",
  };
}
