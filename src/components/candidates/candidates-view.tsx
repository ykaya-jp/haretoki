"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/candidates/segmented-control";
import { FavoriteFilter } from "@/components/candidates/favorite-filter";
import { VenueCard } from "@/components/venues/venue-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ComparisonBoard } from "@/components/comparison/comparison-board";
import { SwipeCompare } from "@/components/candidates/swipe-compare";
import { DecisionCeremony } from "@/components/decision/decision-ceremony";
import { Heart } from "lucide-react";
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
    <div className="space-y-4">
      <SegmentedControl
        segments={SEGMENTS}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {tab === "shortlist" && (
        <>
          <FavoriteFilter active={filter} onChange={setFilter} />

          {favorites.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="気になる式場をハートで候補に追加しましょう"
              description="式場一覧でハートをタップすると候補に追加されます"
              action={{ label: "式場を探す", href: "/explore" }}
            />
          ) : (
            <div className="space-y-4">
              {favorites.length >= 5 && !showSwipe && (
                <button
                  type="button"
                  onClick={() => setShowSwipe(true)}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-center transition-colors active:bg-muted"
                >
                  スワイプで絞り込む ({favorites.length}件)
                </button>
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

              {!showSwipe && favorites.map((fav) => (
                <VenueCard
                  key={fav.venue.id}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  venue={fav.venue as any}
                  isFavorite={true}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "comparison" && (
        venueOptions.length < 2 ? (
          <div className="space-y-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              比較するには2件以上の式場を候補に追加してください
            </p>
            <button
              type="button"
              onClick={() => setTab("shortlist")}
              className="rounded-lg bg-primary px-6 py-3 text-sm text-primary-foreground active:scale-95"
            >
              候補リストへ戻る
            </button>
          </div>
        ) : (
          <ComparisonBoard venueOptions={venueOptions} onDecide={handleDecide} />
        )
      )}

      {tab === "decision" && (
        <>
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
            <div className="space-y-4 py-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
                <span className="text-2xl">{"\u{1F389}"}</span>
              </div>
              <h3 className="text-lg font-medium">{decision.venueName}</h3>
              <p className="text-sm text-muted-foreground">に決定しました</p>
              {decision.rationale && (
                <p className="text-sm text-muted-foreground">
                  決め手: {decision.rationale}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-8 text-center">
              <p className="text-muted-foreground">
                比較ボードで式場を選んで「この式場に決める」を実行してください
              </p>
              <button
                type="button"
                onClick={() => setTab("comparison")}
                className="rounded-lg bg-primary px-6 py-3 text-sm text-primary-foreground active:scale-95"
              >
                比較ボードへ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
