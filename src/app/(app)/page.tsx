import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { Greeting } from "@/components/home/greeting";
import { AIInsightCard } from "@/components/ai/insight-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { QuickActions } from "@/components/home/quick-actions";
import { RecentVenues } from "@/components/home/recent-venues";

export default async function HomePage() {
  const homeData = await getHomeData();
  const insights = await getAIInsights(homeData.project.id);
  const topInsight = insights[0];

  return (
    <div className="space-y-6">
      <Greeting userName={homeData.userName} />

      {/* Bento Grid: AI Insight (2/3) + Progress Ring (1/3) */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          {topInsight ? (
            <AIInsightCard
              type={topInsight.type}
              title={topInsight.title}
              body={topInsight.body}
              actions={topInsight.actions}
            />
          ) : (
            <AIInsightCard
              type="visit"
              title="はじめましょう"
              body="式場を追加して、比較を始めましょう。"
              actions={[{ label: "式場を探す", href: "/explore" }]}
            />
          )}
        </div>
        <div className="flex items-center justify-center rounded-lg bg-card shadow-[var(--shadow-card)] p-3">
          <ProgressRing
            progress={homeData.progress.percentage}
            completedSteps={
              [
                homeData.progress.totalVenues > 0,
                homeData.progress.visitedVenues > 0,
                homeData.progress.estimateCount > 0,
                homeData.progress.favoriteCount >= 2,
                homeData.progress.hasDecision,
              ].filter(Boolean).length
            }
            totalSteps={5}
          />
        </div>
      </div>

      <QuickActions />

      <RecentVenues venues={homeData.recentVenues} />
    </div>
  );
}
