import Link from "next/link";
import { Camera, NotebookPen } from "lucide-react";
import type { VenueVisitNotePreview } from "@/server/actions/visit-notes-preview";

const formatJSTDate = (date: Date) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(date);

/**
 * Cross-venue VisitNote preview surface for /compare. Renders a compact
 * card per venue with: latest note excerpt + author + visit date +
 * total-note count + camera badge if any media. Tap → venue detail
 * `#visit` anchor for full notes.
 *
 * Self-hides when no venue has any notes (cycle 0 / pre-visit). Pairs
 * with MatrixInsight (定量) / MatrixReviewInsight (定性 review) /
 * DisagreementSpotlight (合意) as a 4th lens — "the lived experience".
 */
export function VisitNotesPreviewCard({
  previews,
  matrixVenueIdsToNames,
}: {
  previews: VenueVisitNotePreview[];
  /** Map venueId → name for display. Comes from the comparison matrix. */
  matrixVenueIdsToNames: Record<string, string>;
}) {
  if (previews.length === 0) return null;

  return (
    <section
      aria-label="見学メモ"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2">
        <NotebookPen
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <p className="text-eyebrow text-[var(--gold-warm)]">
          見学のメモから
        </p>
      </div>

      <p className="mt-2 text-fluid-xs leading-relaxed text-muted-foreground">
        実際に立った瞬間に書き残した一行が、決め手になることがあります。
      </p>

      <ul className="mt-3 space-y-3">
        {previews.map((p) => {
          const venueName = matrixVenueIdsToNames[p.venueId] ?? "式場";
          return (
            <li key={p.noteId}>
              <Link
                href={`/venues/${p.venueId}#visit`}
                prefetch={true}
                className="block rounded-xl bg-[color-mix(in_oklab,var(--gold-subtle)_30%,var(--background))] p-3 transition-colors hover:bg-[color-mix(in_oklab,var(--gold-subtle)_50%,var(--background))]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-[family-name:var(--font-display)] text-fluid-sm font-light text-foreground">
                    {venueName}
                  </span>
                  <span className="tabular-nums text-fluid-xs text-muted-foreground">
                    {formatJSTDate(p.visitDate)}
                  </span>
                </div>
                <p className="mt-1.5 text-fluid-sm leading-relaxed text-foreground/85">
                  「{p.excerpt}」
                </p>
                <div className="mt-2 flex items-baseline gap-3 text-fluid-xs text-muted-foreground">
                  {p.authorName && <span>— {p.authorName}</span>}
                  {p.hasMedia && (
                    <span className="inline-flex items-center gap-0.5">
                      <Camera
                        className="h-3 w-3"
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                      写真あり
                    </span>
                  )}
                  {p.totalNotesAtVenue > 1 && (
                    <span className="ml-auto tabular-nums">
                      ほか {p.totalNotesAtVenue - 1} 件
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
