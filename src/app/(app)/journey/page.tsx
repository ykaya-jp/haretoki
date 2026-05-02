import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getJourneyMilestones } from "@/server/actions/journey";
import { JourneyTimeline } from "@/components/journey/journey-timeline";
import { CountdownCard } from "@/components/home/countdown-card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "晴れまでの道",
  description: "おふたりのここまでと、これから",
};

export default async function JourneyPage() {
  const { milestones, projectCreatedAt } = await getJourneyMilestones();

  const startYear = projectCreatedAt.toLocaleDateString("ja-JP", {
    year: "numeric",
    timeZone: "Asia/Tokyo",
  });

  // D1-4 (Phase 3 商用化準備): `getJourneyMilestones` always returns 5
  // rows (はじまり / 候補 / 見学 / 見積 / 決定). To detect "fresh project,
  // nothing happened yet" we sum the activity count across the 4 non-
  // "start" rows — if every venture is at zero, the timeline would
  // render as 4 cloudy stubs which reads as broken rather than as
  // "we just started". Show the EmptyState instead, CTA → /explore
  // so the couple lands on the place that actually moves the timeline.
  const totalActivity = milestones
    .filter((m) => m.id !== "start")
    .reduce((sum, m) => sum + m.count, 0);
  const isEmpty = totalActivity === 0;

  return (
    <div className="space-y-10">
      {/* Header — breadcrumb eyebrow + editorial title */}
      <header className="space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-eyebrow text-muted-foreground">
          <Link
            href="/home"
            prefetch={true}
            className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <span aria-hidden="true" className="opacity-30">/</span>
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Journey</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span className="tabular-nums normal-case tracking-normal text-[12px]">
            {startYear}
          </span>
        </p>

        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[26px] font-light leading-[1.22] tracking-[-0.01em] text-foreground">
            晴れまでの道
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            おふたりのここまでと、これから。
          </p>
        </div>
      </header>

      {/* Gradient hairline */}
      <div
        aria-hidden="true"
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--gold-warm) 40%, transparent) 30%, color-mix(in oklab, var(--gold-warm) 40%, transparent) 70%, transparent 100%)",
        }}
      />

      {isEmpty ? (
        <EmptyState
          icon={Sparkles}
          title="ふたりの式場さがしの記録は、まだ始まったばかり"
          description="探した式場、見学日、決めた式場が、ここに時系列で残っていきます。最初の一歩は、気になる式場をひとつ覗いてみることから。"
          action={{ label: "式場をさがす", href: "/explore" }}
        />
      ) : (
        <>
          {/* C-2: Countdown card lands above the timeline so the "future" frame
              (晴れの日まで) sits before the "past" frame (timeline). Returns
              null pre-decision so the journey page is unchanged for couples
              still venue-hunting. */}
          <CountdownCard />

          {/* Timeline */}
          <section aria-label="マイルストーン一覧">
            <JourneyTimeline milestones={milestones} />
          </section>
        </>
      )}
    </div>
  );
}
