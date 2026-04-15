"use server";

import { cacheTag } from "next/cache";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import {
  isClaudeAvailable,
  askClaude,
  withRetry,
  computeInputHash,
} from "@/lib/anthropic";
import {
  FIT_REASON_PROMPT,
  cleanOneLineFit,
  type FitReasonVenueSummary,
} from "@/lib/prompts/fit-reason";

export type FitReasonMap = Record<string, string | null>;

const MAX_NEW_PER_CALL = 10;

/**
 * Resolve "fit reason" one-liners for the given venues. Cached per
 * (venueId, venueUpdatedAt, conditionsHash) — editing conditions or a venue
 * triggers a fresh generation for that row only.
 *
 * If conditions are unset (null), returns empty map (caller shows no fit
 * reason — "conditions を入れるとここにヒントが出ます" empty-state).
 */
export async function getFitReasons(venueIds: string[]): Promise<FitReasonMap> {
  if (venueIds.length === 0) return {};
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return fetchFitReasons(projectId, venueIds);
}

async function fetchFitReasons(
  projectId: string,
  venueIds: string[],
): Promise<FitReasonMap> {
  "use cache";
  cacheTag(`fit-reason:${projectId}`);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { conditions: true },
  });
  const conditions =
    (project?.conditions as Record<string, unknown> | null) ?? null;
  if (!conditions || Object.keys(conditions).length === 0) {
    return {};
  }

  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds }, projectId },
    select: {
      id: true,
      name: true,
      location: true,
      accessInfo: true,
      capacityMin: true,
      capacityMax: true,
      ceremonyStyles: true,
      updatedAt: true,
    },
  });

  const conditionsKey = JSON.stringify(conditions);
  const results: FitReasonMap = {};
  const toGenerate: typeof venues = [];

  // Check cache first
  for (const v of venues) {
    const hash = computeInputHash(
      `${v.id}:${v.updatedAt.getTime()}:${conditionsKey}`,
    );
    const cached = await prisma.aiAnalysis.findFirst({
      where: {
        venueId: v.id,
        type: "fit_reason",
        inputHash: hash,
      },
      select: { output: true },
    });
    if (cached?.output) {
      results[v.id] = cached.output;
    } else {
      toGenerate.push(v);
    }
  }

  if (toGenerate.length === 0 || !isClaudeAvailable()) {
    // Fill missing with null so callers can distinguish "no reason generated"
    for (const v of venues) {
      if (!(v.id in results)) results[v.id] = null;
    }
    return results;
  }

  // Generate up to N new fit reasons in parallel — keeps request budget
  // predictable (user sees <=10 extra calls per explore refresh).
  const batch = toGenerate.slice(0, MAX_NEW_PER_CALL);
  await Promise.all(
    batch.map(async (v) => {
      const summary: FitReasonVenueSummary = {
        name: v.name,
        location: v.location,
        capacityMin: v.capacityMin,
        capacityMax: v.capacityMax,
        ceremonyStyles: v.ceremonyStyles,
        accessInfo: v.accessInfo,
        features: null,
      };
      const hash = computeInputHash(
        `${v.id}:${v.updatedAt.getTime()}:${conditionsKey}`,
      );
      try {
        const raw = await withRetry(() =>
          askClaude({
            system: FIT_REASON_PROMPT.system,
            userMessage: FIT_REASON_PROMPT.buildUserMessage(summary, conditions),
            maxTokens: FIT_REASON_PROMPT.maxTokens,
          }),
        );
        const clean = cleanOneLineFit(raw);
        if (clean.length >= 10 && clean.length <= 100) {
          results[v.id] = clean;
          await prisma.aiAnalysis
            .create({
              data: {
                projectId,
                venueId: v.id,
                type: "fit_reason",
                inputHash: hash,
                output: clean,
              },
            })
            .catch(() => {
              // unique violation = another concurrent request won. fine.
            });
        }
      } catch {
        // One bad venue shouldn't poison the whole batch.
      }
    }),
  );

  // Fill any still-missing
  for (const v of venues) {
    if (!(v.id in results)) results[v.id] = null;
  }
  return results;
}
