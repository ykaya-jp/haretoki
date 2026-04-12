import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VenueRadarChart } from "@/components/compare/radar-chart";
import type { RadarChartData } from "@/components/compare/radar-chart";
import {
  ComparisonMatrix,
  type VenueData,
} from "@/components/compare/comparison-matrix";
import { getVenues } from "@/server/actions/venues";
import { TIER1_DIMENSIONS } from "@/lib/constants";

const RADAR_COLORS = ["#1E3A8A", "#3B82F6", "#A16207"];

export default async function ComparePage() {
  const venues = await getVenues();

  if (venues.length < 2) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-xl font-bold">比較ボード</h1>
        <p className="text-sm text-muted-foreground">
          比較するには2件以上の式場を登録してください。
        </p>
      </div>
    );
  }

  // Build radar chart data from user_rating scores
  const radarData: RadarChartData[] = venues.map((venue, i) => {
    const scores: Partial<Record<string, number>> = {};
    for (const dim of TIER1_DIMENSIONS) {
      const found = venue.scores.find(
        (s) => s.dimension === dim && s.source === "user_rating"
      );
      if (found) {
        scores[dim] = Number(found.score);
      }
    }
    return {
      venueName: venue.name,
      color: RADAR_COLORS[i % RADAR_COLORS.length],
      scores,
    };
  });

  // Build matrix data
  const matrixData: VenueData[] = venues.map((venue) => {
    const scores: Partial<Record<string, number>> = {};
    for (const dim of TIER1_DIMENSIONS) {
      const found = venue.scores.find(
        (s) => s.dimension === dim && s.source === "user_rating"
      );
      if (found) {
        scores[dim] = Number(found.score);
      }
    }

    // Get latest estimate (scores are included, but estimates are not in getVenues)
    // We'll pass null for now since getVenues doesn't include estimates
    return {
      id: venue.id,
      name: venue.name,
      scores,
      estimateTotal: null,
      estimatePredicted: null,
      capacityMin: venue.capacityMin,
      capacityMax: venue.capacityMax,
      status: venue.status,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-bold">比較ボード</h1>

      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">レーダーチャート</CardTitle>
        </CardHeader>
        <CardContent>
          <VenueRadarChart data={radarData} />
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">比較マトリクス</CardTitle>
        </CardHeader>
        <CardContent>
          <ComparisonMatrix venues={matrixData} />
        </CardContent>
      </Card>
    </div>
  );
}
