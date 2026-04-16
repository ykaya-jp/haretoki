"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useDemoData } from "@/components/demo/demo-data-provider";

// Demo index page — simplified "ホーム" showing the real HeroNba pre-filled
// with the demo dataset's progress state (3 venues, 2 favorites, 1 visit).
export default function DemoHomePage() {
  const { venues, favorites, visits, insights } = useDemoData();

  const totalVenues = venues.length;
  const visitedVenues = visits.length;
  const favoriteCount = favorites.size;

  return (
    <div className="space-y-6">
      <header className="space-y-2 pt-2">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--gold-warm)]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
          デモモード
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extralight tracking-[-0.01em]">
          ようこそ、デモへ
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          実際の体験を、登録前に触れるモードです。式場カードのお気に入り、候補の比較、AIコーチの会話サンプル——ひと通り確認できます。
        </p>
      </header>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">デモ進捗</p>
        <div className="mt-3 grid grid-cols-3 divide-x divide-border/40 text-center">
          <div><span className="block font-[family-name:var(--font-display)] text-[22px] font-extralight tabular-nums">{totalVenues}</span><span className="text-[10px] text-muted-foreground">気になる</span></div>
          <div><span className="block font-[family-name:var(--font-display)] text-[22px] font-extralight tabular-nums">{visitedVenues}</span><span className="text-[10px] text-muted-foreground">印象メモ</span></div>
          <div><span className="block font-[family-name:var(--font-display)] text-[22px] font-extralight tabular-nums">{favoriteCount}</span><span className="text-[10px] text-muted-foreground">本命</span></div>
        </div>
      </div>

      {/* Quick-tour CTAs */}
      <section aria-labelledby="demo-tour-heading" className="space-y-3">
        <h2 id="demo-tour-heading" className="text-sm font-medium tracking-wide text-muted-foreground">
          クイックツアー
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/demo/venues"
            className="group rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--gold-warm)]">01</p>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg font-extralight">式場を見る</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              3件のモック式場をブラウズ。ハートでお気に入りに。
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--gold-warm)]">
              見る
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/demo/candidates"
            className="group rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--gold-warm)]">02</p>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg font-extralight">候補を比べる</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              お気に入り2件の比較ビュー。価格・雰囲気を並べて。
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--gold-warm)]">
              比べる
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/demo/coach"
            className="group rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--gold-warm)]">03</p>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg font-extralight">AIコーチと話す</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              事前のQ&Aサンプル。ふたりに合う提案を読み取れます。
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--gold-warm)]">
              読む
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* AI insight teaser */}
      {insights.length > 0 && (
        <section
          aria-labelledby="demo-insights-heading"
          className="rounded-[var(--r-lg)] border border-border/60 bg-[var(--bg-card-elevated)] p-6 shadow-[var(--shadow-card)]"
        >
          <h2
            id="demo-insights-heading"
            className="mb-4 text-sm font-medium tracking-wide text-muted-foreground"
          >
            AIからのヒント
          </h2>
          <ul className="space-y-4">
            {insights.map((ins) => (
              <li
                key={ins.id}
                className="rounded-xl border-l-[3px] border-l-[var(--gold-warm)] bg-[var(--gold-subtle)] p-4"
              >
                <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.06em] text-[var(--gold-warm)]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  ヒント
                </p>
                <p className="text-sm font-medium leading-snug text-foreground">
                  {ins.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {ins.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
