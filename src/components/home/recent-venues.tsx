import Link from "next/link";
import Image from "next/image";
import { Star, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface RecentVenue {
  id: string;
  name: string;
  location: string | null;
  photoUrls: string[];
  status: string;
  scores: Array<{ dimension: string; score: number; source: string }>;
}

export function RecentVenues({ venues }: { venues: RecentVenue[] }) {
  if (venues.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="これから、ふたりの候補が集まっていきます"
        description="気になる式場を眺めるところから。直感でかまいません。"
        action={{ label: "式場を見てみる", href: "/explore" }}
      />
    );
  }

  const calcAvg = (scores: RecentVenue["scores"]) => {
    if (scores.length === 0) return null;
    return scores.reduce((s, v) => s + v.score, 0) / scores.length;
  };

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
            Recent
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground">
            先日ご覧になった式場
          </h2>
        </div>
        <Link
          href="/candidates?view=recent"
          prefetch={true}
          className="text-[12px] text-muted-foreground underline-offset-4 hover:underline hover:text-[var(--gold-warm)]"
        >
          すべて →
        </Link>
      </div>
      <div className="-mx-5 flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 scrollbar-hide">
        {venues.map((venue) => {
          const avg = calcAvg(venue.scores);
          return (
            <Link
              key={venue.id}
              href={`/venues/${venue.id}`}
              prefetch={true}
              className="relative min-w-[280px] snap-start overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98]"
            >
              {venue.photoUrls[0] ? (
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={venue.photoUrls[0]}
                    alt={venue.name}
                    fill
                    className="object-cover"
                    sizes="300px"
                  />
                  {/* Gradient overlay for text readability */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                  {/* Score badge */}
                  {avg !== null && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
                      <Star className="h-3 w-3 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
                      <span className="tabular-nums text-xs font-medium text-white">
                        {avg.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {/* Venue name on photo */}
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="truncate font-serif text-base font-medium tracking-[0.05em] text-white">
                      {venue.name}
                    </h3>
                    {venue.location && (
                      <p className="mt-0.5 text-xs text-white/80">{venue.location}</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
                    <span className="text-muted-foreground text-sm">写真はまだありません</span>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-serif text-base font-medium tracking-[0.05em]">
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
                </>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
