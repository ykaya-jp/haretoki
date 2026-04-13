import Link from "next/link";
import { Star } from "lucide-react";

interface RecentVenue {
  id: string;
  name: string;
  location: string | null;
  photoUrls: string[];
  status: string;
  scores: Array<{ dimension: string; score: number; source: string }>;
}

export function RecentVenues({ venues }: { venues: RecentVenue[] }) {
  if (venues.length === 0) return null;

  const calcAvg = (scores: RecentVenue["scores"]) => {
    if (scores.length === 0) return null;
    return scores.reduce((s, v) => s + v.score, 0) / scores.length;
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base">最近見た式場</h2>
        <Link href="/explore" className="text-sm text-primary">
          すべて →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {venues.map((venue) => {
          const avg = calcAvg(venue.scores);
          return (
            <Link
              key={venue.id}
              href={`/venues/${venue.id}`}
              className="min-w-[280px] snap-start overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
            >
              {venue.photoUrls[0] ? (
                <img
                  src={venue.photoUrls[0]}
                  alt={venue.name}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
                  <span className="text-muted-foreground text-sm">写真なし</span>
                </div>
              )}
              <div className="p-3">
                <h3 className="truncate font-serif text-sm font-medium tracking-[0.05em]">
                  {venue.name}
                </h3>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {avg !== null && (
                    <>
                      <Star className="h-3 w-3 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
                      <span className="tabular-nums">{avg.toFixed(1)}</span>
                      <span className="mx-0.5">·</span>
                    </>
                  )}
                  {venue.location && <span>{venue.location}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
