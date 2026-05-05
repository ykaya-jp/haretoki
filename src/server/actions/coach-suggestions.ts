"use server";

import { prisma } from "@/server/db";
import { requireProjectMembership, requireUser } from "@/server/auth";

/**
 * Layer B4 — Coach proactive suggestions (rule-based, zero AI cost).
 *
 * Looks at where the couple is in the venue-search journey and surfaces
 * 2-3 next-best-action prompts the coach is good at handling. Tapping a
 * suggestion preloads `?prompt=...` on /coach so the user can edit
 * before sending.
 *
 * Why rule-based not RAG: the prompts are short, contextual, and
 * benefit from determinism — a couple who taps the same surface twice
 * should see the same suggestions. A RAG path would add ~200ms +
 * Claude cost for an outcome a state machine resolves in <5ms. We
 * preserve the option to upgrade later (the shape stays compatible).
 */
export interface ProactiveSuggestion {
  id: string;
  /** UI label — shown on the chip / card. 30 chars or less. */
  title: string;
  /** Short context line. 60 chars or less. */
  subtitle: string;
  /** Pre-filled prompt sent to the coach when tapped. Includes any
   *  venue / count / day data we want surfaced in the AI's reply. */
  prompt: string;
  /** Lucide icon name — keep the consumer free to render whichever
   *  matches. Centralised list to keep i18n-ready. */
  iconKey:
    | "heart"
    | "calendar"
    | "receipt"
    | "compare"
    | "countdown"
    | "list"
    | "compass";
}

export async function getCoachProactiveSuggestions(): Promise<
  ProactiveSuggestion[]
> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [venues, favorites, visits, estimates, decision] = await Promise.all([
    prisma.venue.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      take: 30,
    }),
    prisma.venueFavorite.findMany({
      where: { venue: { projectId, deletedAt: null } },
      select: { venue: { select: { id: true, name: true } } },
    }),
    prisma.visit.findMany({
      where: {
        venue: { projectId, deletedAt: null },
        deletedAt: null,
      },
      select: {
        completedAt: true,
        venue: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.estimate.count({
      where: { venue: { projectId, deletedAt: null } },
    }),
    prisma.decision.findFirst({
      where: { projectId },
      select: {
        venue: { select: { name: true } },
        weddingDate: true,
      },
    }),
  ]);

  const venueCount = venues.length;
  const favoriteCount = favorites.length;
  const completedVisits = visits.filter((v) => v.completedAt !== null);
  const visitedCount = completedVisits.length;

  const suggestions: ProactiveSuggestion[] = [];

  // Path 1: no venues yet — handled by CoachQuickStart's zero-state.
  if (venueCount === 0) {
    return suggestions;
  }

  // Path 2: decided — countdown coaching takes over.
  if (decision) {
    const venueName = decision.venue.name;
    const days = decision.weddingDate
      ? Math.max(
          0,
          Math.ceil(
            (decision.weddingDate.getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

    suggestions.push({
      id: "decision-countdown",
      title: days !== null ? `晴れの日まで ${days} 日` : "晴れの日に向けて",
      subtitle: "次の準備ステップを聞く",
      prompt: `${venueName} に決めました。${days !== null ? `あと ${days} 日です。` : ""}次に準備しておくべきことを優先順位付きで教えてください。`,
      iconKey: "countdown",
    });
    suggestions.push({
      id: "decision-budget-final",
      title: "最終費用の見直し",
      subtitle: "支払い前にチェックすべき項目",
      prompt: `${venueName} の支払い前に最終確認すべき費用項目を、見落としがちな順に挙げてください。`,
      iconKey: "receipt",
    });
    return suggestions;
  }

  // Path 3: has venues + favorites + visits + estimates — comparison
  // is the natural next step.
  if (favoriteCount >= 2 && estimates >= 2) {
    const top2 = favorites.slice(0, 2).map((f) => f.venue.name).join(" と ");
    suggestions.push({
      id: "compare-top-favorites",
      title: `${top2} を比べる`,
      subtitle: "見積もりと評価を並べて、決め手を探す",
      prompt: `${top2} の 2 件を比べたいです。見積もりの違い、上がりやすい項目、雰囲気の違いを整理してください。`,
      iconKey: "compare",
    });
  }

  // Path 4: visits done but no estimate — push for estimate.
  if (visitedCount >= 1 && estimates === 0) {
    const recent = completedVisits[0]?.venue.name ?? "見学した式場";
    suggestions.push({
      id: "visit-without-estimate",
      title: `${recent} の見積もり`,
      subtitle: "見学のあとに確認すべきこと",
      prompt: `${recent} を見学しました。見積もりをもらう前に、伝えておくべき希望や条件を教えてください。`,
      iconKey: "receipt",
    });
  }

  // Path 5: favorites but no visits — encourage a visit booking.
  if (favoriteCount >= 1 && visitedCount === 0) {
    const fav = favorites[0]?.venue.name ?? "気になる式場";
    suggestions.push({
      id: "favorite-without-visit",
      title: `${fav} の見学`,
      subtitle: "見学日を決める前に確認すべきこと",
      prompt: `${fav} の見学を考えています。当日に確認すべきポイントと、聞いておくと良い質問を教えてください。`,
      iconKey: "calendar",
    });
  }

  // Path 6: many venues but no favorites — encourage triage.
  if (venueCount >= 4 && favoriteCount === 0) {
    suggestions.push({
      id: "triage-many",
      title: `${venueCount} 件から優先順位を`,
      subtitle: "どこから見ていくか整理",
      prompt: `候補が ${venueCount} 件あります。どんな観点で優先順位を付ければいいか、整理を手伝ってください。`,
      iconKey: "list",
    });
  }

  // Path 7: estimates exist — talk about budget vibe.
  if (estimates >= 1 && suggestions.length < 3) {
    suggestions.push({
      id: "budget-reality",
      title: "予算と現実の距離",
      subtitle: "上がりやすい項目を先回り",
      prompt:
        "今集めた見積もりを見て、最終的にいくらまで膨らみそうか、上がりやすい項目を含めて相談したいです。",
      iconKey: "receipt",
    });
  }

  // Always cap at 3 — UI gets cluttered above that and the 3rd is
  // always a "general" fallback so the section never feels empty when
  // we have at least 1 venue.
  return suggestions.slice(0, 3);
}
