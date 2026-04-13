"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SegmentedControl } from "@/components/candidates/segmented-control";
import { FavoriteFilter } from "@/components/candidates/favorite-filter";
import { VenueCard } from "@/components/venues/venue-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ComparisonBoard } from "@/components/comparison/comparison-board";
import { SwipeCompare } from "@/components/candidates/swipe-compare";
import { DecisionCeremony } from "@/components/decision/decision-ceremony";
import { Heart, BarChart3, Trophy } from "lucide-react";
import { getFavorites } from "@/server/actions/favorites";
import { makeDecision } from "@/server/actions/decisions";
import { toast } from "sonner";

type Tab = "shortlist" | "comparison" | "decision";

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
  const router = useRouter();

  useEffect(() => {
    // Refetch when filter changes
    getFavorites(filter).then(setFavorites);
  }, [filter]);

  const SEGMENTS = [
    { id: "shortlist" as const, label: "候補" },
    { id: "comparison" as const, label: "比較", disabled: false },
    { id: "decision" as const, label: "決定", disabled: false },
  ];

  const handleDecide = async (venueId: string) => {
    const venue = venueOptions.find((v) => v.id === venueId);
    if (!venue) return;

    const result = await makeDecision({
      selectedVenueId: venueId,
    });

    if ("error" in result) {
      toast.error("決定に失敗しました");
      return;
    }

    setCeremonyVenueName(venue.name);
    setShowCeremony(true);
    setTab("decision");
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
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <FavoriteFilter active={filter} onChange={setFilter} />

            {favorites.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="mt-4"
              >
                <EmptyState
                  icon={Heart}
                  title="お気に入りの式場を集めましょう"
                  description="式場カードの♡をタップすると、ここに候補として表示されます。2件以上集めると比較もできますよ。"
                  action={{ label: "式場を探す", href: "/explore" }}
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
                    スワイプで絞り込む ({favorites.length}件)
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
                    onComplete={() => { setShowSwipe(false); router.refresh(); }}
                  />
                )}

                <AnimatePresence>
                  {!showSwipe && favorites.map((fav, index) => (
                    <motion.div
                      key={fav.venue.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100, transition: { duration: 0.4 } }}
                      transition={{ delay: index * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
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

        {tab === "comparison" && (
          <motion.div
            key="comparison"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {venueOptions.length < 2 ? (
              <EmptyState
                icon={BarChart3}
                title="比較するには2件以上の候補が必要です"
                description="まずはお気に入りの式場を2件以上追加してみましょう。データで納得のいく比較ができます。"
                action={{ label: "式場を探す", href: "/explore" }}
              />
            ) : (
              <ComparisonBoard venueOptions={venueOptions} onDecide={handleDecide} />
            )}
          </motion.div>
        )}

        {tab === "decision" && (
          <motion.div
            key="decision"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {showCeremony ? (
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
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5 rounded-2xl bg-card p-8 text-center shadow-[var(--shadow-card)]"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
                  <span className="text-3xl">{"\u{1F389}"}</span>
                </div>
                <h3 className="font-serif text-xl font-light tracking-wide">{decision.venueName}</h3>
                <p className="text-sm text-muted-foreground">に決定しました</p>
                {decision.rationale && (
                  <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    決め手: {decision.rationale}
                  </p>
                )}
              </motion.div>
            ) : (
              <EmptyState
                icon={Trophy}
                title="まだ最終決定がされていません"
                description="比較ボードで式場を見比べて、納得のいく一つを選びましょう。二人で話し合って決めるのが大切です。"
                action={{ label: "比較ボードへ", href: "#" }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
