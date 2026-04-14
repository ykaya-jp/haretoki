import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { getPendingInvitation } from "@/server/actions/invitations";
import { Greeting } from "@/components/home/greeting";
import { AIInsightCard } from "@/components/ai/insight-card";
import { JourneyCard } from "@/components/home/journey-card";
import { RecentVenues } from "@/components/home/recent-venues";

export const metadata: Metadata = {
  title: "ホーム",
  description: "おふたりの式場選びの進捗と、次にとるべきステップを一目で確認。",
};

export default async function HomePage() {
  // Run all independent fetches in parallel. getPendingInvitation no longer
  // blocks getHomeData/getAIInsights — we simply act on its result after all
  // three have resolved. requireUser/requireProjectMembership are React.cache
  // so the extra calls inside getHomeData/getAIInsights are free.
  const [pendingInvitation, homeData, insights] = await Promise.all([
    getPendingInvitation(),
    getHomeData(),
    getAIInsights(),
  ]);

  if (pendingInvitation) {
    redirect("/accept-invite");
  }
  const topInsight = insights[0];

  return (
    // V1 Visual: asymmetric vertical rhythm — generous 64px gap before the
    // hero, then tighter 40px between secondary surfaces. Replaces the
    // mechanical space-y-12 stamp.
    <div className="space-y-16">
      {/* Home hero — Greeting + JourneyCard sit under a soft sunlight glow.
          Scope limited to this wrapper (not the whole page). */}
      <div className="hero-sunlight-sm space-y-16 -mx-6 px-6 pb-2">
        {/* Greeting */}
        <div>
          <Greeting userName={homeData.userName} />
          <p className="mt-1 text-meta text-muted-foreground">
            今日のおふたりの式場選び
          </p>
        </div>

        {/* Journey Card — the hero of home */}
        <JourneyCard
          totalVenues={homeData.progress.totalVenues}
          visitedVenues={homeData.progress.visitedVenues}
          favoriteCount={homeData.progress.favoriteCount}
          hasDecision={homeData.progress.hasDecision}
          upcomingVisits={homeData.progress.upcomingVisits}
        />
      </div>

      {/* Secondary surfaces — tighter rhythm */}
      <div className="space-y-10">
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
    </div>
  );
}
