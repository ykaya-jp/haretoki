import Link from "next/link";
import { VenueSelector } from "@/components/compare/venue-selector";
import type { RadarChartData } from "@/components/compare/radar-chart";
import type { VenueData, CategoryEstimate } from "@/components/compare/comparison-matrix";
import { Button } from "@/components/ui/button";
import { getVenues } from "@/server/actions/venues";
import { TIER1_DIMENSIONS } from "@/lib/constants";

type EstimateBarData = {
  name: string;
  initial: number | null;
  predicted: number | null;
};

export default async function ComparePage() {
  const venues = await getVenues();

  if (venues.length < 2) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-xl font-bold">式場を比べてみましょう</h1>
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            式場を2件以上追加すると、ここで比べられるようになります
          </p>
          <Link href="/venues" className="mt-4 inline-block">
            <Button variant="outline">式場を探す</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Build data for each venue
  const venueInfos = venues.map((venue) => {
    const scores: Partial<Record<string, number>> = {};
    for (const dim of TIER1_DIMENSIONS) {
      const found = venue.scores.find(
        (s) => s.dimension === dim && s.source === "user_rating"
      );
      if (found) {
        scores[dim] = Number(found.score);
      }
    }

    const radarData: RadarChartData = {
      venueName: venue.name,
      color: "", // will be assigned by selector
      scores,
    };

    // Use the latest estimate (getVenues now includes estimates sorted desc, take 1)
    const latestEstimate = venue.estimates?.[0] ?? null;

    // Build category estimates from items
    const categoryEstimates: CategoryEstimate[] = [];
    if (latestEstimate?.items) {
      const categoryMap = new Map<string, number>();
      for (const item of latestEstimate.items) {
        const current = categoryMap.get(item.category) ?? 0;
        categoryMap.set(item.category, current + item.amount);
      }
      for (const [category, total] of categoryMap) {
        categoryEstimates.push({ category, total });
      }
    }

    const matrixData: VenueData = {
      id: venue.id,
      name: venue.name,
      scores,
      estimateTotal: latestEstimate?.total ?? null,
      estimatePredicted: latestEstimate?.predictedFinal ?? null,
      capacityMin: venue.capacityMin,
      capacityMax: venue.capacityMax,
      status: venue.status,
      categoryEstimates:
        categoryEstimates.length > 0 ? categoryEstimates : undefined,
    };

    const barData: EstimateBarData = {
      name: venue.name,
      initial: latestEstimate?.total ?? null,
      predicted: latestEstimate?.predictedFinal ?? null,
    };

    return {
      id: venue.id,
      name: venue.name,
      radarData,
      matrixData,
      barData,
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-xl font-bold">式場を比べてみましょう</h1>
      <VenueSelector venues={venueInfos} />
    </div>
  );
}
