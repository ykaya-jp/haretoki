/**
 * Skeleton matching the editorial hero layout (Sprint 2):
 * eyebrow + headline + sub + hairline + metrics block + CTA
 * + recent venues scroller. Reduces layout shift on Server
 * Component resolution.
 */
export default function HomeLoading() {
  return (
    <div className="space-y-12 animate-pulse">
      {/* Editorial hero skeleton */}
      <section>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="h-3 w-52 rounded bg-muted" />
          </div>
          {/* Sky chip placeholder */}
          <div className="h-14 w-14 shrink-0 rounded-full bg-muted" />
        </div>

        {/* Headline */}
        <div className="mt-5 space-y-2">
          <div className="h-8 w-3/4 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>

        {/* Hairline */}
        <div className="mt-7 h-px w-full bg-muted" />

        {/* Metrics block */}
        <div className="mt-4 rounded-3xl bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-14 rounded bg-muted" />
              <div className="h-3 w-10 rounded bg-muted" />
            </div>
            <div className="ml-auto flex gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-end gap-1">
                  <div className="h-5 w-5 rounded bg-muted" />
                  <div className="h-2 w-10 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 h-12 w-full rounded-[14px] bg-muted" />
      </section>

      {/* Recent venues scroller */}
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[280px] shrink-0 space-y-2 rounded-2xl bg-card shadow-sm"
            >
              <div className="aspect-[4/3] w-full rounded-t-2xl bg-muted" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
