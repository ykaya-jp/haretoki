import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMyWeights } from "@/server/actions/weights";
import { WeightsForm } from "@/components/mypage/weights-form";

export const metadata: Metadata = {
  title: "次元ごとの重要度",
  description: "候補タブと比較画面の総合スコアに使う、あなたの重みを設定します。",
};

export default async function WeightsPage() {
  const initialWeights = await getMyWeights();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/mypage"
          prefetch
          className="inline-flex h-11 items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          マイページに戻る
        </Link>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">
            ·
          </span>
          <span>Weights</span>
        </p>
        <h1 className="mt-2 text-h1 font-[family-name:var(--font-display)] font-light tracking-[-0.01em]">
          次元ごとの重要度
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          料理・雰囲気・費用…どこを重く見たい？ あなたの重みが、候補タブの★と順位を動かします。
        </p>
      </div>

      <WeightsForm initialWeights={initialWeights} />
    </div>
  );
}
