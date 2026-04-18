import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Star, Building2 } from "lucide-react";
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
      {/* Section header — eyebrow "RECENT" + "View all" with ArrowUpRight */}
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
            Recent
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-[15px] font-light tracking-wide text-foreground">
            先日ご覧になった式場
          </h2>
        </div>
        <Link
          href="/candidates?view=recent"
          prefetch={true}
          className="inline-flex items-center gap-0.5 text-[12px] text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
        >
          View all
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
        </Link>
      </div>

      {/* Horizontal carousel — 3:2 photo ratio per spec §2.3 */}
      <div className="-mx-5 flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 scrollbar-hide">
        {venues.map((venue) => {
          const avg = calcAvg(venue.scores);
          return (
            <Link
              key={venue.id}
              href={`/venues/${venue.id}`}
              prefetch={true}
              className="min-w-[240px] snap-start overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98]"
            >
              {/* Photo — 3:2 ratio, no gradient overlay on photo */}
              {venue.photoUrls[0] ? (
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-t-2xl">
                  <Image
                    src={venue.photoUrls[0]}
                    alt={venue.name}
                    fill
                    className="object-cover"
                    sizes="260px"
                  />
                  {/* Score badge — top-right only */}
                  {avg !== null && (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 backdrop-blur-sm">
                      <Star className="h-3 w-3 fill-[var(--gold-warm)] text-[var(--gold-warm)]" strokeWidth={0} />
                      <span className="tabular-nums text-[11px] font-medium text-white">
                        {avg.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 rounded-t-2xl bg-muted">
                  <Building2 className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.2} />
                  <span className="text-xs text-muted-foreground/70">写真はこれから</span>
                </div>
              )}

              {/* Venue name below photo — Noto Serif JP per spec §2.3 */}
              <div className="px-3 py-2.5">
                <h3
                  className="truncate font-light leading-snug text-foreground"
                  style={{
                    fontFamily: '"Noto Serif JP", serif',
                    fontSize: 17,
                    letterSpacing: "0.02em",
                  }}
                >
                  {venue.name}
                </h3>
                {venue.location && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {venue.location}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
