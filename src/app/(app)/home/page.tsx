import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { getPendingInvitation } from "@/server/actions/invitations";
import { EditorialHero } from "@/components/home/editorial-hero";
import { AIInsightCard } from "@/components/ai/insight-card";
import { RecentVenues } from "@/components/home/recent-venues";

export const metadata: Metadata = {
  title: "ホーム",
  description: "おふたりの式場選びの進捗と、次にとるべき一歩を確認。",
};

export default async function HomePage() {
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
  const showInsight = topInsight && progress.totalVenues > 0;

  return (
    <div className="space-y-12">
      <EditorialHero
        userName={homeData.userName}
        totalVenues={progress.totalVenues}
        visitedVenues={progress.visitedVenues}
        favoriteCount={progress.favoriteCount}
        hasDecision={progress.hasDecision}
        upcomingVisits={progress.upcomingVisits}
        percentage={progress.percentage}
      />

      <RecentVenues venues={homeData.recentVenues} />

      {showInsight && (
        <AIInsightCard
          type={topInsight.type}
          title={topInsight.title}
          body={topInsight.body}
          actions={topInsight.actions}
        />
      )}
    </div>
  );
}
