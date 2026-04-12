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
      <h1 className="font-serif text-xl font-light tracking-wide">お気に入りの式場</h1>

      {shortlisted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            気になる式場にハートをつけると、ここに集まります。直感を大切にしてみてくださいね
          </p>
          <Link href="/venues" className="mt-4 inline-block">
            <Button variant="outline">式場一覧を見る</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2">
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
              <Button className="border border-[#C9A84C]/30 bg-primary text-primary-foreground shadow-[0_0_12px_rgba(201,168,76,0.15)] hover:shadow-[0_0_20px_rgba(201,168,76,0.25)]">
                いよいよ決定へ
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
