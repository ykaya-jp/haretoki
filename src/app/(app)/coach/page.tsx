import type { Metadata } from "next";
import { getAIInsights } from "@/server/actions/insights";
import {
  listCoachSessions,
  getCoachSession,
  markCoachInsightsSeen,
} from "@/server/actions/coach";
import { getHomeData } from "@/server/actions/home";
import { getAgreements } from "@/server/actions/agreements";
import { getCoachProactiveSuggestions } from "@/server/actions/coach-suggestions";
import { CoachClient } from "@/components/coach/coach-client";
import {
  selectNightQuestion,
  stageFromCounts,
} from "@/lib/night-questions";

export const metadata: Metadata = {
  title: "AIコーチ",
  description: "見積もりの落とし穴や次の一手を、AIコーチが先回りで教えてくれます。",
};

interface CoachPageProps {
  searchParams: Promise<{ session?: string; prompt?: string }>;
}

export default async function CoachPage({ searchParams }: CoachPageProps) {
  const { session: sessionId } = await searchParams;

  const [
    insights,
    sessions,
    currentSession,
    homeData,
    agreements,
    proactiveSuggestions,
  ] = await Promise.all([
    getAIInsights(),
    listCoachSessions(),
    sessionId ? getCoachSession(sessionId) : Promise.resolve(null),
    getHomeData(),
    getAgreements(),
    getCoachProactiveSuggestions(),
    // Reset the bottom-nav コーチ badge to 0. Bumps
    // ProjectMember.coachInsightsSeenAt so the layout's badge query
    // counts only AI analyses created AFTER this visit. Fire-and-
    // forget semantics (failure is logged inside the action and
    // doesn't block render). Awaited via Promise.all so the
    // revalidateTag inside settles before the bottom nav re-reads.
    markCoachInsightsSeen(),
  ]);

  // R-5 今夜の一問: deterministic pick from stage + day-of-year
  const stage = stageFromCounts({
    venueCount: homeData.progress.totalVenues,
    visitedCount: homeData.progress.visitedVenues,
    favoriteCount: homeData.progress.favoriteCount,
    hasDecision: homeData.progress.hasDecision,
  });
  const nightQuestion = selectNightQuestion(stage);

  return (
    <CoachClient
      sessions={sessions}
      currentSession={currentSession}
      currentSessionId={sessionId}
      insights={insights}
      nightQuestion={nightQuestion}
      proactiveSuggestions={proactiveSuggestions}
      agreements={agreements.map((a) => ({
        id: a.id,
        text: a.text,
        status: a.status,
      }))}
    />
  );
}
