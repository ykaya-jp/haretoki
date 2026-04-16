import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { getPendingInvitation } from "@/server/actions/invitations";
import { getTodayRitual } from "@/server/actions/ritual";
import { EditorialHero } from "@/components/home/editorial-hero";
import { AIInsightCard } from "@/components/ai/insight-card";
import { RecentVenues } from "@/components/home/recent-venues";
import { DailyRitual } from "@/components/home/daily-ritual";

export const metadata: Metadata = {
  title: "ホーム",
  description: "おふたりの式場選びの進捗と、次にとるべき一歩を確認。",
};

/** Server-render JST today label so it stays stable across hydration. */
function jstTodayLabel(): { dateLabel: string; timeOfDayLabel: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const parts = fmt.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = (parts.find((p) => p.type === "month")?.value ?? "").toUpperCase();
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const dateLabel = `${year} ${month} ${day}`;

  // JST hour for time-of-day label
  const hourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    hour12: false,
  });
  const h = parseInt(hourFmt.format(new Date()), 10);
  const timeOfDayLabel =
    h < 5 ? "夜" : h < 11 ? "朝" : h < 15 ? "昼" : h < 18 ? "午後" : h < 22 ? "夕" : "夜";

  return { dateLabel, timeOfDayLabel };
}

export default async function HomePage() {
  const [pendingInvitation, homeData, insights, ritual] = await Promise.all([
    getPendingInvitation(),
    getHomeData(),
    getAIInsights(),
    getTodayRitual(),
  ]);

  if (pendingInvitation) {
    redirect("/accept-invite");
  }

  const topInsight = insights[0];
  const progress = homeData.progress;
  const showInsight = topInsight && progress.totalVenues > 0;

  const { dateLabel, timeOfDayLabel } = jstTodayLabel();

  return (
    <div className="space-y-10">
      {ritual && (
        <DailyRitual
          ritual={ritual}
          todayLabel={dateLabel}
          timeOfDayLabel={timeOfDayLabel}
        />
      )}

      <EditorialHero
        userName={homeData.userName}
        totalVenues={progress.totalVenues}
        visitedVenues={progress.visitedVenues}
        favoriteCount={progress.favoriteCount}
        hasDecision={progress.hasDecision}
        upcomingVisits={progress.upcomingVisits}
        percentage={progress.percentage}
        compact={!!ritual}
        dateLabel={dateLabel}
        timeOfDayLabel={timeOfDayLabel}
      />

      <RecentVenues venues={homeData.recentVenues} />

      <Link
        href="/journey"
        prefetch={false}
        className="group flex min-h-[64px] items-center justify-between gap-3 border-l-2 pl-4 pr-1 py-3.5 transition active:opacity-70"
        style={{
          borderLeftColor:
            "color-mix(in oklab, var(--gold-warm) 50%, transparent)",
        }}
      >
        <div className="min-w-0">
          <p className="text-[10.5px] tracking-[0.18em] uppercase text-[var(--gold-warm)]">
            Journey
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-[-0.005em] text-foreground">
            晴れまでの道をみる
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            ここまでの歩み、これからの 5 つの節目
          </p>
        </div>
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-[var(--gold-warm)] transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.6}
        />
      </Link>


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
