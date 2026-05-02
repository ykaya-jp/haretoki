"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// A-3 moved the inline step === -1 hero out to OnboardingHero (Link removed
// from here). framer-motion stays — A-1 uses it for the 3-zone background
// cross-fade and Coach bubble enter motion.
import { motion, useReducedMotion } from "framer-motion";
import { PillOptions } from "@/components/ui/pill-options";
import { SkyChip } from "@/components/home/sky-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveOnboardingAnswers, getOnboardingRecommendations } from "@/server/actions/onboarding";
import { recommendVenuesFromConditions, type DbVenueRecommendation } from "@/server/actions/onboarding-recs";
import { createVenue } from "@/server/actions/venues";
import { OnboardingHero } from "@/components/onboarding/onboarding-hero";
import { RecommendationCard } from "@/components/onboarding/recommendation-card";
// Round 19 (A-4): Plus / MapPin / Image moved into RecommendationCard
// (the inline cards that needed them were extracted). Loader2 stays for
// the saving state on the question flow's submit button; Sparkles +
// ChevronLeft remain in the question / progress chrome.
import { Loader2, Sparkles, ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

/**
 * A-1 — Onboarding 3-zone layout.
 *
 * Each step renders three vertical zones separated by gold hairlines:
 *   1. Progress zone (top, ~25%): step counter + serif step label + bar
 *   2. Conversation zone (middle, ~50%): Coach speech bubble + question
 *      + options + dual CTA
 *   3. Accumulated zone (bottom, ~25%): prior answers as click-to-rewind
 *      list — couples can jump back to any earlier step
 *
 * The page background is a tri-stage cloudy→break→sunny radial wash
 * that follows the brand metaphor (曇り→晴れ間→晴れの日). Background
 * stages cross-fade by opacity (CSS cannot interpolate gradient stops
 * directly) over 1s, so the morning-light progression reads as the
 * couple advances. Reduced-motion users land on the "sunny" wash
 * immediately — no transitions.
 */
type SkyStage = "cloudy" | "break" | "sunny";

/** Per-step background mood — couples ride cloudy→break→sunny across
 *  the 4 questions, mirroring the DecisionCeremony arc on a smaller
 *  scale so the editorial language stays continuous between flows. */
const STEP_SKY: readonly SkyStage[] = ["cloudy", "break", "break", "sunny"] as const;

/** Three-stack radial gradient layers. Same recipe / tokens as
 *  DecisionCeremony — keep them in sync if either side is ever
 *  retuned. */
const WASH_BY_STAGE: Record<SkyStage, string> = {
  cloudy:
    "radial-gradient(80% 60% at 50% 30%, color-mix(in oklab, var(--muted-foreground) 12%, transparent) 0%, transparent 70%)",
  break:
    "radial-gradient(80% 60% at 50% 28%, color-mix(in oklab, var(--gold-warm) 12%, transparent) 0%, color-mix(in oklab, var(--primary) 4%, transparent) 50%, transparent 80%)",
  sunny:
    "radial-gradient(80% 60% at 50% 26%, color-mix(in oklab, var(--gold-warm) 18%, transparent) 0%, color-mix(in oklab, var(--gold-light) 6%, transparent) 60%, transparent 80%)",
};

/** Per-step short label — appears in the progress eyebrow and on the
 *  accumulated rows. Mirrors the QUESTIONS array order. */
const STEP_LABELS = ["雰囲気", "ゲスト人数", "エリア", "予算"] as const;

/** A-2: sentinel id used inside the area question to mark the
 *  "free-form fallback" pill. Selecting this pill reveals a text
 *  input below; the typed value replaces the sentinel before being
 *  saved into `answers.area`, so downstream code (saveOnboardingAnswers,
 *  summarizeAnswer, AI prompt context) never sees the placeholder.
 *  Underscore-bracketed shape so it can never collide with a real
 *  area name a couple might type ("その他のエリア" is the visible
 *  label; the id is only used in component-local state). */
const AREA_OTHER_SENTINEL = "__other__";

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

/**
 * A-2 — Question copy + lexicon pass.
 *
 * All four questions softened to the brand's lexicon: 丁寧体 maintained,
 * "ご予算の目安" → "だいたいの予算は？" style口語化, every subtitle ≤
 * 24 全角字 so each one reads in a single mobile line on 375px without
 * wrap.
 *
 * Area options: the previous pin set was 表参道 / 青山 / 銀座 / 恵比寿
 * + 横浜 / 舞浜 — biased to 5 central-Tokyo wards plus 1 Kanagawa + 1
 * Chiba (audit-sub-A2 flagged this as "couples outside this footprint
 * have nothing to pick"). The new "その他のエリア" sentinel reveals a
 * free-form text input so couples in 関西・北海道・東北・九州 etc. can
 * still answer the question instead of skipping it. The sentinel is
 * replaced with the typed value before saving, so the persisted
 * `answers.area` shape stays a plain string array.
 */
/**
 * A-7 — Coach 2-fragment welcome (採用要素 #2).
 *
 * Steps 1 and 4 carry an optional `welcome` line that renders above
 * the question inside the Coach speech bubble — the first one frames
 * the entire flow ("I'm about to ask you four things"), the last one
 * acknowledges the home stretch ("only one more"). Steps 2 and 3 stay
 * single-fragment so the bubble doesn't read like the Coach is
 * over-narrating every turn.
 */
const QUESTIONS = [
  {
    id: "style",
    question: "お気に入りの雰囲気は？",
    welcome: "ふたりの好みを聞かせてください",
    subtitle: "思い浮かぶものを、いくつでも",
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
    question: "ゲストはだいたい何名？",
    subtitle: "だいたいで大丈夫、あとから変えられます",
    type: "number" as const,
  },
  {
    id: "area",
    question: "気になる街はある？",
    subtitle: "ふたりの暮らしの、延長線で",
    type: "pills" as const,
    options: [
      { id: "表参道", label: "表参道" },
      { id: "青山", label: "青山" },
      { id: "銀座", label: "銀座" },
      { id: "恵比寿", label: "恵比寿" },
      { id: "横浜", label: "横浜" },
      { id: "舞浜", label: "舞浜" },
      // Free-form fallback. Selecting reveals a text input below.
      // Visible label is intentionally longer / more verbose than the
      // place-name pills so the affordance reads as "an escape hatch"
      // rather than yet another preset option.
      { id: AREA_OTHER_SENTINEL, label: "その他のエリア" },
    ],
  },
  {
    id: "budget",
    question: "だいたいの予算は？",
    welcome: "最後の質問です",
    subtitle: "おおよそで構いません、見直せます",
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
  // Round 17 (A-3): displayName + updateDisplayName moved into
  // OnboardingHero — the gateway screen owns name capture so the
  // question flow state stays focused on the 4 conditions.
  const [selectedPills, setSelectedPills] = useState<string[]>([]);
  const [guestCount, setGuestCount] = useState("");
  // A-2: free-form area input shown only when AREA_OTHER_SENTINEL is
  // among the selected area pills. Held separately from selectedPills
  // so a couple can deselect / reselect "その他のエリア" without losing
  // what they typed mid-flow.
  const [otherAreaText, setOtherAreaText] = useState("");
  // A-7 (採用要素 #1): pulse marker for the "step ✓ confirmed" gold
  // check that fires for ~250ms after the couple taps 次へ. Holds the
  // step index that just completed so the pop only shows on that
  // bubble, not on the next one. Reduced-motion users skip the pulse
  // entirely (see triggerStepPulse below).
  const [pulseStep, setPulseStep] = useState<number | null>(null);
  // chatHistory state is no longer rendered (Zone 3 reads `answers`
  // directly via summarizeAnswer). Kept around — and the setter
  // continues to be populated below — so a future cleanup pass (A-6)
  // can either delete it or repurpose it as input for an AI prompt.
  // Underscore prefix opts out of the unused-var lint per
  // `@typescript-eslint/no-unused-vars` config.
  const [_chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  void _chatHistory;
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
  const prefersReduced = useReducedMotion();

  const currentQ = QUESTIONS[step];

  /**
   * Render an answered-step row as plain text. Returns null when the
   * step has no recorded answer yet (defensive — `answers` is only
   * populated when the user advances past a step). Couples scan these
   * to remember what they already said; tapping the row jumps back so
   * they can edit without losing their place.
   */
  function summarizeAnswer(stepIndex: number): string | null {
    const q = QUESTIONS[stepIndex];
    if (!q) return null;
    if (q.id === "style") {
      const arr = answers.style;
      if (!arr || arr.length === 0) return null;
      return arr.join("、");
    }
    if (q.id === "guests") {
      const n = answers.guestCount;
      if (!n || n <= 0) return null;
      return `${n}名`;
    }
    if (q.id === "area") {
      const arr = answers.area;
      if (!arr || arr.length === 0) return null;
      return arr.join("、");
    }
    if (q.id === "budget") {
      const b = answers.budget;
      if (!b) return null;
      const labelMap: Record<string, string> = {
        "0-2000000": "〜200万",
        "2000000-3000000": "200〜300万",
        "3000000-4000000": "300〜400万",
        "4000000-5000000": "400〜500万",
        "5000000-99999999": "500万〜",
      };
      const key = `${b.min}-${b.max}`;
      return labelMap[key] ?? `${Math.round(b.min / 10000)}〜${Math.round(b.max / 10000)}万`;
    }
    return null;
  }

  /**
   * Jump back to an earlier step. Drops the in-flight pill / number /
   * free-form area selection so the question renders cleanly with the
   * persisted answer ready to be re-edited.
   *
   * A-7 (採用要素 #3): wrap the React state update in
   * `document.startViewTransition` so the Coach bubble + zone 3 chip
   * cross-fade with the browser's native View Transitions API. The
   * page-level `@view-transition { navigation: auto }` rule already
   * unlocks the API for this document (ADR-0007); calling
   * startViewTransition imperatively here gives us the same morph on
   * a same-page state change. If the browser does not support the
   * API, or the user prefers reduced motion, we fall back to the
   * plain state update so the rewind still works.
   */
  function rewindToStep(targetIndex: number) {
    if (targetIndex >= step || targetIndex < 0) return;
    const apply = () => {
      setSelectedPills([]);
      setGuestCount("");
      setOtherAreaText("");
      setStep(targetIndex);
    };
    const doc = typeof document !== "undefined" ? document : null;
    const startVT = doc as (Document & { startViewTransition?: (cb: () => void) => unknown }) | null;
    if (!prefersReduced && startVT && typeof startVT.startViewTransition === "function") {
      startVT.startViewTransition(apply);
      return;
    }
    apply();
  }

  /**
   * A-7 (採用要素 #1): fire a 250ms gold-check pulse on the just-
   * completed step. The pulse is rendered as a small pill anchored
   * to the Coach bubble; it cleans itself up via setTimeout so we
   * don't carry a "stuck pulse" if the user advances rapidly.
   * Reduced-motion users get no pulse — the function returns
   * immediately. Re-firing on the same step (rare; only happens if
   * a couple taps 次へ twice within 250ms) is harmless: setTimeout
   * resets the same state.
   */
  function triggerStepPulse(stepIndex: number) {
    if (prefersReduced) return;
    setPulseStep(stepIndex);
    setTimeout(() => {
      setPulseStep((cur) => (cur === stepIndex ? null : cur));
    }, 250);
  }

  /**
   * A-2: build the persisted area string array from the current pill
   * selection. The sentinel id is filtered out of the saved value and
   * (if the user typed something into the free-form input) replaced
   * with that text. Trailing whitespace + duplicates with existing
   * pills are dropped so a couple can not produce
   * `["表参道", "表参道"]` by typing the same name into the input.
   */
  function buildAreaAnswer(pills: string[], freeText: string): string[] {
    const presets = pills.filter((p) => p !== AREA_OTHER_SENTINEL);
    const trimmed = freeText.trim();
    if (!trimmed) return presets;
    if (!pills.includes(AREA_OTHER_SENTINEL)) return presets;
    if (presets.includes(trimmed)) return presets;
    return [...presets, trimmed];
  }

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
      const areaArr = buildAreaAnswer(selectedPills, otherAreaText);
      setAnswers((prev) => ({ ...prev, area: areaArr }));
      userAnswer = areaArr.join("、") || "スキップ";
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
    setOtherAreaText("");

    if (step < QUESTIONS.length - 1) {
      triggerStepPulse(step);
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
        finalAnswers.area = buildAreaAnswer(selectedPills, otherAreaText);
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
    setOtherAreaText("");

    if (step < QUESTIONS.length - 1) {
      triggerStepPulse(step);
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
        const areaArr = buildAreaAnswer(selectedPills, otherAreaText);
        if (areaArr.length > 0) finalAnswers.area = areaArr;
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
      <div className="mx-auto max-w-lg space-y-8 py-6">
        {/* Round 19 (A-4): Coach reveal h1. Replaces the prior dual
            "Haretoki Suggests" / "登録済み式場から" eyebrow pair with a
            single editorial moment that frames the entire reveal as
            a coach voice. The Shippori serif at 24px scales the
            moment to match DecisionCeremony / Hero / Step 1 hero
            typography family. */}
        <div className="space-y-2 text-center">
          <p className="text-eyebrow font-medium text-[var(--gold-warm)]">
            COACH
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[24px] font-light leading-snug tracking-[-0.005em] text-foreground sm:text-[26px]">
            ふたりの好みから、
            <br />
            3 つ選んでみました
          </h1>
          {advice && !isLoadingRecs ? (
            <p className="mx-auto max-w-md pt-2 text-sm font-light leading-relaxed text-foreground/75">
              {advice}
            </p>
          ) : null}
        </div>

        {/* AI 生成 venue recommendations — top of the reveal stack. The
            A-0 Refero analysis flagged Notion's "pre-populated template"
            pattern as the canonical winner; AI 上 / DB 下 mirrors that
            (AI proposals carry the coach's framing, DB matches are the
            secondary "あなたに近い実例" support). */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 text-[var(--gold-warm)]"
              strokeWidth={1.5}
            />
            <p className="text-eyebrow text-[var(--gold-warm)]">
              コーチからの提案
            </p>
          </div>

          {isLoadingRecs ? (
            // Skeleton shimmer — 3 cards with 180ms stagger so the
            // animation doesn't hit all at once and overwhelm the eye.
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse space-y-3 rounded-2xl border p-5"
                  style={{
                    borderColor:
                      "color-mix(in oklab, var(--gold-warm) 15%, transparent)",
                    animationDelay: `${i * 180}ms`,
                  }}
                >
                  <div className="aspect-[16/9] w-full rounded-xl bg-muted" />
                  <div className="h-5 w-3/4 rounded-full bg-muted" />
                  <div className="h-3 w-1/2 rounded-full bg-muted" />
                  <div className="h-3 w-full rounded-full bg-muted" />
                  <div className="h-10 w-full rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.name}
                  variant="ai"
                  name={rec.name}
                  location={rec.location}
                  reason={rec.reason}
                  photoUrl={null}
                  estimatedPrice={rec.estimatedPrice}
                  strengths={rec.strengths}
                  isAdding={addingVenues.has(rec.name)}
                  onAdd={() => handleAddVenue(rec)}
                />
              ))}
            </div>
          ) : (
            // 0 件 fallback — preserved from Onb-3.
            <div className="space-y-2 py-10 text-center">
              <p className="font-[family-name:var(--font-display)] text-[15px] font-light text-foreground/70">
                ちょうど合う場所が、いまは見つかりませんでした。
              </p>
              <p className="text-sm text-muted-foreground">
                条件を少し広げて、ふたりで探してみませんか。
              </p>
            </div>
          )}
        </section>

        {/* Gold hairline separator — only renders when both AI + DB
            sections have something to show. Visually delineates "コーチ
            の提案" (上) from "あなたに近い実例" (下) without adding chrome. */}
        {!isLoadingDbRecs &&
        dbRecs.length > 0 &&
        (recommendations.length > 0 || isLoadingRecs) ? (
          <div
            aria-hidden
            className="mx-auto h-px w-24"
            style={{
              background: `linear-gradient(to right, transparent, var(--gold-warm), transparent)`,
            }}
          />
        ) : null}

        {/* DB venue recommendations — subtle support tier. Matches the
            existing venues the couple has registered against the
            project's conditions. Tap → /venues/<id>. */}
        {isLoadingDbRecs ? (
          <div className="space-y-2">
            <p className="animate-pulse text-sm text-muted-foreground">
              相性のよさそうな式場を探しています…
            </p>
          </div>
        ) : dbRecs.length > 0 ? (
          <section className="space-y-4">
            <div className="space-y-1">
              <p className="text-eyebrow text-muted-foreground">
                あなたに近い実例
              </p>
              {dbRecsSummary ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {dbRecsSummary}
                </p>
              ) : null}
            </div>
            <div className="space-y-3">
              {dbRecs.map((rec) => (
                <RecommendationCard
                  key={rec.venueId}
                  variant="db"
                  venueId={rec.venueId}
                  name={rec.name}
                  location={rec.location}
                  reason={rec.reason}
                  photoUrl={rec.photoUrl}
                />
              ))}
            </div>
          </section>
        ) : null}

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

  // Round 17 (A-3): Hero gateway delegated to OnboardingHero. Onboarding
  // name capture + sky gradient + serif title + dual CTA all live in the
  // hero component; advancing the flow is a single onStart callback.
  if (step === -1) {
    return <OnboardingHero onStart={() => setStep(0)} />;
  }

  const skyStage: SkyStage = STEP_SKY[step] ?? "sunny";
  const stepLabel = STEP_LABELS[step] ?? "";
  const progressPct = ((step + 1) / QUESTIONS.length) * 100;
  const accumulatedSteps = Array.from({ length: step }, (_, i) => i).filter(
    (i) => summarizeAnswer(i) !== null,
  );

  return (
    <motion.div
      // Single fade-in on mount; per-stage cross-fades happen inside the
      // gradient-wash layers below. Reduced-motion users get no fade.
      initial={prefersReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReduced ? 0 : 0.4 }}
      className="relative mx-auto max-w-lg overflow-hidden py-4"
    >
      {/* Tri-stage cloudy → break → sunny background wash. Same recipe as
          DecisionCeremony; CSS gradients can't interpolate so we stack
          three layers and cross-fade by opacity. Reduced-motion users see
          no transition (the active layer is rendered at opacity 1 from
          the first paint). */}
      {(["cloudy", "break", "sunny"] as const).map((stage) => (
        <div
          key={stage}
          aria-hidden="true"
          className={
            "pointer-events-none absolute inset-0 -z-10 " +
            (prefersReduced ? "" : "transition-opacity duration-1000 ease-out")
          }
          style={{
            background: WASH_BY_STAGE[stage],
            opacity: skyStage === stage ? 1 : 0,
          }}
        />
      ))}

      {/* ─────────────────────────────────────────────────────────────
          Zone 1 — Progress (top ~25%)
          Eyebrow + step counter + serif step label + animated bar.
          The SkyChip mirrors the current sky stage so the brand
          metaphor reads at a glance.
          ───────────────────────────────────────────────────────────── */}
      <header className="space-y-3">
        <p className="text-eyebrow tracking-[0.2em] text-[var(--gold-warm)]">
          HARETOKI · ふたりの式場さがし
        </p>
        <div className="flex items-center gap-3">
          <SkyChip mood={skyStage === "break" ? "break" : skyStage === "sunny" ? "sunny" : "cloudy"} size={40} />
          <div className="flex-1 space-y-1.5">
            <p className="flex items-baseline gap-2 text-eyebrow text-muted-foreground tabular-nums">
              <span className="font-medium text-[var(--gold-warm)]">
                Step {step + 1}
              </span>
              <span aria-hidden="true" className="opacity-30">/</span>
              <span>{QUESTIONS.length}</span>
              <span aria-hidden="true" className="px-1 opacity-30">·</span>
              <span className="text-sm font-light tracking-[0.02em] text-foreground">
                {stepLabel}
              </span>
            </p>
            <div className="h-px bg-[color-mix(in_oklab,var(--gold-warm)_15%,transparent)]">
              <div
                className={
                  "h-full bg-gradient-to-r from-[var(--gold-warm)] to-[color-mix(in_oklab,var(--gold-warm)_60%,transparent)] " +
                  (prefersReduced ? "" : "transition-all duration-500")
                }
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Gold hairline separator — Zone 1 ↓ Zone 2 */}
      <div
        aria-hidden="true"
        className="my-5 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--gold-warm)_22%,transparent)] to-transparent"
      />

      {/* ─────────────────────────────────────────────────────────────
          Zone 2 — Conversation (middle ~50%)
          Coach speech bubble + serif question + subtitle + options +
          dual CTA. The Coach label makes the assistant identity
          explicit instead of just an icon. Bubble has a small left-tail
          (CSS triangle) so the speech metaphor reads on first glance.
          ───────────────────────────────────────────────────────────── */}
      {currentQ && (
        <section
          aria-label={`質問 ${step + 1} / ${QUESTIONS.length}`}
          className="space-y-5"
        >
          <div className="flex gap-3">
            <div
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: "var(--gold-subtle)",
                boxShadow: "0 1px 4px color-mix(in oklab, var(--gold-warm) 22%, transparent)",
              }}
              aria-hidden="true"
            >
              <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" strokeWidth={1.5} />
              {/* A-7 (採用要素 #1): step-confirmed gold check pop. The
                  pulse fires for ~250ms when the just-completed step
                  was the previous index — the bubble that was on
                  screen when the couple tapped 次へ. Uses framer-motion
                  with a spring so the pop reads as a real haptic
                  acknowledgement rather than a fade. The reduced-motion
                  branch is handled in triggerStepPulse (it never sets
                  pulseStep so this block is omitted entirely). */}
              {pulseStep !== null && pulseStep === step - 1 && (
                <motion.div
                  key={`pulse-${pulseStep}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 360, damping: 18 }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-white"
                  style={{
                    background: "var(--gold-warm)",
                    boxShadow:
                      "0 2px 6px color-mix(in oklab, var(--gold-warm) 38%, transparent)",
                  }}
                >
                  <Check className="h-3 w-3" strokeWidth={2.6} />
                </motion.div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-eyebrow tracking-[0.2em] text-[var(--gold-warm)]">
                Coach
              </p>
              <div
                className="relative rounded-2xl p-5"
                style={{
                  background: "color-mix(in oklab, var(--gold-subtle) 55%, var(--background))",
                  border: "1px solid color-mix(in oklab, var(--gold-warm) 16%, transparent)",
                }}
              >
                {/* Speech-bubble left tail — pointer toward the avatar.
                    Pure CSS via two stacked triangles (border + inset
                    shadow border) so it follows the bubble background +
                    border together. */}
                <span
                  aria-hidden="true"
                  className="absolute left-[-7px] top-5 h-3 w-3 rotate-45"
                  style={{
                    background: "color-mix(in oklab, var(--gold-subtle) 55%, var(--background))",
                    borderLeft: "1px solid color-mix(in oklab, var(--gold-warm) 16%, transparent)",
                    borderBottom: "1px solid color-mix(in oklab, var(--gold-warm) 16%, transparent)",
                  }}
                />
                {/* A-7 (採用要素 #2): Coach 2-fragment welcome.
                    Only steps 1 and 4 carry a welcome line — step 1
                    frames the whole flow, step 4 acknowledges the home
                    stretch. Mid-flow steps stay single-fragment so the
                    Coach doesn't read as over-narrating every turn. */}
                {currentQ.welcome && (
                  <p className="mb-2 text-eyebrow text-[var(--gold-warm)]">
                    {currentQ.welcome}
                  </p>
                )}
                <p className="text-h3 font-light leading-[1.5] tracking-[-0.005em] text-foreground">
                  {currentQ.question}
                </p>
                <p className="mt-2 text-meta leading-relaxed text-muted-foreground">
                  {currentQ.subtitle}
                </p>
              </div>
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

          {/* A-2 free-form area fallback. Only the area question opts in,
              and the input is only revealed once the couple actually
              selects "その他のエリア" — keeps the surface uncluttered for
              folks happy with the preset chips. The typed value gets
              merged into answers.area via buildAreaAnswer at submit. */}
          {currentQ.id === "area" && selectedPills.includes(AREA_OTHER_SENTINEL) && (
            <div className="space-y-1.5 pt-1">
              <label
                htmlFor="onboarding-other-area"
                className="text-eyebrow tracking-[0.2em] text-muted-foreground"
              >
                ほかの街
              </label>
              <Input
                id="onboarding-other-area"
                type="text"
                inputMode="text"
                value={otherAreaText}
                onChange={(e) => setOtherAreaText(e.target.value)}
                placeholder="例: 仙台、大阪、福岡 …"
                aria-label="その他のエリアを書く"
                maxLength={40}
                className="h-11 text-sm"
              />
            </div>
          )}

          {currentQ.type === "number" && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                max="500"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                placeholder="例: 80"
                aria-label="ゲストの想定人数"
                className="h-12 max-w-[180px] text-center text-lg tabular-nums"
              />
              <p className="text-xs text-muted-foreground">名</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex min-h-11 items-center px-2 text-meta text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              スキップ
            </button>
            <Button
              onClick={handleNext}
              disabled={isPending}
              className="min-h-11 px-6"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step < QUESTIONS.length - 1 ? (
                "次へ"
              ) : (
                "おすすめを見る"
              )}
            </Button>
          </div>
        </section>
      )}

      {/* Gold hairline separator — Zone 2 ↓ Zone 3 (only when there
          IS something to display below). Keeps the layout uncluttered
          on the very first question, where the accumulated zone is
          empty. */}
      {accumulatedSteps.length > 0 && (
        <div
          aria-hidden="true"
          className="my-6 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--gold-warm)_22%,transparent)] to-transparent"
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          Zone 3 — Accumulated answers (bottom ~25%)
          Each prior step renders as a tap-to-rewind row: label + answer
          + subtle ChevronLeft hint. Tapping jumps back to that step;
          the persisted answer is preserved (only the in-flight pill /
          number selection is dropped) so the couple can edit without
          losing context.
          ───────────────────────────────────────────────────────────── */}
      {accumulatedSteps.length > 0 && (
        <section
          aria-label="これまでの回答"
          className="space-y-3"
        >
          <p className="text-eyebrow tracking-[0.2em] text-muted-foreground">
            これまで
          </p>
          <ul className="space-y-1.5">
            {accumulatedSteps.map((i) => {
              const summary = summarizeAnswer(i);
              if (!summary) return null;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => rewindToStep(i)}
                    aria-label={`Step ${i + 1}「${STEP_LABELS[i]}」に戻る`}
                    className="group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--gold-warm)_5%,transparent)] active:scale-[0.99]"
                  >
                    <ChevronLeft
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors group-hover:text-[var(--gold-warm)]"
                      strokeWidth={1.5}
                    />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      Step {i + 1}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-meta font-light tracking-[0.02em] text-foreground/80">
                      {STEP_LABELS[i]}
                    </span>
                    <span className="text-xs text-muted-foreground/50">·</span>
                    <span className="flex-1 truncate text-meta text-foreground">
                      {summary}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </motion.div>
  );
}
