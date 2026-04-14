import { redirect } from "next/navigation";
import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { getPendingInvitation } from "@/server/actions/invitations";
import { Greeting } from "@/components/home/greeting";
import { AIInsightCard } from "@/components/ai/insight-card";
import { JourneyCard } from "@/components/home/journey-card";
import { RecentVenues } from "@/components/home/recent-venues";

export default async function HomePage() {
  // If the logged-in user has a pending partner invitation, take them to the
  // accept screen before showing home. This is how a brand-new user who
  // signed up from a shared invite link gets routed into the right project.
  const pendingInvitation = await getPendingInvitation();
  if (pendingInvitation) {
    redirect("/accept-invite");
  }

  const [homeData, insights] = await Promise.all([getHomeData(), getAIInsights()]);
  const topInsight = insights[0];

  return (
    <div className="space-y-12">
      {/* Greeting */}
      <Greeting userName={homeData.userName} />

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
