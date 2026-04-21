"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PillOptions } from "@/components/ui/pill-options";
import { SkyChip } from "@/components/home/sky-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveOnboardingAnswers, getOnboardingRecommendations } from "@/server/actions/onboarding";
import { recommendVenuesFromConditions, type DbVenueRecommendation } from "@/server/actions/onboarding-recs";
import { updateDisplayName } from "@/server/actions/profile";
import { createVenue } from "@/server/actions/venues";
import { Loader2, Sparkles, Plus, MapPin } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

interface VenueRecommendation {
  name: string;
  location: string;
  reason: string;
  estimatedPrice: number | null;
  ceremonyStyles: string[];
  strengths: string[];
}

interface OnboardingAnswer {
  style?: string[];
  guestCount?: number;
  area?: string[];
  budget?: { min: number; max: number };
}

const QUESTIONS = [
  {
    id: "style",
    question: "どんな雰囲気がお好みですか？",
    subtitle: "思い浮かぶ雰囲気を、いくつか選んでみてください",
    type: "pills" as const,
    options: [
      { id: "チャペル", label: "チャペル" },
      { id: "神前", label: "神前" },
      { id: "人前", label: "人前" },
      { id: "ガーデン", label: "ガーデン" },
      { id: "ホテル", label: "ホテル" },
      { id: "レストラン", label: "レストラン" },
    ],
  },
  {
    id: "guests",
    question: "ゲストは何名くらいをお考えですか？",
    subtitle: "だいたいで大丈夫です。あとから変えられます",
    type: "number" as const,
  },
  {
    id: "area",
    question: "気になるエリアはありますか？",
    subtitle: "ふたりの日常の、延長線にある街で",
    type: "pills" as const,
    options: [
      { id: "表参道", label: "表参道" },
      { id: "青山", label: "青山" },
      { id: "銀座", label: "銀座" },
      { id: "恵比寿", label: "恵比寿" },
      { id: "横浜", label: "横浜" },
      { id: "舞浜", label: "舞浜" },
    ],
  },
  {
    id: "budget",
    question: "ご予算の目安はありますか？",
    subtitle: "おおよそで構いません。あとで見直せます",
    type: "pills" as const,
    options: [
      { id: "200", label: "〜200万" },
      { id: "300", label: "200〜300万" },
      { id: "400", label: "300〜400万" },
      { id: "500", label: "400〜500万" },
      { id: "over500", label: "500万〜" },
    ],
  },
];

export function OnboardingFlow() {
  // step === -1 renders the intro/preview screen. Once the user taps
  // 「はじめる」 we advance to 0 and the existing question flow takes over.
  // If `answers` is non-empty on mount (a rehydrated/resumed session), skip
  // the intro so we don't re-gate a user who is mid-flow.
  const [answers, setAnswers] = useState<OnboardingAnswer>({});
  const [step, setStep] = useState(() =>
    Object.keys(answers).length > 0 ? 0 : -1,
  );
  const [displayName, setDisplayName] = useState("");
  const [selectedPills, setSelectedPills] = useState<string[]>([]);
  const [guestCount, setGuestCount] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [isPending, startTransition] = useTransition();
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<VenueRecommendation[]>([]);
  const [advice, setAdvice] = useState("");
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [addingVenues, setAddingVenues] = useState<Set<string>>(new Set());
  const [dbRecs, setDbRecs] = useState<DbVenueRecommendation[]>([]);
  const [dbRecsSummary, setDbRecsSummary] = useState("");
  const [isLoadingDbRecs, setIsLoadingDbRecs] = useState(false);
  const router = useRouter();

  const currentQ = QUESTIONS[step];

  const handleNext = () => {
    const q = QUESTIONS[step];
    let userAnswer = "";

    if (q.id === "style") {
      setAnswers((prev) => ({ ...prev, style: selectedPills }));
      userAnswer = selectedPills.join("、") || "スキップ";
    } else if (q.id === "guests") {
      const count = parseInt(guestCount, 10);
      if (count > 0) setAnswers((prev) => ({ ...prev, guestCount: count }));
      userAnswer = count > 0 ? `${count}名` : "スキップ";
    } else if (q.id === "area") {
      setAnswers((prev) => ({ ...prev, area: selectedPills }));
      userAnswer = selectedPills.join("、") || "スキップ";
    } else if (q.id === "budget") {
      const budgetMap: Record<string, { min: number; max: number }> = {
        "200": { min: 0, max: 2000000 },
        "300": { min: 2000000, max: 3000000 },
        "400": { min: 3000000, max: 4000000 },
        "500": { min: 4000000, max: 5000000 },
        "over500": { min: 5000000, max: 99999999 },
      };
      const selected = selectedPills[0];
      if (selected && budgetMap[selected]) {
        setAnswers((prev) => ({ ...prev, budget: budgetMap[selected] }));
      }
      userAnswer = selectedPills.length > 0 ? q.options!.find((o) => o.id === selectedPills[0])?.label ?? "スキップ" : "スキップ";
    }

    setChatHistory((prev) => [
      ...prev,
      { role: "assistant", content: q.question },
      { role: "user", content: userAnswer },
    ]);

    setSelectedPills([]);
    setGuestCount("");

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      // Build final answers inline to avoid stale closure over `answers`
      const q = QUESTIONS[step];
      const finalAnswers: OnboardingAnswer = { ...answers };

      if (q.id === "style") {
        finalAnswers.style = selectedPills;
      } else if (q.id === "guests") {
        const count = parseInt(guestCount, 10);
        if (count > 0) finalAnswers.guestCount = count;
      } else if (q.id === "area") {
        finalAnswers.area = selectedPills;
      } else if (q.id === "budget") {
        const budgetMap: Record<string, { min: number; max: number }> = {
          "200": { min: 0, max: 2000000 },
          "300": { min: 2000000, max: 3000000 },
          "400": { min: 3000000, max: 4000000 },
          "500": { min: 4000000, max: 5000000 },
          "over500": { min: 5000000, max: 99999999 },
        };
        const selected = selectedPills[0];
        if (selected && budgetMap[selected]) {
          finalAnswers.budget = budgetMap[selected];
        }
      }

      // Save then fetch AI recommendations
      startTransition(async () => {
        await saveOnboardingAnswers(finalAnswers);
        track("onboarding_completed", {
          skipped: false,
          hasStyle: Boolean(finalAnswers.style?.length),
          hasGuestCount: Boolean(finalAnswers.guestCount),
          hasArea: Boolean(finalAnswers.area?.length),
          hasBudget: Boolean(finalAnswers.budget),
        });
        setIsLoadingRecs(true);
        setIsLoadingDbRecs(true);
        setShowRecommendations(true);
        // Fire both recommendation fetches in parallel
        const [genResult, dbResult] = await Promise.allSettled([
          getOnboardingRecommendations(),
          recommendVenuesFromConditions(),
        ]);
        if (genResult.status === "fulfilled" && genResult.value) {
          setRecommendations(genResult.value.recommendations);
          setAdvice(genResult.value.advice);
        }
        setIsLoadingRecs(false);
        if (dbResult.status === "fulfilled" && dbResult.value) {
          setDbRecs(dbResult.value.recommendations);
          setDbRecsSummary(dbResult.value.summary);
        }
        setIsLoadingDbRecs(false);
      });
    }
  };

  const handleSkip = () => {
    setChatHistory((prev) => [
      ...prev,
      { role: "assistant", content: currentQ.question },
      { role: "user", content: "スキップ" },
    ]);
    setSelectedPills([]);
    setGuestCount("");

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      // On the final step, include the current-step selection in the saved
      // answers. Previously `handleSkip` saved the stale `answers` state and
      // silently dropped whatever the user had selected on this step.
      const q = QUESTIONS[step];
      const finalAnswers: OnboardingAnswer = { ...answers };

      if (q.id === "style") {
        if (selectedPills.length > 0) finalAnswers.style = selectedPills;
      } else if (q.id === "guests") {
        const count = parseInt(guestCount, 10);
        if (count > 0) finalAnswers.guestCount = count;
      } else if (q.id === "area") {
        if (selectedPills.length > 0) finalAnswers.area = selectedPills;
      } else if (q.id === "budget") {
        const budgetMap: Record<string, { min: number; max: number }> = {
          "200": { min: 0, max: 2000000 },
          "300": { min: 2000000, max: 3000000 },
          "400": { min: 3000000, max: 4000000 },
          "500": { min: 4000000, max: 5000000 },
          "over500": { min: 5000000, max: 99999999 },
        };
        const selected = selectedPills[0];
        if (selected && budgetMap[selected]) {
          finalAnswers.budget = budgetMap[selected];
        }
      }

      startTransition(async () => {
        await saveOnboardingAnswers(finalAnswers);
        track("onboarding_completed", {
          skipped: true,
          hasStyle: Boolean(finalAnswers.style?.length),
          hasGuestCount: Boolean(finalAnswers.guestCount),
          hasArea: Boolean(finalAnswers.area?.length),
          hasBudget: Boolean(finalAnswers.budget),
        });
        setIsLoadingRecs(true);
        setIsLoadingDbRecs(true);
        setShowRecommendations(true);
        const [genResult, dbResult] = await Promise.allSettled([
          getOnboardingRecommendations(),
          recommendVenuesFromConditions(),
        ]);
        if (genResult.status === "fulfilled" && genResult.value) {
          setRecommendations(genResult.value.recommendations);
          setAdvice(genResult.value.advice);
        }
        setIsLoadingRecs(false);
        if (dbResult.status === "fulfilled" && dbResult.value) {
          setDbRecs(dbResult.value.recommendations);
          setDbRecsSummary(dbResult.value.summary);
        }
        setIsLoadingDbRecs(false);
      });
    }
  };

  const handleAddVenue = async (rec: VenueRecommendation) => {
    setAddingVenues((prev) => new Set(prev).add(rec.name));
    try {
      const result = await createVenue({
        name: rec.name,
        location: rec.location,
        ceremonyStyles: rec.ceremonyStyles,
      });
      if (result.success) {
        toast.success(`${rec.name}をリストに追加しました`);
      }
    } catch {
      toast.error("うまく追加できませんでした");
    } finally {
      setAddingVenues((prev) => {
        const next = new Set(prev);
        next.delete(rec.name);
        return next;
      });
    }
  };

  if (showRecommendations) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-4">
        {/* DB venue recommendations — top 3 from existing venues */}
        {isLoadingDbRecs ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground animate-pulse">
              相性のよさそうな式場を探しています…
            </p>
          </div>
        ) : dbRecs.length > 0 ? (
          <div className="space-y-4">
            {/* Summary header */}
            <div
              className="rounded-r-2xl border-l-[3px] p-4 space-y-1"
              style={{
                borderLeftColor: "var(--gold-warm)",
                background: "color-mix(in oklab, var(--gold-subtle) 60%, var(--background))",
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" strokeWidth={1.5} />
                <p className="text-eyebrow text-[var(--gold-warm)]">登録済み式場から</p>
              </div>
              <p className="font-[family-name:var(--font-display)] text-sm font-light leading-relaxed text-foreground">
                {dbRecsSummary}
              </p>
            </div>

            {/* Venue cards */}
            <div className="space-y-3">
              {dbRecs.map((rec) => (
                <a
                  key={rec.venueId}
                  href={`/venues/${rec.venueId}`}
                  className="block rounded-2xl border overflow-hidden active:scale-[0.98] transition-transform"
                  style={{
                    background: "color-mix(in oklab, var(--gold-subtle) 30%, var(--card))",
                    borderColor: "color-mix(in oklab, var(--gold-warm) 18%, transparent)",
                  }}
                >
                  {rec.photoUrl && (
                    <div className="relative w-full aspect-[4/3]">
                      <Image
                        src={rec.photoUrl}
                        alt={rec.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 512px) 100vw, 512px"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <p className="font-[family-name:var(--font-display)] text-[18px] font-light leading-snug text-foreground">
                      {rec.name}
                    </p>
                    {rec.location && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-none" strokeWidth={1.5} />
                        {rec.location}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed text-foreground/80">{rec.reason}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {/* Onb-3: skeleton shimmer while loading / Onb-2: editorial header */}
        {isLoadingRecs ? (
          <div className="space-y-4">
            {/* Skeleton shimmer — 3 cards with 180ms stagger */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border p-5 space-y-3 animate-pulse"
                style={{
                  borderColor: "color-mix(in oklab, var(--gold-warm) 15%, transparent)",
                  animationDelay: `${i * 180}ms`,
                }}
              >
                <div className="h-5 w-3/4 rounded-full bg-muted" />
                <div className="h-3 w-1/2 rounded-full bg-muted" />
                <div className="h-3 w-full rounded-full bg-muted" />
                <div className="h-9 w-full rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Editorial AI insight header */}
            <div
              className="rounded-r-2xl border-l-[3px] p-4 space-y-2"
              style={{
                borderLeftColor: "var(--gold-warm)",
                background: "color-mix(in oklab, var(--gold-subtle) 60%, var(--background))",
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" strokeWidth={1.5} />
                <p className="text-eyebrow text-[var(--gold-warm)]">Haretoki Suggests</p>
              </div>
              {advice ? (
                <p className="font-[family-name:var(--font-display)] text-sm font-light leading-relaxed text-foreground">
                  {advice}
                </p>
              ) : null}
            </div>

            {/* Recommendation cards — editorial style */}
            {recommendations.length > 0 ? (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.name}
                    className="rounded-2xl border p-5 space-y-3"
                    style={{
                      background: "color-mix(in oklab, var(--gold-subtle) 30%, var(--card))",
                      borderColor: "color-mix(in oklab, var(--gold-warm) 18%, transparent)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        {/* Venue name in Noto Serif JP 19px */}
                        <p className="font-[family-name:var(--font-display)] text-[19px] font-light leading-snug text-foreground">
                          {rec.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{rec.location}</p>
                      </div>
                      {rec.estimatedPrice && (
                        <p className="font-[family-name:var(--font-display)] text-[22px] font-light tabular-nums text-muted-foreground whitespace-nowrap">
                          {Math.round(rec.estimatedPrice / 10000)}<span className="text-xs ml-0.5">万〜</span>
                        </p>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">{rec.reason}</p>
                    {rec.strengths.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {rec.strengths.map((s) => (
                          <span
                            key={s}
                            className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground"
                            style={{
                              background: "color-mix(in oklab, var(--gold-warm) 8%, var(--muted))",
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={addingVenues.has(rec.name)}
                      onClick={() => handleAddVenue(rec)}
                    >
                      {addingVenues.has(rec.name) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          気になるリストに入れる
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              /* Onb-3: 0件フォールバック */
              <div className="py-10 text-center space-y-2">
                <p className="font-[family-name:var(--font-display)] text-[15px] font-light text-foreground/70">
                  ちょうど合う場所が、いまは見つかりませんでした。
                </p>
                <p className="text-sm text-muted-foreground">
                  条件を少し広げて、ふたりで探してみませんか。
                </p>
              </div>
            )}
          </>
        )}

        {/* Primary CTA: proceed to home. The cookie is already set by
            saveOnboardingAnswers() above, so we can navigate directly. */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <Button
            size="default"
            className="w-full max-w-sm"
            onClick={() => {
              router.push("/home");
            }}
          >
            ホームへ進む
          </Button>
          <button
            type="button"
            onClick={() => {
              // Don't call saveOnboardingAnswers({}) — that would silently
              // wipe any conditions already saved by the question flow above.
              // Just navigate; the cookie was set when answers were saved.
              router.push("/home");
            }}
            className="inline-flex min-h-11 items-center text-xs text-muted-foreground underline"
          >
            条件なしでひとまず始める
          </button>
        </div>
      </div>
    );
  }

  if (step === -1) {
    const introSteps = [
      "お好みを4問だけ、そっと伺います",
      "おふたりに合う式場を、AI がいくつかご提案します",
      "気になった場所は、このアプリで比べながら選べます",
    ];
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-10 px-4 py-10 text-center"
      >
        <div className="space-y-5">
          <p className="text-eyebrow font-medium text-[var(--gold-warm)]">
            Haretoki
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-light leading-snug tracking-[-0.005em] text-foreground">
            晴れの日を、ふたりで描きはじめる。
          </h1>
        </div>

        <ol className="w-full space-y-4 text-left">
          {introSteps.map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--gold-subtle)] text-xs font-medium tabular-nums text-[var(--gold-warm)]"
              >
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm font-medium leading-relaxed text-foreground/80">
                {text}
              </span>
            </li>
          ))}
        </ol>

        <div className="w-full space-y-2 text-left">
          <label
            htmlFor="display-name"
            className="text-eyebrow text-muted-foreground"
          >
            お名前 (任意)
          </label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例: ゆうすけ"
            maxLength={50}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            ホームや見学メモで呼びかけに使わせていただきます。あとで変更できます。
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <Button
            onClick={async () => {
              const trimmed = displayName.trim();
              if (trimmed) {
                // Fire and forget — フォールバック的に "(未設定)" を避けるための best-effort
                updateDisplayName(trimmed).catch(() => {});
              }
              setStep(0);
            }}
            className="h-11 min-h-11 w-full rounded-full"
          >
            はじめる
          </Button>
          <Link
            href="/explore?addVenue=1"
            prefetch={true}
            className="inline-flex min-h-11 items-center text-xs text-muted-foreground underline"
          >
            スキップして式場を追加
          </Link>
        </div>
      </motion.div>
    );
  }

  const moods = ["cloudy", "break", "clear", "sunny"] as const;

  return (
    <div className="mx-auto max-w-lg py-4">
      {/* ── 上ゾーン: SkyChip + 進捗 1行 ── */}
      <div className="flex items-center gap-3 mb-6">
        <SkyChip mood={moods[step] ?? "sunny"} size={40} />
        <div className="flex-1 space-y-1.5">
          <p className="flex items-center gap-2 text-eyebrow text-muted-foreground tabular-nums">
            <span className="font-medium text-[var(--gold-warm)]">{step + 1}</span>
            <span aria-hidden="true" className="opacity-30">/</span>
            <span>{QUESTIONS.length}</span>
          </p>
          <div className="h-px bg-[color-mix(in_oklab,var(--gold-warm)_15%,transparent)]">
            <div
              className="h-full bg-gradient-to-r from-[var(--gold-warm)] to-[color-mix(in_oklab,var(--gold-warm)_60%,transparent)] transition-all duration-500"
              style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 下ゾーン: 過去回答 <details> 畳み ── */}
      {chatHistory.length > 0 && (
        <details className="mb-5 group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-eyebrow text-muted-foreground select-none">
            <span className="transition-transform group-open:rotate-90">▶</span>
            <span>これまでの回答 ({Math.floor(chatHistory.length / 2)}問)</span>
          </summary>
          <div className="mt-3 space-y-2 pl-4 border-l border-border/40">
            {chatHistory.map((msg, i) => (
              <p
                key={i}
                className={
                  msg.role === "assistant"
                    ? "text-xs text-muted-foreground"
                    : "text-xs font-medium text-foreground"
                }
              >
                {msg.role === "assistant" ? "Q: " : "A: "}{msg.content}
              </p>
            ))}
          </div>
        </details>
      )}

      {/* ── 現在質問スポットライト ── */}
      {currentQ && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{
            background: "color-mix(in oklab, var(--gold-subtle) 50%, var(--background))",
            border: "1px solid color-mix(in oklab, var(--gold-warm) 18%, transparent)",
          }}
        >
          {/* avatar-indented question bubble */}
          <div className="flex gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                background: "var(--gold-subtle)",
                boxShadow: "0 1px 4px color-mix(in oklab, var(--gold-warm) 22%, transparent)",
              }}
            >
              <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" />
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <p className="font-[family-name:var(--font-display)] text-[16px] font-normal leading-relaxed text-foreground">
                {currentQ.question}
              </p>
              <p className="text-xs text-muted-foreground">{currentQ.subtitle}</p>
            </div>
          </div>

          {currentQ.type === "pills" && currentQ.options && (
            <PillOptions
              options={currentQ.options}
              selected={selectedPills}
              onToggle={(id) => {
                if (currentQ.id === "budget") {
                  setSelectedPills([id]);
                } else {
                  setSelectedPills((prev) =>
                    prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
                  );
                }
              }}
              multiSelect={currentQ.id !== "budget"}
            />
          )}

          {currentQ.type === "number" && (
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              max="500"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="例: 80"
              className="max-w-[200px]"
            />
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleNext} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : step < QUESTIONS.length - 1 ? "次へ" : "おすすめを見る"}
            </Button>
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline"
            >
              スキップ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
