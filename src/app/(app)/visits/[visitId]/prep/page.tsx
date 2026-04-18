import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  ensureVisitQuestions,
  getVisitQuestions,
} from "@/server/actions/visit-questions";
import { VisitQuestionsList } from "@/components/visits/visit-questions-list";

export const metadata = {
  title: "見学の質問リスト",
  description:
    "AI が厳選した 10 問以上。明日の見学で聞きそびれないために。",
};

interface PageProps {
  params: Promise<{ visitId: string }>;
}

export default async function VisitPrepPage({ params }: PageProps) {
  const { visitId } = await params;

  // Seed the question list if missing (idempotent). Runs on every open —
  // the createMany is a no-op when rows exist.
  const seed = await ensureVisitQuestions(visitId);
  if (seed.added === 0 && seed.existing === 0) notFound();

  const data = await getVisitQuestions(visitId);
  if (!data) notFound();

  const dateLabel = data.scheduledAt
    ? new Intl.DateTimeFormat("ja-JP", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(data.scheduledAt)
    : null;

  return (
    <div className="space-y-10 pb-24">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
          <Link
            href="/venues"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            Back
          </Link>
          <span aria-hidden="true" className="opacity-30">/</span>
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Prep</span>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[24px] font-light leading-[1.35] tracking-[-0.005em]">
          {data.venueName}、これだけは聞いて
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {dateLabel ? `${dateLabel} 見学 · ` : ""}AI が厳選した {data.questions.length} 問。聞けたらタップでチェック。
          メモを添えるとあとで比較表に反映されます。
        </p>
      </div>

      <VisitQuestionsList questions={data.questions} />
    </div>
  );
}
