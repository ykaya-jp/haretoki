import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { getPendingInvitation } from "@/server/actions/invitations";
import { getTodayRitual } from "@/server/actions/ritual";
import { HomeCover } from "@/components/home/home-cover";
import { HomePulse } from "@/components/home/home-pulse";
import { HomeWhisper } from "@/components/home/home-whisper";
import { TimeEcho } from "@/components/home/time-echo";
import { AIInsightCard } from "@/components/ai/insight-card";
import { RecentVenues } from "@/components/home/recent-venues";
import { getHomeStage } from "@/components/home/home-stage";

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

  const { dateLabel, timeOfDayLabel } = jstTodayLabel();

  const progress = homeData.progress;
  const firstVenue = homeData.recentVenues[0] ?? null;
  const stage = getHomeStage({
    totalVenues: progress.totalVenues,
    visitedVenues: progress.visitedVenues,
    favoriteCount: progress.favoriteCount,
    hasDecision: progress.hasDecision,
    firstVenueId: firstVenue?.id ?? null,
  });

  // Prefer AI-generated ritual copy + CTA, fall back to stage-derived.
  const headline = ritual?.headline ?? stage.headline;
  const sub = ritual?.mood ?? stage.sub;
  const ctaLabel = ritual?.ctaLabel ?? stage.ctaLabel;
  const ctaHref = ritual?.ctaHref ?? stage.ctaHref;
  const isRitualCta = !!ritual?.ctaHref && !!ritual?.ctaLabel;
  const weather = ritual?.weather ?? stage.fallbackWeather;

  const topInsight = insights[0];
  const showInsight = topInsight && progress.totalVenues > 0;

  // Cover takes recentVenues[0] as hero photo — Recent carousel shows the rest.
  const carouselVenues = homeData.recentVenues.slice(1);

  return (
    <div className="space-y-12">
      <HomeCover
        dateLabel={dateLabel}
        timeOfDayLabel={timeOfDayLabel}
        userName={homeData.userName}
        headline={headline}
        sub={sub}
        weather={weather}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
        coverVenue={firstVenue}
        isRitualCta={isRitualCta}
      />

      <HomePulse
        totalVenues={progress.totalVenues}
        visitedVenues={progress.visitedVenues}
        favoriteCount={progress.favoriteCount}
        hasDecision={progress.hasDecision}
        upcomingVisits={progress.upcomingVisits}
        percentage={progress.percentage}
      />

      {carouselVenues.length > 0 && <RecentVenues venues={carouselVenues} />}

      {/* Journey note — editorial hairline + eyebrow + link. */}
      <div className="border-l border-border/60 pl-4 py-2">
        <p className="mb-1 text-[10px] tracking-[0.16em] uppercase text-muted-foreground">
          Journey
        </p>
        <Link
          href="/journey"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center gap-1.5 font-[family-name:var(--font-display)] text-[14px] font-light text-foreground underline-offset-4 hover:underline"
        >
          晴れまでの道
          <span aria-hidden="true" className="text-muted-foreground">→</span>
        </Link>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          ふたりの歩みを、一筋の道に。
        </p>
      </div>

      {showInsight && (
        <AIInsightCard
          type={topInsight.type}
          title={topInsight.title}
          body={topInsight.body}
          actions={
            topInsight.actions?.[0]?.href?.startsWith("/candidates")
              ? []
              : topInsight.actions
          }
        />
      )}

      {ritual && <HomeWhisper ritual={ritual} />}

      <TimeEcho firstVenue={homeData.firstVenue} />
    </div>
  );
}
