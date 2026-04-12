"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VenueRadarChart } from "@/components/compare/radar-chart";
import type { RadarChartData } from "@/components/compare/radar-chart";
import { ComparisonMatrix, type VenueData } from "@/components/compare/comparison-matrix";
import { cn } from "@/lib/utils";

const RADAR_COLORS = ["#1E3A8A", "#3B82F6", "#A16207", "#059669", "#DC2626"];

type VenueInfo = {
  id: string;
  name: string;
  radarData: RadarChartData;
  matrixData: VenueData;
};

export function VenueSelector({ venues }: { venues: VenueInfo[] }) {
  // Default: select first 3 venues (or all if fewer)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    venues.slice(0, 3).forEach((v) => initial.add(v.id));
    return initial;
  });

  function toggleVenue(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Don't allow deselecting below 2
        if (next.size <= 2) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectedVenues = useMemo(
    () => venues.filter((v) => selectedIds.has(v.id)),
    [venues, selectedIds]
  );

  const radarData = useMemo(
    () =>
      selectedVenues.map((v, i) => ({
        ...v.radarData,
        color: RADAR_COLORS[i % RADAR_COLORS.length],
      })),
    [selectedVenues]
  );

  const matrixData = useMemo(
    () => selectedVenues.map((v) => v.matrixData),
    [selectedVenues]
  );

  return (
    <div className="space-y-4">
      {/* Venue selector chips */}
      <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1">
          {venues.map((v) => (
            <button
              key={v.id}
              onClick={() => toggleVenue(v.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px]",
                selectedIds.has(v.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedIds.size}件を比較中（タップで切り替え・最低2件）
      </p>

      {/* Radar chart */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">レーダーチャート</CardTitle>
        </CardHeader>
        <CardContent>
          <VenueRadarChart data={radarData} />
        </CardContent>
      </Card>

      {/* Comparison matrix */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">比較マトリクス</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ComparisonMatrix venues={matrixData} />
        </CardContent>
      </Card>
    </div>
  );
}
