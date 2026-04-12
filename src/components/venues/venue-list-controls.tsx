"use client";

import { useState, useMemo } from "react";
import { Search, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VenueCard } from "@/components/venues/venue-card";
import { VenueForm } from "@/components/venues/venue-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Venue, VenueScore } from "@/generated/prisma/client";

type VenueWithScores = Venue & { scores: VenueScore[] };

type SortKey = "name" | "score" | "date";

const STATUS_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "researching", label: "調査中" },
  { value: "visit_scheduled", label: "見学予定" },
  { value: "visited", label: "見学済み" },
  { value: "shortlisted", label: "候補" },
  { value: "selected", label: "決定" },
  { value: "rejected", label: "見送り" },
] as const;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date", label: "登録日" },
  { value: "name", label: "名前" },
  { value: "score", label: "スコア" },
];

function calcAverageScore(scores: VenueScore[]): number | null {
  const userScores = scores.filter((s) => s.source === "user_rating");
  if (userScores.length === 0) return null;
  const sum = userScores.reduce((acc, s) => acc + Number(s.score), 0);
  return sum / userScores.length;
}

export function VenueListControls({
  venues,
}: {
  venues: VenueWithScores[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    let result = venues;

    // Filter by search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.location && v.location.toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((v) => v.status === statusFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortKey === "name") {
        return a.name.localeCompare(b.name, "ja");
      }
      if (sortKey === "score") {
        const sa = calcAverageScore(a.scores) ?? 0;
        const sb = calcAverageScore(b.scores) ?? 0;
        return sb - sa; // descending
      }
      // date: newest first (default from server)
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return result;
  }, [venues, search, statusFilter, sortKey]);

  return (
    <div className="space-y-4">
      {/* Header with count and add button */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl">式場を見つける</h1>
        <Button
          variant={showForm ? "secondary" : "default"}
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="min-h-[44px] min-w-[44px]"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" data-icon="inline-start" />
              閉じる
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" data-icon="inline-start" />
              新しい式場を追加
            </>
          )}
        </Button>
      </div>

      {/* Collapsible form */}
      {showForm && (
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-serif text-base">
              新しい式場を追加
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VenueForm />
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="式場名・エリアで検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-[44px] pl-9"
        />
      </div>

      {/* Status filter chips - horizontal scroll */}
      <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px]",
                statusFilter === sf.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">並び替え:</span>
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortKey(opt.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors min-h-[44px]",
                sortKey === opt.value
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length}件
        </span>
      </div>

      {/* Venue list */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {venues.length === 0
            ? "まだ式場がありません。気になる式場を追加してみましょう"
            : "該当する式場がありません"}
        </p>
      )}
    </div>
  );
}
