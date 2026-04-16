"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { SegmentedControl } from "@/components/candidates/segmented-control";
import { FavoriteFilter } from "@/components/candidates/favorite-filter";
import { VenueCard } from "@/components/venues/venue-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Heart, BarChart3, Trophy, PartyPopper, ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import { getFavorites } from "@/server/actions/favorites";
import { makeDecision, cancelDecision } from "@/server/actions/decisions";
import { toast } from "sonner";

/* ── Tab content split via next/dynamic ───────────────────────────────────
   Shortlist is the default tab (99% of first-paint traffic). The other 4
   tabs + SwipeCompare pull in heavy transitive deps (charts, canvas-
   confetti, complex comparison tables). Lazy-loading them cuts the
   /candidates initial JS by ~30-40% and makes tab-switching perceptually
   snappier on 3G networks (B-11).                                         */

const TabFallback = () => (
  <div className="flex justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const DecisionMatrix = dynamic(
  () => import("@/components/comparison/decision-matrix").then((m) => m.DecisionMatrix),
  { loading: TabFallback },
);
const DimensionFocus = dynamic(
  () => import("@/components/comparison/dimension-focus").then((m) => m.DimensionFocus),
  { loading: TabFallback },
);
const ChecklistComparison = dynamic(
  () => import("@/components/comparison/checklist-comparison").then((m) => m.ChecklistComparison),
  { loading: TabFallback },
);
const PriorityWeights = dynamic(
  () => import("@/components/comparison/priority-weights").then((m) => m.PriorityWeights),
  { loading: TabFallback },
);
const SwipeCompare = dynamic(
  () => import("@/components/candidates/swipe-compare").then((m) => m.SwipeCompare),
  { loading: TabFallback },
);
const DecisionCeremony = dynamic(
  () => import("@/components/decision/decision-ceremony").then((m) => m.DecisionCeremony),
  { loading: TabFallback },
);

type Tab = "shortlist" | "matrix" | "focus" | "checklist" | "decision";

interface FavoriteVenue {
  venue: {
    id: string;
    name: string;
    location: string | null;
    photoUrls: string[];
    status: string;
    scores: Array<{ dimension: string; score: number; source: string }>;
  };
  favoritedBy: string[];
}

interface DecisionData {
  venueName: string;
  rationale: string | null;
}

interface CandidatesViewProps {
  initialFavorites: FavoriteVenue[];
  venueOptions: Array<{ id: string; name: string }>;
  initialDecision?: DecisionData | null;
  userName?: string;
  initialTab?: Tab;
}

export function CandidatesView({
  initialFavorites,
  venueOptions,
  initialDecision,
  userName,
  initialTab,
}: CandidatesViewProps) {
  const [tab, setTab] = useState<Tab>("shortlist");
  const [filter, setFilter] = useState<"mine" | "partner" | "both">("mine");
  const [favorites, setFavorites] = useState(initialFavorites);
  const [showSwipe, setShowSwipe] = useState(false);
  const [showCeremony, setShowCeremony] = useState(false);
  const [ceremonyVenueName, setCeremonyVenueName] = useState("");
  const [decision, setDecision] = useState(initialDecision ?? null);
  const [isDeciding, setIsDeciding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Refetch when filter changes
    getFavorites(filter).then(setFavorites);
  }, [filter]);

  const canCompare = favorites.length >= 2;
  const canDecide = favorites.length >= 1;

  useEffect(() => {
    if (initialTab && initialTab !== tab) {
      setTab(initialTab);
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SEGMENTS = [
    { id: "shortlist" as const, label: "候補" },
    {
      id: "matrix" as const,
      label: "比べる",
      disabled: !canCompare,
      disabledHint: "候補を2件以上追加すると使えます",
    },
    {
      id: "focus" as const,
      label: "観点別",
      disabled: !canCompare,
      disabledHint: "候補を2件以上追加すると使えます",
    },
    {
      id: "checklist" as const,
      label: "チェック差分",
      disabled: !canCompare,
      disabledHint: "候補を2件以上追加するとチェック差分を比較できます",
    },
    {
      id: "decision" as const,
      label: "決める",
      disabled: !canDecide,
      disabledHint: "候補を1件以上追加すると使えます",
    },
  ];

  const handleDecide = async (venueId: string) => {
    if (isDeciding) return; // sync guard against double-submit
    const venue = venueOptions.find((v) => v.id === venueId);
    if (!venue) return;

    // Guard against re-deciding when a decision already exists. The DB upsert
    // would silently overwrite, which is surprising — require an explicit
    // confirmation.
    if (decision) {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          `すでに「${decision.venueName}」に決まっています。「${venue.name}」に変更しますか？`,
        );
      if (!ok) return;
    }

    setIsDeciding(true);
    try {
      const result = await makeDecision({
        selectedVenueId: venueId,
      });

      if ("error" in result) {
        toast.error("うまく記録できませんでした");
        return;
      }

      setCeremonyVenueName(venue.name);
      setShowCeremony(true);
      setTab("decision");
    } finally {
      setIsDeciding(false);
    }
  };

  const handleCeremonyComplete = async (_tags: string[], _text: string) => {
    setShowCeremony(false);
    setDecision({ venueName: ceremonyVenueName, rationale: _text || null });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <SegmentedControl
        segments={SEGMENTS}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      <AnimatePresence mode="popLayout">
        {tab === "shortlist" && (
          <motion.div
            key="shortlist"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, pointerEvents: "none" as const }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <FavoriteFilter active={filter} onChange={setFilter} />

            {favorites.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                className="mt-4"
              >
                <EmptyState
                  icon={Heart}
                  imageUrl="/images/empty-candidates.png"
                  imageAlt="候補を集める"
                  title="これから、ふたりの輪郭を描いていきましょう"
                  description="式場カードの♡をそっとタップすると、ここに集まります。2件並んだら、比較してみてください。"
                  action={
                    venueOptions.length === 0
                      ? { label: "最初の式場を追加", href: "/explore?addVenue=1" }
                      : { label: "式場を見てみる", href: "/explore" }
                  }
                />
              </motion.div>
            ) : (
              <div className="mt-4 space-y-4">
                {favorites.length === 2 && !showSwipe && (
                  <Link
                    href={`/candidates/duel?a=${favorites[0].venue.id}&b=${favorites[1].venue.id}`}
                    prefetch={false}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-[var(--shadow-card)] transition-colors active:bg-muted"
                  >
                    <Sparkles
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-[color:var(--gold-warm)]"
                      strokeWidth={1.8}
                    />
                    <span className="flex-1 text-[13.5px] font-light">
                      2件で迷ったら、情景で決める
                    </span>
                    <span className="text-[11px] text-muted-foreground">→</span>
                  </Link>
                )}

                {favorites.length >= 5 && !showSwipe && (
                  <motion.button
                    type="button"
                    onClick={() => setShowSwipe(true)}
                    whileTap={{ scale: 0.97, transition: { type: "spring", stiffness: 250, damping: 25 } }}
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-center shadow-[var(--shadow-card)] transition-colors active:bg-muted"
                  >
                    スワイプで選ぶ ({favorites.length}件)
                  </motion.button>
                )}

                {showSwipe && (
                  <SwipeCompare
                    venues={favorites.map(f => ({
                      id: f.venue.id,
                      name: f.venue.name,
                      location: f.venue.location,
                      photoUrls: f.venue.photoUrls,
                      totalScore: 0,
                      topStrengths: [],
                      latestEstimate: null,
                    }))}
                    onComplete={(_kept, compareIds) => {
                      setShowSwipe(false);
                      router.refresh();
                      // If the user up-swiped 2+ venues, jump straight to the
                      // compare board — otherwise just re-render the shortlist
                      // with left-swiped venues now removed.
                      if (compareIds.length >= 2 && canCompare) {
                        setTab("matrix");
                      }
                    }}
                  />
                )}

                <AnimatePresence>
                  {!showSwipe && favorites.map((fav, index) => (
                    <motion.div
                      key={fav.venue.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100, transition: { duration: 0.4 } }}
                      transition={{ delay: Math.min(index, 4) * 0.06, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <VenueCard
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        venue={fav.venue as any}
                        isFavorite={true}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {tab === "matrix" && (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, pointerEvents: "none" as const }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {canCompare ? (
              <DecisionMatrix />
            ) : (
              <EmptyState
                icon={BarChart3}
                title="候補を2件以上集めると比較できます"
                description={
                  favorites.length === 0
                    ? "まず気になる式場を2つ以上候補に入れてください。"
                    : "あと1件以上候補に入れると、比較ボードが使えます。"
                }
                action={{ label: "式場を探す", href: "/explore" }}
              />
            )}
          </motion.div>
        )}

        {tab === "focus" && (
          <motion.div
            key="focus"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, pointerEvents: "none" as const }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {canCompare ? (
              <DimensionFocus />
            ) : (
              <EmptyState
                icon={BarChart3}
                title="観点別の比較には2件必要です"
                description="候補を2件以上入れると、雰囲気や料理などの観点ごとに比べられます。"
                action={{ label: "式場を探す", href: "/explore" }}
              />
            )}
          </motion.div>
        )}

        {tab === "checklist" && (
          <motion.div
            key="checklist"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, pointerEvents: "none" as const }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {canCompare ? (
              <ChecklistComparison
                venueIds={favorites.map((f) => f.venue.id)}
                venueNames={favorites.map((f) => f.venue.name)}
              />
            ) : (
              <EmptyState
                icon={ClipboardCheck}
                title="チェック差分の比較には2件必要です"
                description="候補を2件以上追加するとチェック差分を比較できます。"
                action={{ label: "式場を探す", href: "/explore" }}
              />
            )}
          </motion.div>
        )}

        {tab === "decision" && (
          <motion.div
            key="decision"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, pointerEvents: "none" as const }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {!canDecide ? (
              <EmptyState
                icon={Trophy}
                title="まずは式場を1件候補に入れてください"
                description="候補の式場から、最終決定を行えます。"
                action={{ label: "式場を探す", href: "/explore" }}
              />
            ) : showCeremony ? (
              <DecisionCeremony
                venueName={ceremonyVenueName}
                userName={userName ?? ""}
                journeyStats={{
                  totalVenues: venueOptions.length,
                  shortlisted: favorites.length,
                  compared: Math.min(venueOptions.length, 2),
                }}
                onRecordReason={handleCeremonyComplete}
              />
            ) : decision ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5 rounded-2xl bg-card p-8 text-center shadow-[var(--shadow-card)]"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
                  <PartyPopper className="h-9 w-9 text-[var(--gold-warm)]" aria-hidden />
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-xl font-light tracking-wide">{decision.venueName}</h3>
                <p className="text-sm text-muted-foreground">に決まりました</p>
                {decision.rationale && (
                  <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    決めた理由: {decision.rationale}
                  </p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      typeof window !== "undefined" &&
                      !window.confirm("「" + decision.venueName + "」の決定を取り消しますか？候補に戻ります。")
                    ) {
                      return;
                    }
                    const res = await cancelDecision();
                    if (res.cancelled) {
                      setDecision(null);
                      toast.success("決定を取り消しました");
                      router.refresh();
                    } else {
                      toast.error("取り消せませんでした");
                    }
                  }}
                  className="mx-auto inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-xs text-muted-foreground transition-colors active:bg-muted"
                >
                  この決定を取り消す
                </button>
              </motion.div>
            ) : (
              <PriorityWeights onDecide={handleDecide} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
