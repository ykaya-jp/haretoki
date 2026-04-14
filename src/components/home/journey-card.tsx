"use client";

import Link from "next/link";
import { Cloud, CloudSun, Sun, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface JourneyCardProps {
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  upcomingVisits: number;
}

function getJourneyState(props: JourneyCardProps) {
  const { totalVenues, visitedVenues, favoriteCount, hasDecision, upcomingVisits } = props;

  if (hasDecision) {
    return {
      stage: "sunny" as const,
      icon: Sun,
      iconColor: "text-[var(--gold-warm)]",
      message: "おめでとうございます、晴れの日です",
      summary: "運命の一軒が決まりました",
      cta: null,
    };
  }
  if (favoriteCount >= 2) {
    return {
      stage: "partly-warm" as const,
      icon: CloudSun,
      iconColor: "text-[var(--gold-warm)]",
      message: "晴れ間が見えてきました",
      summary: `お気に入り ${favoriteCount}件`,
      cta: { label: "じっくり比べてみる", href: "/candidates" },
    };
  }
  if (favoriteCount === 1) {
    return {
      stage: "partly" as const,
      icon: CloudSun,
      iconColor: "text-muted-foreground",
      message: "素敵な式場が見つかりましたね",
      summary: "もう1件加えると比較できます",
      cta: { label: "もっと式場を見てみる", href: "/explore" },
    };
  }
  if (visitedVenues > 0) {
    return {
      stage: "visited" as const,
      icon: CloudSun,
      iconColor: "text-muted-foreground",
      message: "見学おつかれさまでした",
      summary: `${visitedVenues}件の式場を訪れました`,
      cta: { label: "お気に入りに加える", href: "/candidates" },
    };
  }
  if (totalVenues > 0) {
    return {
      stage: "cloudy" as const,
      icon: Cloud,
      iconColor: "text-muted-foreground",
      message: "気になる式場がありますね",
      summary: `${totalVenues}件の式場${upcomingVisits > 0 ? ` · 見学の予定 ${upcomingVisits}件` : ""}`,
      cta: { label: "式場をもっと見てみる", href: "/explore" },
    };
  }
  return {
    stage: "empty" as const,
    icon: Cloud,
    iconColor: "text-muted-foreground",
    message: "式場探しをはじめてみませんか",
    summary: "あなたにぴったりの一軒を見つけます",
    cta: { label: "式場を見てみる", href: "/explore" },
  };
}

export function JourneyCard(props: JourneyCardProps) {
  const state = getJourneyState(props);
  const Icon = state.icon;
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl bg-card border border-border p-6 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center gap-3 mb-3">
        <motion.div
          key={state.stage}
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.12, 1] }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <Icon className={`h-8 w-8 ${state.iconColor}`} strokeWidth={1.5} />
        </motion.div>
        <h3 className="font-serif text-lg tracking-[0.03em]">{state.message}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">{state.summary}</p>
      {state.cta && (
        <Link
          href={state.cta.href}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 ease-out active:scale-[0.97] hover:shadow-md"
        >
          {state.cta.label}
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      )}
    </motion.div>
  );
}
