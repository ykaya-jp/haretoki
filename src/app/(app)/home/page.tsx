import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { getPendingInvitation } from "@/server/actions/invitations";
import { getTodayRitual } from "@/server/actions/ritual";
import { HomeCover } from "@/components/home/home-cover";
import { HomePulse } from "@/components/home/home-pulse";
import { TimeEcho } from "@/components/home/time-echo";
import { AIInsightCard } from "@/components/ai/insight-card";
import { RecentVenues } from "@/components/home/recent-venues";
import { getHomeStage } from "@/components/home/home-stage";
import { NextStepsCard } from "@/components/decision-todos/next-steps-card";
import { CountdownCard } from "@/components/home/countdown-card";
import { InvitationArrivalToast } from "@/components/home/invitation-arrival-toast";
import { PartnerWelcomeModal } from "@/components/onboarding/partner-welcome-modal";
import { PreferencePulseCard } from "@/components/home/preference-pulse-card";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { prisma } from "@/server/db";

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
  // Auth + role first so the welcome-modal gate has the answer
  // ready before we kick off the home data fetches.
  const user = await requireUser();
  const membership = await requireProjectMembership(user.id);
  const isPartner = membership.role === "partner";

  const [pendingInvitation, homeData, insights, ritual, ownerName] =
    await Promise.all([
      getPendingInvitation(),
      getHomeData(),
      getAIInsights(),
      getTodayRitual(),
      // D3: only fetch the owner name when the viewer is a partner.
      // Owners don't need it (the modal never renders for them) and
      // skipping the query keeps the home-page TTFB unchanged for the
      // common case.
      isPartner ? resolveOwnerName(membership.projectId) : null,
    ]);

  if (pendingInvitation) {
    redirect("/accept-invite");
  }

  const { dateLabel, timeOfDayLabel } = jstTodayLabel();

  const progress = homeData.progress;
  const firstVenue = homeData.recentVenues[0] ?? null;
  // Top 2 favorite ids feed the duel CTA when favoriteCount === 2.
  // homeData may or may not expose them directly; derive from the
  // recentVenues array as a best-effort (venue.isFavorite flag if
  // present, otherwise fall back to nulls so the stage helper routes
  // to the generic compare page instead of a broken URL).
  const favoriteVenueIds = (
    homeData.recentVenues as Array<{ id: string; isFavorite?: boolean }>
  )
    .filter((v) => v.isFavorite !== false)
    .slice(0, 2)
    .map((v) => v.id);
  const stage = getHomeStage({
    totalVenues: progress.totalVenues,
    visitedVenues: progress.visitedVenues,
    favoriteCount: progress.favoriteCount,
    hasDecision: progress.hasDecision,
    firstVenueId: firstVenue?.id ?? null,
    favoriteAId: favoriteVenueIds[0] ?? null,
    favoriteBId: favoriteVenueIds[1] ?? null,
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

  // H-7: Hero NBA and AIInsightCard can both point the user at the same
  // next step (e.g. both say "/candidates"). When the insight's primary
  // action is the same path as the cover CTA, strip the action so the
  // card still delivers its copy but doesn't duplicate the button. Path
  // comparison ignores query / hash so "/candidates" and
  // "/candidates?view=recent" count as the same destination.
  const stripRoute = (h: string | null | undefined): string =>
    h ? h.split("?")[0].split("#")[0] : "";
  const heroRoute = stripRoute(ctaHref);
  const insightActions = topInsight?.actions ?? [];
  const dedupedInsightActions =
    heroRoute && insightActions.length > 0 &&
    stripRoute(insightActions[0]?.href) === heroRoute
      ? []
      : insightActions;

  // Cover takes recentVenues[0] as hero photo — Recent carousel shows the rest.
  const carouselVenues = homeData.recentVenues.slice(1);

  return (
    <div className="space-y-12">
      {/* W20-4: surface invitation merge result via Sonner toast. Renders
          nothing — reads `?invited=1&discarded=N` once on mount and
          rewrites the URL so refreshes don't re-fire. */}
      <InvitationArrivalToast />
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
        hasRitual={!!ritual}
        stageKey={stage.key}
      />

      {/* C-2: post-decision wedding-day countdown. Server Component returns
          null when there's no Decision, so pre-decision users still see the
          unchanged hero. After a decision lands the countdown becomes the
          dominant card and "Next steps" sits underneath as the action body. */}
      {progress.hasDecision && <CountdownCard />}

      {/* F3: Post-decision "Next steps" card. Server Component — returns null
          when there's no decision or all todos are complete, so heroes stay
          unchanged for pre-decision users. */}
      {progress.hasDecision && <NextStepsCard />}

      <HomePulse
        totalVenues={progress.totalVenues}
        visitedVenues={progress.visitedVenues}
        favoriteCount={progress.favoriteCount}
        hasDecision={progress.hasDecision}
        upcomingVisits={progress.upcomingVisits}
        percentage={progress.percentage}
      />

      {carouselVenues.length > 0 && <RecentVenues venues={carouselVenues} />}

      {/* Cycle 2 magic — visualises the preference vector so couples see
          the AI is learning. Returns null on cold-start, and we hide it
          for already-decided couples (their focus is countdown, not
          discovery). */}
      {!progress.hasDecision && <PreferencePulseCard />}

      {/* Journey note — editorial hairline + eyebrow + link.
          When the couple has venues, surface the Wrapped link as a
          peer entry: /journey is the chronological timeline, /wrapped
          is the editorial story. They're discovery-twins, both worth
          one tap from /home. */}
      <div className="border-l-2 border-[color-mix(in_oklab,var(--gold-warm)_35%,transparent)] pl-4 py-2">
        <p className="mb-1 text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
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
        {progress.totalVenues > 0 && (
          <Link
            href="/wrapped"
            prefetch={true}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] text-[var(--gold-warm)] underline-offset-4 hover:underline"
          >
            ふたりの式場さがし、ふりかえる
            <span aria-hidden="true" className="opacity-70">→</span>
          </Link>
        )}
      </div>

      {/* Upcoming visits nudge — lifted off the gold pill styling in
          favour of a quieter hairline row. Cover CTA is the only gold
          primary on Home; this nudge now reads as tertiary alongside
          the Journey link above. */}
      {progress.upcomingVisits > 0 && (
        <Link
          href="/visits"
          prefetch={true}
          className="flex min-h-[44px] items-center gap-2 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Calendar aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <span>
            見学予定が{" "}
            <span className="tabular-nums font-medium text-foreground">
              {progress.upcomingVisits}
            </span>{" "}
            件 あります
          </span>
          <span aria-hidden className="ml-auto">→</span>
        </Link>
      )}

      {showInsight && (
        <AIInsightCard
          type={topInsight.type}
          title={topInsight.title}
          body={topInsight.body}
          actions={dedupedInsightActions}
        />
      )}

      <TimeEcho firstVenue={homeData.firstVenue} />

      {/* D3 partner welcome modal — server-gated by isPartner so an
          owner never receives this component in their tree. The
          client component layers a localStorage dismiss check on
          top so a partner only sees it once per device. */}
      {isPartner && ownerName && (
        <PartnerWelcomeModal ownerName={ownerName} />
      )}
    </div>
  );
}

/**
 * Resolves the owner's display name for the welcome modal. Falls
 * back to "おふたりの相棒" when the owner has not set a profile
 * name yet so the modal headline ("{owner name}さんに招かれて、…")
 * still reads as a sentence.
 *
 * Kept inline with the page (rather than promoted to
 * server/actions/projects.ts) because this is the only caller and
 * the query shape is minimal — adding a new exported action would
 * be over-engineered for a single welcome surface.
 */
async function resolveOwnerName(projectId: string): Promise<string> {
  const owner = await prisma.projectMember.findFirst({
    where: { projectId, role: "owner" },
    select: { user: { select: { name: true } } },
  });
  const name = owner?.user?.name?.trim();
  return name && name.length > 0 ? name : "おふたりの相棒";
}
