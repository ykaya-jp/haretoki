import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { Greeting } from "@/components/home/greeting";
import { AIInsightCard } from "@/components/ai/insight-card";
import { JourneyCard } from "@/components/home/journey-card";
import { RecentVenues } from "@/components/home/recent-venues";
import { Settings } from "lucide-react";
import Link from "next/link";

export default async function HomePage() {
  const homeData = await getHomeData();
  const insights = await getAIInsights();
  const topInsight = insights[0];

  return (
    <div className="space-y-6">
      {/* Header: greeting + settings icon */}
      <div className="flex items-center justify-between">
        <Greeting userName={homeData.userName} />
        <Link
          href="/settings"
          className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors active:bg-muted"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">設定</span>
        </Link>
      </div>

      {/* Journey Card — the hero of home */}
      <JourneyCard
        totalVenues={homeData.progress.totalVenues}
        visitedVenues={homeData.progress.visitedVenues}
        favoriteCount={homeData.progress.favoriteCount}
        hasDecision={homeData.progress.hasDecision}
        upcomingVisits={homeData.progress.upcomingVisits}
      />

      {/* AI Insight — if available */}
      {topInsight && (
        <AIInsightCard
          type={topInsight.type}
          title={topInsight.title}
          body={topInsight.body}
          actions={topInsight.actions}
        />
      )}

      {/* Recent venues */}
      <RecentVenues venues={homeData.recentVenues} />
    </div>
  );
}
