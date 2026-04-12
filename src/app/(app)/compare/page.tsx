import Link from "next/link";
import { VenueSelector } from "@/components/compare/venue-selector";
import type { RadarChartData } from "@/components/compare/radar-chart";
import type { VenueData } from "@/components/compare/comparison-matrix";
import { Button } from "@/components/ui/button";
import { getVenues } from "@/server/actions/venues";
import { TIER1_DIMENSIONS } from "@/lib/constants";

export default async function ComparePage() {
  const venues = await getVenues();

  if (venues.length < 2) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-xl font-bold">比較ボード</h1>
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            比較するには2件以上の式場を登録してください。
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

    const matrixData: VenueData = {
      id: venue.id,
      name: venue.name,
      scores,
      estimateTotal: latestEstimate?.total ?? null,
      estimatePredicted: latestEstimate?.predictedFinal ?? null,
      capacityMin: venue.capacityMin,
      capacityMax: venue.capacityMax,
      status: venue.status,
    };

    return {
      id: venue.id,
      name: venue.name,
      radarData,
      matrixData,
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-xl font-bold">比較ボード</h1>
      <VenueSelector venues={venueInfos} />
    </div>
  );
}
