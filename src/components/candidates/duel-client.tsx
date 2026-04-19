"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
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
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            情景で決める
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[17px] font-light leading-snug">
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

      {/* C-7: Scene eyebrow + 問いかけ */}
      <div className="mb-8 flex-1">
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[color:var(--gold-warm)]">
          Scene {currentIndex + 1}
        </p>
        {/* gold gradient hairline */}
        <div
          aria-hidden="true"
          className="mb-3 h-px w-10"
          style={{
            background:
              "linear-gradient(to right, var(--gold-warm), color-mix(in oklab, var(--gold-warm) 20%, transparent))",
          }}
        />
        <p
          className="font-[family-name:var(--font-display)] text-[21px] font-light leading-[1.65] tracking-[0.01em] text-foreground"
          key={scene.id}
        >
          {scene.moment}
        </p>
      </div>

      {/* C-6: photo-paired 2 択 */}
      <div className="space-y-4 pb-6">
        {/* 式場 A */}
        <ChoiceButton
          venue={venueA}
          text={scene.choiceA}
          isSelected={selected === "a"}
          isOtherSelected={selected === "b"}
          onClick={() => handleSelect("a")}
        />

        {/* 式場 B */}
        <ChoiceButton
          venue={venueB}
          text={scene.choiceB}
          isSelected={selected === "b"}
          isOtherSelected={selected === "a"}
          onClick={() => handleSelect("b")}
        />
      </div>
    </div>
  );
}

// ─── C-6 photo-paired 選択肢ボタン ────────────────────────────────────────

interface ChoiceButtonProps {
  venue: DuelVenue;
  text: string;
  isSelected: boolean;
  isOtherSelected: boolean;
  onClick: () => void;
}

function ChoiceButton({ venue, text, isSelected, isOtherSelected, onClick }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSelected || isOtherSelected}
      className={cn(
        "w-full min-h-[88px] rounded-2xl border text-left transition-all duration-200",
        "active:scale-[0.98]",
        isSelected
          ? "border-[color:var(--primary)] shadow-[0_0_0_2px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
          : isOtherSelected
            ? "border-border/40 opacity-50"
            : "border-border bg-card hover:border-[color-mix(in_oklab,var(--primary)_30%,var(--border))]",
      )}
    >
      <div className="flex items-stretch gap-0 overflow-hidden rounded-2xl">
        {/* 96×96 photo */}
        <div className="relative h-[88px] w-24 shrink-0 overflow-hidden bg-muted">
          {venue.photoUrl ? (
            <Image
              src={venue.photoUrl}
              alt={venue.name}
              fill
              sizes="96px"
              className={cn(
                "object-cover transition-all duration-300",
                isSelected
                  ? "brightness-90 saturate-[0.85] sepia-[0.15]"
                  : isOtherSelected
                    ? "opacity-50 grayscale"
                    : "",
              )}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-muted-foreground/30 text-[28px]">◎</span>
            </div>
          )}
          {/* primary overlay when selected */}
          {isSelected && (
            <div
              className="absolute inset-0"
              style={{
                background: "color-mix(in oklab, var(--primary) 22%, transparent)",
              }}
            />
          )}
        </div>

        {/* テキスト領域 */}
        <div
          className={cn(
            "flex flex-1 flex-col justify-center px-4 py-3.5",
            isSelected
              ? "bg-[color-mix(in_oklab,var(--primary)_6%,var(--background))]"
              : isOtherSelected
                ? "bg-muted/30"
                : "bg-card",
          )}
        >
          <p
            className={cn(
              "mb-1 font-[family-name:var(--font-display)] text-[11px] font-light tracking-[0.1em]",
              isSelected ? "text-[color:var(--primary)]" : "text-muted-foreground",
            )}
          >
            {venue.name}
          </p>
          <p className="text-[13.5px] font-light leading-relaxed text-foreground">{text}</p>
        </div>
      </div>
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
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            情景で決める
          </p>
          <p className="font-[family-name:var(--font-display)] text-[17px] font-light">
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
        <span className="font-[family-name:var(--font-display)] text-xl font-light text-muted-foreground">
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
        <p className="font-[family-name:var(--font-display)] text-[20px] font-light leading-snug">
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
      {/* 勝者の写真（大） — C-9: hero motion on reveal + venue name caption.
          Opacity 0 → 1 with a small 0.96 → 1 scale, eased out over 900ms
          so the result feels like an arrival rather than a replace. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-muted"
      >
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
        {/* gradient + gold tint + venue name caption overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            background:
              "linear-gradient(to top, color-mix(in oklab, var(--gold-warm) 30%, transparent) 0%, transparent 50%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end px-5 pb-4"
        >
          <span className="font-[family-name:var(--font-display)] text-[17px] font-light text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
            {winner.name}
          </span>
        </div>
      </motion.div>

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
            strokeWidth={1.6}
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
