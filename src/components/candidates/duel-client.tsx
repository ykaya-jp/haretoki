"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DUEL_SCENES } from "@/lib/duel-scenes";

interface DuelVenue {
  id: string;
  name: string;
  photoUrl: string | null;
}

interface DuelClientProps {
  venueA: DuelVenue;
  venueB: DuelVenue;
}

type Phase = "quiz" | "result";

/** 各問への回答: "a" | "b" */
type Answer = "a" | "b";

export function DuelClient({ venueA, venueB }: DuelClientProps) {
  const [phase, setPhase] = useState<Phase>("quiz");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<Answer | null>(null);

  const totalQuestions = DUEL_SCENES.length;
  const scene = DUEL_SCENES[currentIndex];

  const handleSelect = (choice: Answer) => {
    if (selected !== null) return; // 二重選択防止
    setSelected(choice);

    // 300ms 待ってから次へ（選択アニメーションを見せる）
    setTimeout(() => {
      const nextAnswers = [...answers, choice];
      if (currentIndex + 1 < totalQuestions) {
        setAnswers(nextAnswers);
        setCurrentIndex(currentIndex + 1);
        setSelected(null);
      } else {
        setAnswers(nextAnswers);
        setPhase("result");
      }
    }, 320);
  };

  const handleReset = () => {
    setPhase("quiz");
    setCurrentIndex(0);
    setAnswers([]);
    setSelected(null);
  };

  // 集計
  const countA = answers.filter((a) => a === "a").length;
  const countB = answers.filter((a) => a === "b").length;
  const isDraw = countA === countB;
  const winnerVenue = isDraw ? null : countA > countB ? venueA : venueB;
  const winnerCount = isDraw ? null : Math.max(countA, countB);

  if (phase === "result") {
    return (
      <ResultView
        venueA={venueA}
        venueB={venueB}
        countA={countA}
        countB={countB}
        totalQuestions={totalQuestions}
        isDraw={isDraw}
        winnerVenue={winnerVenue}
        winnerCount={winnerCount}
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 pb-6">
        <Link
          href="/candidates"
          prefetch={false}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors active:bg-muted"
          aria-label="候補に戻る"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            情景で決める
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[17px] font-extralight leading-snug">
            どちらの晴れの日か
          </h1>
        </div>
      </div>

      {/* 進捗ドット */}
      <div className="flex items-center gap-1.5 pb-8">
        {DUEL_SCENES.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i < currentIndex
                ? "w-4 bg-[color:var(--gold-warm)]"
                : i === currentIndex
                  ? "w-6 bg-[color:var(--primary)]"
                  : "w-1.5 bg-muted-foreground/25",
            )}
          />
        ))}
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          {currentIndex + 1} / {totalQuestions}
        </span>
      </div>

      {/* 問いかけ */}
      <div className="mb-8 flex-1">
        <p
          className="font-[family-name:var(--font-display)] text-[19px] font-extralight leading-[1.65] tracking-[0.01em] text-foreground"
          key={scene.id}
        >
          {scene.moment}
        </p>
      </div>

      {/* 選択肢 */}
      <div className="space-y-3 pb-6">
        {/* 式場 A */}
        <ChoiceButton
          label={venueA.name}
          text={scene.choiceA}
          isSelected={selected === "a"}
          isOtherSelected={selected === "b"}
          onClick={() => handleSelect("a")}
        />

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-[11px] text-muted-foreground">または</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* 式場 B */}
        <ChoiceButton
          label={venueB.name}
          text={scene.choiceB}
          isSelected={selected === "b"}
          isOtherSelected={selected === "a"}
          onClick={() => handleSelect("b")}
        />
      </div>
    </div>
  );
}

// ─── 選択肢ボタン ───────────────────────────────────────────────────────────

interface ChoiceButtonProps {
  label: string;
  text: string;
  isSelected: boolean;
  isOtherSelected: boolean;
  onClick: () => void;
}

function ChoiceButton({ label, text, isSelected, isOtherSelected, onClick }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSelected || isOtherSelected}
      className={cn(
        "w-full min-h-24 rounded-2xl border px-5 py-4 text-left transition-all duration-200",
        "active:scale-[0.98]",
        isSelected
          ? "border-[color:var(--primary)] bg-[color-mix(in_oklab,var(--primary)_8%,var(--background))] shadow-[0_0_0_2px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
          : isOtherSelected
            ? "border-border/40 bg-muted/40 opacity-50"
            : "border-border bg-card hover:border-[color-mix(in_oklab,var(--primary)_30%,var(--border))] hover:bg-[color-mix(in_oklab,var(--primary)_3%,var(--card))]",
      )}
    >
      <p
        className={cn(
          "mb-1.5 font-[family-name:var(--font-display)] text-[12px] font-light tracking-[0.08em]",
          isSelected ? "text-[color:var(--primary)]" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="text-[14.5px] font-light leading-relaxed text-foreground">{text}</p>
    </button>
  );
}

// ─── 結果画面 ────────────────────────────────────────────────────────────────

interface ResultViewProps {
  venueA: DuelVenue;
  venueB: DuelVenue;
  countA: number;
  countB: number;
  totalQuestions: number;
  isDraw: boolean;
  winnerVenue: DuelVenue | null;
  winnerCount: number | null;
  onReset: () => void;
}

function ResultView({
  venueA,
  venueB,
  countA,
  countB,
  totalQuestions,
  isDraw,
  winnerVenue,
  winnerCount,
  onReset,
}: ResultViewProps) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      {/* 戻るリンク */}
      <div className="flex items-center gap-3 pb-6">
        <Link
          href="/candidates"
          prefetch={false}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors active:bg-muted"
          aria-label="候補に戻る"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            情景で決める
          </p>
          <p className="font-[family-name:var(--font-display)] text-[17px] font-extralight">
            結果
          </p>
        </div>
      </div>

      {isDraw ? (
        /* 引き分け */
        <DrawResult venueA={venueA} venueB={venueB} countA={countA} countB={countB} onReset={onReset} />
      ) : (
        /* 勝者あり */
        <WinnerResult
          winner={winnerVenue!}
          winnerCount={winnerCount!}
          totalQuestions={totalQuestions}
          onReset={onReset}
        />
      )}
    </div>
  );
}

function DrawResult({
  venueA,
  venueB,
  countA,
  countB,
  onReset,
}: {
  venueA: DuelVenue;
  venueB: DuelVenue;
  countA: number;
  countB: number;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      {/* 両会場のサムネイル */}
      <div className="flex items-center gap-3">
        <VenueThumb venue={venueA} size="md" />
        <span className="font-[family-name:var(--font-display)] text-xl font-extralight text-muted-foreground">
          =
        </span>
        <VenueThumb venue={venueB} size="md" />
      </div>

      <div
        className="w-full rounded-2xl p-5"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 8%, var(--background)) 0%, color-mix(in oklab, var(--primary) 5%, var(--background)) 100%)",
        }}
      >
        <p className="font-[family-name:var(--font-display)] text-[20px] font-extralight leading-snug">
          ふたりとも甲乙つけがたい
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
          どちらの情景も、同じくらい心に響いているようです。
          <br />
          もう一度じっくり話し合ってみましょう。
        </p>
        <p className="mt-3 text-[11px] tabular-nums text-muted-foreground/70">
          {venueA.name} {countA} — {countB} {venueB.name}
        </p>
      </div>

      <ResetButton onReset={onReset} />
    </div>
  );
}

function WinnerResult({
  winner,
  winnerCount,
  totalQuestions,
  onReset,
}: {
  winner: DuelVenue;
  winnerCount: number;
  totalQuestions: number;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* 勝者の写真（大） */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
        {winner.photoUrl ? (
          <Image
            src={winner.photoUrl}
            alt={winner.name}
            fill
            sizes="(max-width: 430px) 100vw, 430px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-muted-foreground/40 text-[40px]">◎</span>
          </div>
        )}
        {/* gold オーバーレイ */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background:
              "linear-gradient(to top, color-mix(in oklab, var(--gold-warm) 30%, transparent) 0%, transparent 50%)",
          }}
        />
      </div>

      {/* AI カード風インサイト */}
      <div
        className="rounded-2xl border-l-[3px] p-4"
        style={{
          borderLeftColor: "var(--gold-warm)",
          background: "var(--gold-subtle)",
        }}
      >
        <div className="flex items-start gap-2">
          <Sparkles
            className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold-warm)]"
            strokeWidth={1.8}
          />
          <div>
            <p className="font-[family-name:var(--font-display)] text-[15px] font-light leading-snug">
              ふたりの気持ちは
              <span className="text-[color:var(--primary)]">「{winner.name}」</span>
              に寄っています
            </p>
            <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
              {totalQuestions} つの情景のうち、{winnerCount} つでこちらを選びました。
              感情や記憶のイメージが、自然とこちらに向いているようです。
            </p>
          </div>
        </div>
      </div>

      {/* スコアバー */}
      <ScoreBar
        winnerCount={winnerCount}
        totalQuestions={totalQuestions}
      />

      {/* CTA */}
      <Link
        href={`/venues/${winner.id}`}
        prefetch={false}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-[color:var(--primary)] text-[15px] font-light tracking-wide text-[color:var(--primary-foreground)] transition-all active:scale-[0.98] active:opacity-90"
      >
        こちらで話を進めてみる
      </Link>

      <ResetButton onReset={onReset} />
    </div>
  );
}

function ScoreBar({
  winnerCount,
  totalQuestions,
}: {
  winnerCount: number;
  totalQuestions: number;
}) {
  const pct = Math.round((winnerCount / totalQuestions) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>共感度</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "var(--gold-warm)",
          }}
        />
      </div>
    </div>
  );
}

function VenueThumb({ venue, size }: { venue: DuelVenue; size: "sm" | "md" }) {
  const dim = size === "md" ? "h-16 w-16" : "h-11 w-11";
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl bg-muted", dim)}>
      {venue.photoUrl ? (
        <Image src={venue.photoUrl} alt={venue.name} fill sizes="64px" className="object-cover" />
      ) : null}
    </div>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="mx-auto flex h-11 items-center gap-1.5 rounded-full border border-border px-5 text-[13px] text-muted-foreground transition-colors active:bg-muted"
    >
      もう一度
    </button>
  );
}
