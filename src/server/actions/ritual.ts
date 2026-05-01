"use server";

import { cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/server/db";
import {
  requireUser,
  requireProjectMembership,
} from "@/server/auth";
import {
  isClaudeAvailable,
  askClaude,
  withRetry,
} from "@/lib/anthropic";
import {
  RITUAL_PROMPT,
  parseRitualOutput,
  type RitualContext,
  type Weather,
} from "@/lib/prompts/ritual";
import { parseConditions } from "@/lib/schemas";

export interface DailyRitualView {
  weather: Weather;
  headline: string;
  mood: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  /** True if generated from template fallback (Claude unavailable). */
  fallback: boolean;
}

/** JST date (YYYY-MM-DD) as a Date set at 00:00 UTC for Prisma `@db.Date`. */
function jstToday(): Date {
  const now = new Date();
  // shift to JST (+9h), then truncate to midnight, then back to UTC midnight
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const jst = new Date(jstMs);
  return new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()),
  );
}

/**
 * Build the context for Claude (or template). Pure DB read, no mutation —
 * safe to call inside `"use cache"`.
 */
async function buildRitualContext(projectId: string): Promise<RitualContext> {
  const [project, venues, favorites, decision, latestEstimate] =
    await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { conditions: true },
      }),
      prisma.venue.findMany({
        where: { projectId },
        select: { id: true, name: true, status: true },
      }),
      prisma.venueFavorite.findMany({
        where: { venue: { projectId } },
        include: { venue: { select: { name: true, scores: true } } },
      }),
      prisma.decision.findUnique({
        where: { projectId },
        include: { venue: { select: { name: true } } },
      }),
      prisma.estimate.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        select: { total: true },
      }),
    ]);

  const venueCount = venues.length;
  const visitedCount = venues.filter(
    (v) => v.status === "visited" || v.status === "selected",
  ).length;
  const favoriteCount = favorites.length;
  const hasDecision = !!decision;

  // 本命のうちユーザー評価 (user_rating) が 0 件のものがあるか
  const hasUnratedFavorite = favorites.some(
    (f) =>
      !f.venue.scores.some(
        (s: { source: string }) => s.source === "user_rating",
      ),
  );

  let stage: RitualContext["stage"];
  if (hasDecision) stage = "decided";
  else if (favoriteCount >= 2) stage = "comparing";
  else if (visitedCount >= 1) stage = "visiting";
  else if (venueCount >= 1) stage = "adding";
  else stage = "start";

  return {
    stage,
    venueCount,
    visitedCount,
    favoriteCount,
    hasDecision,
    decisionVenueName: decision?.venue?.name,
    favoriteNames: favorites.slice(0, 3).map((f) => f.venue.name),
    latestEstimateTotalYen: latestEstimate?.total ?? undefined,
    hasUnratedFavorite,
    conditions: parseConditions(project?.conditions),
  };
}

/**
 * Deterministic fallback when Claude is unavailable / parse-fails. Keeps the
 * brand voice without LLM access. NEVER blocks the home page.
 */
function templateRitual(ctx: RitualContext): DailyRitualView {
  if (ctx.stage === "decided" && ctx.decisionVenueName) {
    return {
      weather: "sunny",
      headline: "晴れの日に、向かって。",
      mood: `${ctx.decisionVenueName} の準備を、ゆっくり進めていきましょう。`,
      ctaLabel: "準備を見る",
      ctaHref: "/candidates",
      fallback: true,
    };
  }
  if (ctx.stage === "comparing") {
    return {
      weather: "clear",
      headline: "ふたりで、並べてみよう。",
      mood: `候補 ${ctx.favoriteCount} 件。比べるほど、輪郭が見えてきます。`,
      ctaLabel: "比べる",
      ctaHref: "/candidates",
      fallback: true,
    };
  }
  if (ctx.stage === "visiting") {
    return {
      weather: "break",
      headline: "印象を、忘れないうちに。",
      mood: ctx.hasUnratedFavorite
        ? "候補にまだ印象を残していない式場があります。"
        : "気になったこと、写真と一緒に残しておきましょう。",
      ctaLabel: "印象を残す",
      ctaHref: "/candidates",
      fallback: true,
    };
  }
  if (ctx.stage === "adding") {
    return {
      weather: "break",
      headline: "少しずつ、見えてきました。",
      mood: "次は、見学の日取りを入れてみませんか？",
      ctaLabel: "見学を入れる",
      ctaHref: "/candidates",
      fallback: true,
    };
  }
  return {
    weather: "cloudy",
    headline: "まだ見ぬ、あの一日へ。",
    mood: "URL を貼るだけ。あとは晴れ時がそっと集めます。",
    ctaLabel: "式場を見てみる",
    ctaHref: "/explore",
    fallback: true,
  };
}

/**
 * Public Server Action. Returns today's ritual for the current user's
 * project. Cached daily via `"use cache"` + cacheTag — same-day repeat hits
 * are 0 DB queries.
 */
export async function getTodayRitual(): Promise<DailyRitualView | null> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return fetchTodayRitual(projectId);
}

async function fetchTodayRitual(projectId: string): Promise<DailyRitualView | null> {
  "use cache";
  const today = jstToday();
  const todayKey = today.toISOString().slice(0, 10);
  cacheTag(`ritual:${projectId}:${todayKey}`);

  // 1. DB cache hit (same-day, already generated)
  const existing = await prisma.dailyRitual.findUnique({
    where: { projectId_date: { projectId, date: today } },
  });
  if (existing) {
    return {
      weather: existing.weather as Weather,
      headline: existing.headline,
      mood: existing.mood,
      ctaLabel: existing.ctaLabel,
      ctaHref: existing.ctaHref,
      fallback: false,
    };
  }

  // 2. Build context (1 DB roundtrip wave)
  const ctx = await buildRitualContext(projectId);

  // 3. Try Claude. On any error, fall back to template (NEVER fail).
  let view: DailyRitualView;
  if (!isClaudeAvailable()) {
    view = templateRitual(ctx);
  } else {
    try {
      const raw = await withRetry(() =>
        askClaude({
          system: RITUAL_PROMPT.system,
          userMessage: RITUAL_PROMPT.buildUserMessage(ctx),
          maxTokens: RITUAL_PROMPT.maxTokens,
        }),
      );
      const parsed = parseRitualOutput(raw);
      view = parsed
        ? { ...parsed, fallback: false }
        : templateRitual(ctx);
    } catch {
      view = templateRitual(ctx);
    }
  }

  // 4. Persist (best-effort) so subsequent same-day reads are 0-LLM
  await prisma.dailyRitual
    .upsert({
      where: { projectId_date: { projectId, date: today } },
      create: {
        projectId,
        date: today,
        weather: view.weather,
        headline: view.headline,
        mood: view.mood,
        ctaLabel: view.ctaLabel,
        ctaHref: view.ctaHref,
      },
      update: {
        weather: view.weather,
        headline: view.headline,
        mood: view.mood,
        ctaLabel: view.ctaLabel,
        ctaHref: view.ctaHref,
      },
    })
    .catch(() => {
      // cache write failure is non-fatal — the user still sees a ritual.
    });

  return view;
}

/** Mark the ritual as seen (lightweight UI telemetry). */
export async function markRitualSeen(): Promise<void> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  const today = jstToday();
  await prisma.dailyRitual
    .updateMany({
      where: { projectId, date: today, seenAt: null },
      data: { seenAt: new Date() },
    })
    .catch(() => {});
}

/** Mark the ritual CTA as tapped. */
export async function markRitualActed(): Promise<void> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  const today = jstToday();
  await prisma.dailyRitual
    .updateMany({
      where: { projectId, date: today, actedAt: null },
      data: { actedAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Cron entry point — generate today's ritual for every active project.
 * Idempotent (upsert), safe to retry. Skip projects already generated.
 */
export async function generateRitualsForAllActiveProjects(): Promise<{
  attempted: number;
  generated: number;
  skipped: number;
  failed: number;
}> {
  const today = jstToday();
  const projects = await prisma.project.findMany({
    where: {
      members: { some: { acceptedAt: { not: null } } },
    },
    select: { id: true },
  });

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  // Prefetch every project's today-ritual in one round-trip rather than
  // one findUnique per project. The unique (project_id, date) constraint
  // already covers this filter shape, so the index plan is identical to
  // the per-row lookup but the network cost collapses to a single call.
  // Generation itself stays sequential below to keep Claude API rate
  // limits predictable.
  const projectIds = projects.map((p) => p.id);
  const existingRows = projectIds.length > 0
    ? await prisma.dailyRitual.findMany({
        where: { date: today, projectId: { in: projectIds } },
        select: { projectId: true },
      })
    : [];
  const alreadyGenerated = new Set(existingRows.map((r) => r.projectId));

  for (const p of projects) {
    if (alreadyGenerated.has(p.id)) {
      skipped++;
      continue;
    }
    try {
      await fetchTodayRitual(p.id);
      generated++;
      // Invalidate cache so the user's next request reads the fresh row
      revalidateTag(`ritual:${p.id}:${today.toISOString().slice(0, 10)}`, { expire: 0 });
    } catch {
      failed++;
    }
  }

  return { attempted: projects.length, generated, skipped, failed };
}
