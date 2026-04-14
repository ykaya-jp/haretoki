"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PillOptions } from "@/components/ui/pill-options";
import { ChatBubble } from "@/components/coach/chat-bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveOnboardingAnswers, getOnboardingRecommendations } from "@/server/actions/onboarding";
import { createVenue } from "@/server/actions/venues";
import { Loader2, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";

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
    subtitle: "おふたりにぴったりの式場をご提案するために",
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
    subtitle: "人数に合った会場をお探しします",
    type: "number" as const,
  },
  {
    id: "area",
    question: "気になるエリアはありますか？",
    subtitle: "通いやすい式場をお探しします",
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
    subtitle: "おふたりに合った式場をご提案します",
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
  const [selectedPills, setSelectedPills] = useState<string[]>([]);
  const [guestCount, setGuestCount] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [isPending, startTransition] = useTransition();
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<VenueRecommendation[]>([]);
  const [advice, setAdvice] = useState("");
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [addingVenues, setAddingVenues] = useState<Set<string>>(new Set());
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
        setIsLoadingRecs(true);
        setShowRecommendations(true);
        try {
          const result = await getOnboardingRecommendations();
          if (result) {
            setRecommendations(result.recommendations);
            setAdvice(result.advice);
          }
        } finally {
          setIsLoadingRecs(false);
        }
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
        setIsLoadingRecs(true);
        setShowRecommendations(true);
        try {
          const result = await getOnboardingRecommendations();
          if (result) {
            setRecommendations(result.recommendations);
            setAdvice(result.advice);
          }
        } finally {
          setIsLoadingRecs(false);
        }
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
      toast.error("追加できませんでした");
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
        {/* AI recommendations header */}
        <div className="rounded-r-lg border-l-[3px] border-l-[var(--gold-warm)] bg-[var(--gold-subtle)] p-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" />
            <span>あなたへのおすすめ</span>
          </div>
          {isLoadingRecs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>おふたりに合う式場を探しています…</span>
            </div>
          ) : advice ? (
            <p className="text-sm text-muted-foreground">{advice}</p>
          ) : null}
        </div>

        {/* Recommendation cards */}
        {!isLoadingRecs && recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.name}
                className="rounded-xl border bg-card p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-serif font-medium text-foreground">{rec.name}</p>
                    <p className="text-xs text-muted-foreground">{rec.location}</p>
                  </div>
                  {rec.estimatedPrice && (
                    <p className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {Math.round(rec.estimatedPrice / 10000)}万円〜
                    </p>
                  )}
                </div>
                <p className="text-sm text-foreground/80">{rec.reason}</p>
                {rec.strengths.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rec.strengths.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={addingVenues.has(rec.name)}
                  onClick={() => handleAddVenue(rec)}
                >
                  {addingVenues.has(rec.name) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      追加する
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Primary CTA: proceed to home. The cookie is already set by
            saveOnboardingAnswers() above, so we can navigate directly. */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <Button
            size="default"
            className="w-full max-w-sm"
            onClick={() => {
              router.push("/home");
              router.refresh();
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
              router.refresh();
            }}
            className="inline-flex min-h-11 items-center text-xs text-muted-foreground underline"
          >
            条件を保存せず始める
          </button>
        </div>
      </div>
    );
  }

  if (step === -1) {
    const introSteps = [
      "好みを4問お伺いします",
      "AIがおふたりに合う式場をご提案",
      "気に入ったら評価・比較・決定まで、このアプリで",
    ];
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-10 px-4 py-10 text-center"
      >
        <div className="space-y-5">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-[var(--gold-warm)]">
            Haretoki
          </p>
          <h1 className="font-serif text-2xl font-light leading-snug text-foreground">
            式場選びを、3ステップで。
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

        <div className="flex w-full flex-col items-center gap-4">
          <Button
            onClick={() => setStep(0)}
            className="h-11 min-h-11 w-full rounded-full"
          >
            はじめる
          </Button>
          <Link
            href="/explore?addVenue=1"
            className="inline-flex min-h-11 items-center text-xs text-muted-foreground underline"
          >
            スキップして式場を追加
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      {/* Progress bar */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{step + 1} / {QUESTIONS.length}</span>
        <div className="flex-1">
          <div className="h-1 rounded-full bg-muted">
            <div
              className="h-1 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chat history */}
      <div className="space-y-3">
        {chatHistory.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
      </div>

      {/* Current question */}
      {currentQ && (
        <div className="space-y-4">
          <ChatBubble role="assistant" content={currentQ.question} />
          <p className="text-xs text-muted-foreground">{currentQ.subtitle}</p>

          {currentQ.type === "pills" && currentQ.options && (
            <PillOptions
              options={currentQ.options}
              selected={selectedPills}
              onToggle={(id) => {
                if (currentQ.id === "budget") {
                  // Single select for budget
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
