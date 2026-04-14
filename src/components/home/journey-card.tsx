"use client";

import Link from "next/link";
import { Cloud, CloudSun, Sun, Sparkles, BarChart3, Link2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import JourneySteps, {
  JOURNEY_STEP_ICONS,
  type JourneyStep,
} from "@/components/home/journey-steps";
import { cn } from "@/lib/utils";

interface JourneyCardProps {
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  upcomingVisits: number;
  /** Count of favorites that already have ratings. Optional — defaults to favoriteCount. */
  ratedCount?: number;
}

type StageKey = "add" | "visit" | "rate" | "compare" | "decided";

interface NBAction {
  label: string;
  href: string;
  icon?: typeof Sparkles;
}

interface NBA {
  stage: StageKey;
  body: string;
  actions: NBAction[];
}

function getCurrentStep(props: JourneyCardProps): number {
  const { totalVenues, visitedVenues, favoriteCount, hasDecision } = props;
  if (hasDecision) return 4;
  if (favoriteCount >= 2) return 3; // comparing
  if (visitedVenues >= 1) return 2; // visit stage in progress
  if (totalVenues >= 1) return 1; // added, not yet visited → still on step 1/2 boundary
  return 1;
}

function buildSteps(props: JourneyCardProps): JourneyStep[] {
  const { totalVenues, visitedVenues, favoriteCount, hasDecision } = props;

  // Step 1 considered "completed" only when user has moved past adding (i.e. visited something or decided).
  const step1Status: JourneyStep["status"] =
    hasDecision || visitedVenues >= 1
      ? "completed"
      : totalVenues >= 1
        ? "current"
        : "current";

  const step2Status: JourneyStep["status"] = hasDecision
    ? "completed"
    : favoriteCount >= 1 && visitedVenues >= 1
      ? "completed"
      : visitedVenues >= 1
        ? "current"
        : totalVenues >= 1
          ? "current"
          : "upcoming";

  const step3Status: JourneyStep["status"] = hasDecision
    ? "completed"
    : favoriteCount >= 2
      ? "current"
      : "upcoming";

  const step4Status: JourneyStep["status"] = hasDecision ? "completed" : "upcoming";

  return [
    {
      label: "追加",
      icon: JOURNEY_STEP_ICONS.add,
      count: totalVenues || undefined,
      status: step1Status,
    },
    {
      label: "見学",
      icon: JOURNEY_STEP_ICONS.visit,
      count: visitedVenues || undefined,
      status: step2Status,
    },
    {
      label: "比較",
      icon: JOURNEY_STEP_ICONS.compare,
      count: favoriteCount || undefined,
      status: step3Status,
    },
    {
      label: "決定",
      icon: JOURNEY_STEP_ICONS.decide,
      status: step4Status,
    },
  ];
}

function getNBA(props: JourneyCardProps): NBA {
  const { totalVenues, visitedVenues, favoriteCount, hasDecision } = props;
  const ratedCount = props.ratedCount ?? favoriteCount;

  if (hasDecision) {
    return {
      stage: "decided",
      body: "おめでとうございます。見学リストで当日の準備を進めましょう。",
      actions: [{ label: "見学リストを見る", href: "/candidates" }],
    };
  }
  if (favoriteCount >= 2 && ratedCount >= 2) {
    return {
      stage: "compare",
      body: "候補を並べて、ふたりで比べてみましょう。",
      actions: [{ label: "比べる", href: "/candidates" }],
    };
  }
  if (visitedVenues >= 1 && ratedCount < 2) {
    return {
      stage: "rate",
      body: "評価をつけて、比較できるようにしましょう。",
      actions: [{ label: "評価する", href: "/candidates" }],
    };
  }
  if (totalVenues >= 1 && visitedVenues === 0) {
    return {
      stage: "visit",
      body: "見学の予定を入れてみましょう。当日のメモも一緒に残せます。",
      actions: [{ label: "見学を予約", href: "/candidates" }],
    };
  }
  return {
    stage: "add",
    body: "まず1件、気になる式場を。URL1本で、AIが情報を読み取ります。",
    actions: [
      { label: "URLから追加", href: "/explore", icon: Link2 },
      { label: "式場を検索", href: "/explore" },
    ],
  };
}

function getStageBadge(stage: StageKey): { icon: typeof Cloud; tone: string; label: string } {
  switch (stage) {
    case "decided":
      return { icon: Sun, tone: "text-[var(--gold-warm)]", label: "晴れの日" };
    case "compare":
      return { icon: BarChart3, tone: "text-[var(--gold-warm)]", label: "比較" };
    case "rate":
      return { icon: CloudSun, tone: "text-[var(--gold-warm)]", label: "評価" };
    case "visit":
      return { icon: CloudSun, tone: "text-muted-foreground", label: "見学" };
    case "add":
    default:
      return { icon: Cloud, tone: "text-muted-foreground", label: "追加" };
  }
}

export function JourneyCard(props: JourneyCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const steps = buildSteps(props);
  const currentStep = getCurrentStep(props);
  const nba = getNBA(props);
  const badge = getStageBadge(nba.stage);
  const BadgeIcon = badge.icon;

  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
      }
      aria-labelledby="journey-heading"
      className="rounded-2xl bg-card border border-border p-6 shadow-[var(--shadow-card)]"
    >
      {/* Heading */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2
          id="journey-heading"
          className="font-serif text-xl font-light tracking-[0.03em] sm:text-2xl"
        >
          おふたりの式場さがし
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] tracking-[0.06em]",
            badge.tone
          )}
          aria-hidden="true"
        >
          <BadgeIcon className="h-4 w-4" strokeWidth={1.5} />
          {badge.label}
        </span>
      </header>

      {/* 4-step progress */}
      <div className="mb-5">
        <JourneySteps steps={steps} currentStep={currentStep} />
      </div>

      {/* Next Best Action card */}
      <div
        role="group"
        aria-label="次のおすすめアクション"
        className="rounded-xl border-l-[3px] border-l-[var(--gold-warm)] bg-[var(--gold-subtle)] p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold-warm)]/10">
            <Sparkles
              aria-hidden="true"
              className="h-3.5 w-3.5 text-[var(--gold-warm)]"
              strokeWidth={1.5}
            />
          </div>
          <h3 className="text-xs font-medium tracking-[0.04em] uppercase text-[var(--gold-warm)]">
            次の一歩
          </h3>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-foreground">{nba.body}</p>
        <div className="flex flex-wrap gap-2">
          {nba.actions.map((action, idx) => {
            const ActionIcon = action.icon;
            const isPrimary = idx === 0;
            return (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={cn(
                  "inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-sm transition-all duration-200 ease-out active:scale-[0.97]",
                  isPrimary
                    ? "bg-primary text-primary-foreground shadow-sm hover:shadow-md"
                    : "border border-border bg-background text-foreground hover:bg-muted"
                )}
              >
                {ActionIcon && (
                  <ActionIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                )}
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
