import { Skeleton } from "@/components/ui/skeleton";

/**
 * Venue detail skeleton — intentionally minimal.
 *
 * page.tsx wraps every below-the-fold section in its own <Suspense>
 * fallback (Rating / Estimates / Visits / Reviews / Plans), so a rich
 * route-level skeleton here would paint the same placeholders twice —
 * once as the route-level loading UI, then again as each Suspense
 * boundary resolves. That double-paint showed as a visible flash at
 * roughly the 200-400ms mark on a mid-tier phone.
 *
 * Keeping this to hero (photo + name) only: it's the only chunk of the
 * page that page.tsx awaits synchronously before streaming, so it's
 * the only part that genuinely needs a placeholder during the first
 * server roundtrip.
 */
export default function VenueDetailLoading() {
  return (
    <div
      className="space-y-6 pb-20"
      aria-busy="true"
      aria-label="式場の詳細を読み込み中"
    >
      <Skeleton aria-hidden="true" className="h-4 w-12" />
      <Skeleton aria-hidden="true" className="aspect-[4/3] w-full rounded-2xl" />
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
