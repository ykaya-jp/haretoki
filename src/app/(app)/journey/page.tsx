import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getJourneyMilestones } from "@/server/actions/journey";
import { JourneyTimeline } from "@/components/journey/journey-timeline";

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

  return (
    <div className="space-y-10">
      {/* Header — breadcrumb eyebrow + editorial title */}
      <header className="space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-[10.5px] tracking-[0.18em] uppercase text-muted-foreground">
          <Link
            href="/home"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-0.5 normal-case tracking-normal text-[12px] hover:opacity-70"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            戻る
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
          <h1 className="font-[family-name:var(--font-display)] text-[26px] font-extralight leading-[1.22] tracking-[-0.01em] text-foreground">
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

      {/* Timeline */}
      <section aria-label="マイルストーン一覧">
        <JourneyTimeline milestones={milestones} />
      </section>
    </div>
  );
}
