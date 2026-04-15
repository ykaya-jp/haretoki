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
    <div className="space-y-6 pb-24">
      <Link
        href={`/venues`}
        prefetch={false}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> 戻る
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          {dateLabel ? `${dateLabel} 見学` : "見学の準備"}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[24px] font-extralight leading-[1.35] tracking-[-0.005em]">
          {data.venueName}、これだけは聞いて
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          AI が厳選した {data.questions.length} 問。聞けたらタップでチェック。
          メモを添えるとあとで比較表に反映されます。
        </p>
      </header>

      <VisitQuestionsList questions={data.questions} />
    </div>
  );
}
