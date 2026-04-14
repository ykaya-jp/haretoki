"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SegmentedControl } from "@/components/candidates/segmented-control";
import { FavoriteFilter } from "@/components/candidates/favorite-filter";
import { VenueCard } from "@/components/venues/venue-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ComparisonBoard } from "@/components/comparison/comparison-board";
import { DecisionMatrix } from "@/components/comparison/decision-matrix";
import { DimensionFocus } from "@/components/comparison/dimension-focus";
import { PriorityWeights } from "@/components/comparison/priority-weights";
import { SwipeCompare } from "@/components/candidates/swipe-compare";
import { DecisionCeremony } from "@/components/decision/decision-ceremony";
import { Heart, BarChart3, Trophy } from "lucide-react";
import { getFavorites } from "@/server/actions/favorites";
import { makeDecision } from "@/server/actions/decisions";
import { toast } from "sonner";

type Tab = "shortlist" | "matrix" | "focus" | "decision";

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
}

export function CandidatesView({
  initialFavorites,
  venueOptions,
  initialDecision,
  userName,
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
        toast.error("記録できませんでした");
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

      <AnimatePresence mode="wait">
        {tab === "shortlist" && (
          <motion.div
            key="shortlist"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {favorites.length > 0 && (
              <FavoriteFilter active={filter} onChange={setFilter} />
            )}

            {favorites.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="mt-4"
              >
                <EmptyState
                  icon={Heart}
                  imageUrl="/images/empty-candidates.png"
                  imageAlt="候補を集める"
                  title="心に残った式場を集める場所です"
                  description="式場カードの♡をタップすると、ここに表示されます。2件以上で比較もできます。"
                  action={
                    venueOptions.length === 0
                      ? { label: "最初の式場を追加", href: "/explore?addVenue=1" }
                      : { label: "式場を見てみる", href: "/explore" }
                  }
                />
              </motion.div>
            ) : (
              <div className="mt-4 space-y-4">
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
                      transition={{ delay: index * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {canCompare ? (
              <DecisionMatrix />
            ) : (
              <EmptyState
                icon={BarChart3}
                title="候補を2件以上集めると比較できます"
                description={
                  favorites.length === 0
                    ? "まず気になる式場を2つ以上お気に入りに追加してください。"
                    : "あと1件以上お気に入りに追加すると、比較ボードが使えます。"
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
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {canCompare ? (
              <DimensionFocus />
            ) : (
              <EmptyState
                icon={BarChart3}
                title="観点別の比較には2件必要です"
                description="お気に入りに2件以上追加すると、雰囲気や料理などの観点ごとに比べられます。"
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
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {!canDecide ? (
              <EmptyState
                icon={Trophy}
                title="まずは式場を1件お気に入りしてください"
                description="お気に入りした式場から、最終決定を行えます。"
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
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5 rounded-2xl bg-card p-8 text-center shadow-[var(--shadow-card)]"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
                  <span className="text-3xl">{"\u{1F389}"}</span>
                </div>
                <h3 className="font-serif text-xl font-light tracking-wide">{decision.venueName}</h3>
                <p className="text-sm text-muted-foreground">に決まりました</p>
                {decision.rationale && (
                  <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    決めた理由: {decision.rationale}
                  </p>
                )}
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
