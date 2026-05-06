"use server";

import { cacheTag } from "next/cache";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
export type Weather = "cloudy" | "break" | "clear" | "sunny";

export interface JourneyMilestone {
  id: string;
  label: string;
  weather: Weather;
  count: number;
  targetCount: number;
  /** ISO string when this milestone was first reached, or null if not yet reached. */
  updatedAt: Date | null;
}

export interface JourneyMilestonesResult {
  milestones: JourneyMilestone[];
  projectCreatedAt: Date;
}

async function fetchJourneyMilestones(
  projectId: string,
  userId: string,
): Promise<JourneyMilestonesResult> {
  "use cache";
  cacheTag(`project:${projectId}`);

  const [project, favoriteCount, visitCount, estimateCount, decision, firstFavorite, firstVisit, firstEstimate] =
    await Promise.all([
      prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { createdAt: true },
      }),
      prisma.venueFavorite.count({ where: { userId, venue: { projectId, deletedAt: null } } }),
      prisma.visit.count({ where: { venue: { projectId, deletedAt: null }, status: "completed" } }),
      prisma.estimate.count({
        where: { projectId, venue: { deletedAt: null } },
      }),
      prisma.decision.findUnique({
        where: { projectId },
        select: { decidedAt: true },
      }),
      // earliest timestamps for each milestone
      prisma.venueFavorite.findFirst({
        where: { userId, venue: { projectId, deletedAt: null } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.visit.findFirst({
        where: { venue: { projectId, deletedAt: null }, status: "completed" },
        orderBy: { completedAt: "asc" },
        select: { completedAt: true },
      }),
      prisma.estimate.findFirst({
        where: { projectId, venue: { deletedAt: null } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

  function favoriteWeather(count: number): Weather {
    if (count >= 3) return "clear";
    if (count >= 1) return "break";
    return "cloudy";
  }

  function visitWeather(count: number): Weather {
    if (count >= 3) return "clear";
    if (count >= 1) return "break";
    return "cloudy";
  }

  function estimateWeather(count: number): Weather {
    if (count >= 2) return "clear";
    if (count >= 1) return "break";
    return "cloudy";
  }

  const milestones: JourneyMilestone[] = [
    {
      id: "start",
      label: "はじまり",
      weather: "clear",
      count: 1,
      targetCount: 1,
      updatedAt: project.createdAt,
    },
    {
      id: "favorites",
      label: "候補を集める",
      weather: favoriteWeather(favoriteCount),
      count: favoriteCount,
      targetCount: 3,
      updatedAt: firstFavorite?.createdAt ?? null,
    },
    {
      id: "visits",
      label: "見学する",
      weather: visitWeather(visitCount),
      count: visitCount,
      targetCount: 3,
      updatedAt: firstVisit?.completedAt ?? null,
    },
    {
      id: "estimates",
      label: "見積もりを見る",
      weather: estimateWeather(estimateCount),
      count: estimateCount,
      targetCount: 2,
      updatedAt: firstEstimate?.createdAt ?? null,
    },
    {
      id: "decision",
      label: "決める",
      weather: decision ? "sunny" : "cloudy",
      count: decision ? 1 : 0,
      targetCount: 1,
      updatedAt: decision?.decidedAt ?? null,
    },
  ];

  return {
    milestones,
    projectCreatedAt: project.createdAt,
  };
}

/** Returns synthesized journey milestones for the current user's project. */
export async function getJourneyMilestones(): Promise<JourneyMilestonesResult> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return fetchJourneyMilestones(projectId, user.id);
}
