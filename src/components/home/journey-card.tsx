import Link from "next/link";
import { Cloud, CloudSun, Sun, Sparkles } from "lucide-react";

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
      icon: Sun,
      iconColor: "text-[var(--gold-warm)]",
      message: "おめでとうございます！晴れの日",
      summary: "式場が決まりました",
      cta: null,
    };
  }
  if (favoriteCount >= 2) {
    return {
      icon: CloudSun,
      iconColor: "text-[var(--gold-warm)]",
      message: "晴れ間が見えてきました",
      summary: `候補 ${favoriteCount}件`,
      cta: { label: "候補を比較する", href: "/candidates" },
    };
  }
  if (favoriteCount === 1) {
    return {
      icon: CloudSun,
      iconColor: "text-muted-foreground",
      message: "お気に入りが1件見つかりました",
      summary: "もう1件追加すると比較できます",
      cta: { label: "式場を探す", href: "/explore" },
    };
  }
  if (visitedVenues > 0) {
    return {
      icon: CloudSun,
      iconColor: "text-muted-foreground",
      message: "見学お疲れさまでした",
      summary: `${visitedVenues}件 見学済み`,
      cta: { label: "お気に入りに追加する", href: "/candidates" },
    };
  }
  if (totalVenues > 0) {
    return {
      icon: Cloud,
      iconColor: "text-muted-foreground",
      message: "気になる式場が見つかりましたね",
      summary: `${totalVenues}件の式場${upcomingVisits > 0 ? ` · 見学予定 ${upcomingVisits}件` : ""}`,
      cta: { label: "式場の詳細を見る", href: "/explore" },
    };
  }
  return {
    icon: Cloud,
    iconColor: "text-muted-foreground",
    message: "式場探しを始めましょう",
    summary: "まだ式場が登録されていません",
    cta: { label: "式場を探す", href: "/explore" },
  };
}

export function JourneyCard(props: JourneyCardProps) {
  const state = getJourneyState(props);
  const Icon = state.icon;

  return (
    <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 mb-3">
        <Icon className={`h-6 w-6 ${state.iconColor}`} />
        <h3 className="text-lg">{state.message}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{state.summary}</p>
      {state.cta && (
        <Link
          href={state.cta.href}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
        >
          {state.cta.label}
          <Sparkles className="h-3.5 w-3.5 ml-1" />
        </Link>
      )}
    </div>
  );
}
