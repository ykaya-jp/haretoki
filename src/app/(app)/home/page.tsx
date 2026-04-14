import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { getPendingInvitation } from "@/server/actions/invitations";
import { Greeting } from "@/components/home/greeting";
import { AIInsightCard } from "@/components/ai/insight-card";
import { HeroNba } from "@/components/home/hero-nba";
import { RecentVenues } from "@/components/home/recent-venues";

export const metadata: Metadata = {
  title: "ホーム",
  description: "おふたりの式場選びの進捗と、次にとるべき一歩を確認。",
};

export default async function HomePage() {
  // Run all independent fetches in parallel.
  const [pendingInvitation, homeData, insights] = await Promise.all([
    getPendingInvitation(),
    getHomeData(),
    getAIInsights(),
  ]);

  if (pendingInvitation) {
    redirect("/accept-invite");
  }

  const topInsight = insights[0];
  const progress = homeData.progress;

  // Suppress AI insight when it duplicates the Hero NBA action.
  // Heuristic: hide insight when no venues added yet (onboarding stage — Hero covers it).
  const showInsight = topInsight && progress.totalVenues > 0;

  return (
    <div className="space-y-16">
      {/* Hero section — Greeting + HeroNba under soft sunlight glow */}
      <div className="hero-sunlight-sm space-y-6 -mx-6 px-6 pb-2">
        {/* Greeting */}
        <div>
          <Greeting
            userName={homeData.userName}
            weddingDate={undefined}
          />
        </div>

        {/* Hero NBA — the sole hero of the home screen */}
        <HeroNba
          totalVenues={progress.totalVenues}
          visitedVenues={progress.visitedVenues}
          favoriteCount={progress.favoriteCount}
          hasDecision={progress.hasDecision}
          upcomingVisits={progress.upcomingVisits}
        />
      </div>

      {/* Secondary surfaces */}
      <div className="space-y-10">
        {/* Recent venues */}
        <RecentVenues venues={homeData.recentVenues} />

        {/* AI Insight — conditional, deduped against Hero NBA */}
        {showInsight && (
          <AIInsightCard
            type={topInsight.type}
            title={topInsight.title}
            body={topInsight.body}
            actions={topInsight.actions}
          />
        )}
      </div>
    </div>
  );
}
