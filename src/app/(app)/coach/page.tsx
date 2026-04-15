import type { Metadata } from "next";
import { getAIInsights } from "@/server/actions/insights";
import { listCoachSessions, getCoachSession } from "@/server/actions/coach";
import { getHomeData } from "@/server/actions/home";
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

  const [insights, sessions, currentSession, homeData] = await Promise.all([
    getAIInsights(),
    listCoachSessions(),
    sessionId ? getCoachSession(sessionId) : Promise.resolve(null),
    getHomeData(),
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
    />
  );
}
