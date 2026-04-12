import Link from "next/link";
import { getVenues } from "@/server/actions/venues";
import { ShortlistCard } from "@/components/shortlist/shortlist-card";
import { Button } from "@/components/ui/button";
import type { VenueScore } from "@/generated/prisma/client";

function buildScoreMap(scores: VenueScore[]): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  for (const s of scores) {
    if (s.source === "user_rating") {
      map[s.dimension] = Number(s.score);
    }
  }
  return map;
}

export default async function ShortlistPage() {
  const venues = await getVenues();
  const shortlisted = venues.filter(
    (v) => v.status === "shortlisted" || v.status === "selected",
  );

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-bold">候補リスト</h1>

      {shortlisted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">まだ候補がありません</p>
          <Link href="/venues" className="mt-4 inline-block">
            <Button variant="outline">式場を探す</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {shortlisted.map((venue) => (
              <ShortlistCard
                key={venue.id}
                name={venue.name}
                scores={buildScoreMap(venue.scores)}
                isTopChoice={venue.status === "selected"}
              />
            ))}
          </div>

          <div className="flex justify-center">
            <Link href="/decision">
              <Button>決定へ進む</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
