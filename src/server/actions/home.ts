"use server";

import { cacheTag } from "next/cache";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { parseConditions } from "@/lib/schemas";
import type { ProjectConditions } from "@/types";

interface HomeData {
  project: {
    id: string;
    name: string;
    conditions: ProjectConditions | null;
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
    upcomingVisits: number;
  };
  userName: string;
}

/** Lightweight helper — returns only the current user's display name. */
export async function getCurrentUserName(): Promise<string> {
  const user = await requireUser();
  return (
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    "おふたり"
  );
}

/**
 * Cached inner loader. Keyed on (projectId, userId, userName).
 * Progress % logic:
 * - Venue added: 20% (1+ venues)
 * - Visit completed: 20% (1+ visited)
 * - Estimate entered: 20% (1+ estimates)
 * - Favorites selected: 20% (2+ favorites)
 * - Decision made: 20% (Decision exists)
 */
async function fetchHomeData(
  projectId: string,
  userId: string,
  userName: string,
): Promise<HomeData> {
  "use cache";
  cacheTag(`project:${projectId}`);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, name: true, conditions: true },
  });

  const [venues, totalVenues, visitedVenues, estimateCount, favoriteCount, decision, memberCount, upcomingVisits] = await Promise.all([
    prisma.venue.findMany({
      where: { projectId },
      include: {
        scores: {
          where: { source: "user_rating" },
          select: { dimension: true, score: true, source: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.venue.count({ where: { projectId } }),
    prisma.venue.count({ where: { projectId, status: { in: ["visited", "selected"] } } }),
    prisma.estimate.count({ where: { projectId } }),
    prisma.venueFavorite.count({ where: { userId, venue: { projectId } } }),
    prisma.decision.findUnique({ where: { projectId } }),
    prisma.projectMember.count({ where: { projectId, acceptedAt: { not: null } } }),
    prisma.visit.count({ where: { venue: { projectId }, status: "scheduled" } }),
  ]);
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
      conditions: parseConditions(project.conditions),
    },
    hasPartner: memberCount >= 2,
    recentVenues: venues.map((v) => ({
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
      upcomingVisits,
    },
    userName,
  };
}

/** Home screen data in a single Server Action call. */
export async function getHomeData(): Promise<HomeData> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  const userName =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    "おふたり";
  return fetchHomeData(projectId, user.id, userName);
}
