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
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <Link
          href="/dashboard"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] text-muted-foreground transition-opacity hover:opacity-70"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          ホームへ
        </Link>

        <div>
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
            {startYear} — おふたりの記録
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[26px] font-extralight leading-[1.22] tracking-[-0.01em] text-foreground">
            晴れまでの道
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            おふたりのここまでと、これから
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
