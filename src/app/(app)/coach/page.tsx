import type { Metadata } from "next";
import { getAIInsights } from "@/server/actions/insights";
import { listCoachSessions, getCoachSession } from "@/server/actions/coach";
import { CoachClient } from "@/components/coach/coach-client";

export const metadata: Metadata = {
  title: "AIコーチ",
  description: "見積もりの落とし穴や次の一手を、AIコーチが先回りで教えてくれます。",
};

interface CoachPageProps {
  searchParams: Promise<{ session?: string }>;
}

export default async function CoachPage({ searchParams }: CoachPageProps) {
  const { session: sessionId } = await searchParams;

  const [insights, sessions, currentSession] = await Promise.all([
    getAIInsights(),
    listCoachSessions(),
    sessionId ? getCoachSession(sessionId) : Promise.resolve(null),
  ]);

  return (
    <CoachClient
      sessions={sessions}
      currentSession={currentSession}
      currentSessionId={sessionId}
      insights={insights}
    />
  );
}
