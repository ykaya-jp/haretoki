import { Building2 } from "lucide-react";
import Image from "next/image";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { getSimilarVenues } from "@/server/actions/similar-venues";

/**
 * SimilarVenues — "この式場に似た候補" horizontal carousel.
 *
 * Server Component: fetches during the parent's Suspense boundary so
 * no client JS is added for mere browsing. Ranks other venues in the
 * same project by `computeVenueSimilarity` (see `src/lib/similarity.ts`)
 * and shows the top 3-5 as compact photo-first cards.
 *
 * Hidden entirely when zero candidates score > 0 — this is typically
 * the case for a project with only one venue, or when the candidate
 * pool has no overlap at all. We deliberately do NOT render an empty
 * state here: the section exists to help expand consideration, and an
 * empty state in this position would just add noise to the PDP.
 */
export async function SimilarVenues({
  venueId,
  limit = 5,
}: {
  venueId: string;
  limit?: number;
}) {
  const similar = await getSimilarVenues(venueId, limit).catch(() => []);

  if (similar.length === 0) return null;

  return (
    <section aria-labelledby="similar-venues-heading" className="space-y-4">
      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--gold-warm)_35%,transparent)] to-transparent"
      />

      <div className="flex items-baseline gap-2">
        <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
          Similar
        </p>
        <h2
          id="similar-venues-heading"
          className="font-[family-name:var(--font-display)] text-[15px] font-light tracking-wide text-foreground"
        >
          この式場に似た候補
        </h2>
      </div>

      {/* Horizontal carousel — matches the `RecentVenues` pattern on the
          home tab: 4:5 portrait photos, scroll-snap, edge-to-edge on
          mobile (−mx offset), scrollbar hidden. */}
      <div className="-mx-5 flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 scrollbar-hide">
        {similar.map((venue) => {
          const costLabel = formatCostLabel(venue.costMin, venue.costMax);
          return (
            <PrefetchLink
              key={venue.id}
              href={`/venues/${venue.id}`}
              className="min-w-[220px] snap-start overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98] active:bg-muted/40"
              ariaLabel={`${venue.name} の詳細を見る`}
            >
              {venue.photoUrls[0] ? (
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-t-2xl">
                  <Image
                    src={venue.photoUrls[0]}
                    alt={venue.name}
                    fill
                    className="object-cover"
                    sizes="240px"
                  />
                  {costLabel && (
                    <div className="absolute bottom-2.5 left-2.5 rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-sm">
                      <span className="tabular-nums text-[11px] font-medium text-white">
                        {costLabel}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-t-2xl bg-muted">
                  <Building2
                    className="h-8 w-8 text-muted-foreground/40"
                    strokeWidth={1.2}
                  />
                  <span className="text-xs text-muted-foreground/70">
                    写真はこれから
                  </span>
                </div>
              )}

              <div className="px-3 py-2.5">
                <h3
                  className="truncate font-light leading-snug text-foreground"
                  style={{
                    fontFamily: '"Noto Serif JP", serif',
                    fontSize: 16,
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
                {!venue.photoUrls[0] && costLabel && (
                  <p className="mt-1 tabular-nums text-[11px] text-[var(--gold-warm)]">
                    {costLabel}
                  </p>
                )}
              </div>
            </PrefetchLink>
          );
        })}
      </div>
    </section>
  );
}

/** Format a compact cost chip — "120〜200万円" / "〜200万円" / "100万円〜". */
function formatCostLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const toMan = (v: number) => (v / 10000).toFixed(0);
  if (min != null && max != null) return `${toMan(min)}〜${toMan(max)}万円`;
  if (max != null) return `〜${toMan(max)}万円`;
  if (min != null) return `${toMan(min)}万円〜`;
  return null;
}
