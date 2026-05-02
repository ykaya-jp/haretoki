import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton matching the editorial hero layout (Sprint 2):
 * eyebrow + headline + sub + hairline + metrics block + CTA
 * + recent venues scroller. Reduces layout shift on Server
 * Component resolution.
 *
 * D4 (2026-05-02): swapped raw `bg-muted animate-pulse` divs for the
 * shared <Skeleton> primitive so this surface gets the gold-tinted
 * shimmer sweep + reduced-motion fallback for free, in lockstep with
 * every other loading.tsx in the (app) tree.
 */
export default function HomeLoading() {
  return (
    <div
      className="space-y-12"
      aria-busy="true"
      aria-label="ホーム画面を読み込み中"
    >
      {/* Editorial hero skeleton */}
      <section aria-hidden="true">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
          {/* Sky chip placeholder */}
          <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
        </div>

        {/* Headline */}
        <div className="mt-5 space-y-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* Hairline */}
        <Skeleton className="mt-7 h-px w-full" />

        {/* Metrics block */}
        <div className="mt-4 rounded-3xl bg-card p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="ml-auto flex gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-end gap-1">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-2 w-10" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <Skeleton className="mt-6 h-12 w-full rounded-[14px]" />
      </section>

      {/* Recent venues scroller */}
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[280px] shrink-0 space-y-2 rounded-2xl bg-card shadow-sm"
            >
              <Skeleton className="aspect-[3/2] w-full rounded-t-2xl" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
