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
import { Heart, BarChart3, Trophy, PartyPopper, Loader2, Sparkles, GitCompare, X } from "lucide-react";
import { getFavorites } from "@/server/actions/favorites";
import { makeDecision, cancelDecision } from "@/server/actions/decisions";
import { toast } from "sonner";
import type { VenueStatus } from "@/generated/prisma/client";
import { COMPARE_MAX_VENUES } from "@/lib/comparison-types";

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

const AccordionZoom = dynamic(
  () => import("@/components/comparison/accordion-zoom").then((m) => m.AccordionZoom),
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

type Tab = "shortlist" | "compare" | "decision";

interface FavoriteVenue {
  venue: {
    id: string;
    name: string;
    location: string | null;
    photoUrls: string[];
    status: VenueStatus;
    costMin: number | null;
    costMax: number | null;
    capacityMin: number | null;
    capacityMax: number | null;
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
  initialTab?: "shortlist" | "compare" | "decision";
}

export function CandidatesView({
  initialFavorites,
  venueOptions,
  initialDecision,
  userName,
  initialTab,
}: CandidatesViewProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "shortlist");
  const [filter, setFilter] = useState<"mine" | "partner" | "both">("mine");
  const [favorites, setFavorites] = useState(initialFavorites);
  const [showSwipe, setShowSwipe] = useState(false);
  const [showCeremony, setShowCeremony] = useState(false);
  const [ceremonyVenueName, setCeremonyVenueName] = useState("");
  const [decision, setDecision] = useState(initialDecision ?? null);
  const [isDeciding, setIsDeciding] = useState(false);
  // Multi-select (比較モード): flip cards into tap-to-toggle, pick 2-10,
  // jump to /compare?venueIds=a,b,c with the selection preserved.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const toggleSelected = (venueId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(venueId)) {
        next.delete(venueId);
      } else if (next.size >= COMPARE_MAX_VENUES) {
        // Fail loud: tell the user why the next tap didn't add.
        toast.info(`比較は ${COMPARE_MAX_VENUES} 件までが見やすいです`);
        return prev;
      } else {
        next.add(venueId);
      }
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const launchCompare = () => {
    if (selectedIds.size < 2) {
      toast.info("比較には 2 件以上選んでください");
      return;
    }
    // Preserve the order the user picked (Set iterates insertion order).
    const ids = Array.from(selectedIds);
    router.push(`/compare?venueIds=${ids.join(",")}`);
  };

  useEffect(() => {
    // Refetch when filter changes
    getFavorites(filter).then(setFavorites);
  }, [filter]);

  const canCompare = venueOptions.length >= 2;
  const canDecide = venueOptions.length >= 1;

  const SEGMENTS = [
    { id: "shortlist" as const, label: "候補" },
    {
      id: "compare" as const,
      label: "比べる",
      disabled: !canCompare,
      disabledHint: "候補を2件以上追加すると比べられます",
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
      {/* C-3: editorial リード文 — Shippori 2 段 */}
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Three steps, gently
        </p>
        <p className="font-[family-name:var(--font-display)] text-[15px] font-light leading-relaxed tracking-[0.01em] text-muted-foreground">
          集める → 並べる → 決める
        </p>
      </div>
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

            {/* 比較モード toggle — only surface when the user has >= 2
                favorites, otherwise the feature is dead (nothing to compare). */}
            {favorites.length >= 2 && (
              <div className="mt-3 flex items-center justify-end">
                {selectMode ? (
                  <button
                    type="button"
                    onClick={exitSelectMode}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 text-[12px] text-muted-foreground transition-colors active:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                    モードを終わる
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectMode(true)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--gold-warm)_35%,transparent)] bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--background))] px-3 text-[12px] font-medium text-[var(--gold-warm)] transition-colors active:bg-[color-mix(in_oklab,var(--gold-warm)_12%,var(--background))]"
                  >
                    <GitCompare className="h-3.5 w-3.5" strokeWidth={2} />
                    比較モード
                  </button>
                )}
              </div>
            )}

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
                    className="block w-full rounded-2xl border-l-[3px] border-y border-r border-border/40 p-4 transition-colors active:opacity-90"
                    style={{
                      borderLeftColor: "var(--gold-warm)",
                      background: "var(--gold-subtle)",
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <Sparkles
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold-warm)]"
                        strokeWidth={1.6}
                      />
                      <div className="flex-1">
                        <p className="text-eyebrow text-[var(--gold-warm)]">
                          For Two
                        </p>
                        <p className="mt-0.5 font-[family-name:var(--font-display)] text-[15px] font-light leading-snug tracking-[0.01em] text-foreground">
                          情景で決める
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                          2 件で迷ったとき、ふたりの心がどちらに寄っているか、静かに知る方法があります。
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="mt-1 shrink-0 text-[11px] text-muted-foreground"
                      >
                        →
                      </span>
                    </div>
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
                        setTab("compare");
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
                        venue={fav.venue}
                        isFavorite={true}
                        selectMode={selectMode}
                        isSelected={selectedIds.has(fav.venue.id)}
                        onToggleSelect={toggleSelected}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {tab === "compare" && (
          <motion.div
            key="compare"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, pointerEvents: "none" as const }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {canCompare ? (
              <AccordionZoom />
            ) : (
              <EmptyState
                icon={BarChart3}
                title="候補を2件以上集めると比べられます"
                description="式場を候補に入れると、ここで並べて見比べられます。"
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

      {/* 比較モード sticky CTA — lives above the bottom nav. Only renders
          while selectMode is active, so normal browsing never sees it. */}
      <AnimatePresence>
        {selectMode && tab === "shortlist" && (
          <motion.div
            key="compare-cta"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4"
          >
            <div className="flex w-full max-w-sm items-center gap-2 rounded-full border border-border/50 bg-background/95 p-1.5 shadow-[var(--shadow-elevated)] backdrop-blur-md">
              <span className="flex-1 pl-3 text-[12.5px] text-muted-foreground tabular-nums">
                <span className="font-semibold text-foreground">{selectedIds.size}</span>
                <span> / {COMPARE_MAX_VENUES} 件</span>
              </span>
              <button
                type="button"
                onClick={launchCompare}
                disabled={selectedIds.size < 2}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-all ${
                  selectedIds.size >= 2
                    ? "bg-[var(--gold-warm)] text-background hover:brightness-105 active:scale-[0.98]"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                }`}
              >
                <GitCompare className="h-3.5 w-3.5" strokeWidth={2} />
                {selectedIds.size >= 2
                  ? `この ${selectedIds.size} 件を比較`
                  : "2件以上選ぶ"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
