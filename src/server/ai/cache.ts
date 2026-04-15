import { prisma } from "@/server/db";
import type { AiAnalysisType } from "@/generated/prisma/client";

const TTL_DAYS: Partial<Record<AiAnalysisType, number>> = {
  review_summary: 30,
  estimate_prediction: 7,
  comparison: 3,
  visit_prep: 1,
  rating_comparison: 1,
  // coach_chat: no cache
};

export async function getCachedAnalysis(
  projectId: string,
  type: AiAnalysisType,
  inputHash: string,
): Promise<string | null> {
  const ttlDays = TTL_DAYS[type];
  if (!ttlDays) return null;

  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);

  const cached = await prisma.aiAnalysis.findFirst({
    where: {
      projectId,
      type,
      inputHash,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });

  return cached?.output ?? null;
}

export async function invalidateAiCache(
  venueId: string,
  types: AiAnalysisType[],
): Promise<number> {
  const result = await prisma.aiAnalysis.deleteMany({
    where: {
      venueId,
      type: { in: types },
    },
  });
  return result.count;
}
