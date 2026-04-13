export default function HomeLoading() {
  return (
    <div className="space-y-6">
      {/* Header: greeting + settings icon */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
      </div>
      {/* Journey Card skeleton */}
      <div className="rounded-2xl bg-muted/50 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-36 animate-pulse rounded-full bg-muted" />
      </div>
      {/* AI Insight skeleton */}
      <div className="rounded-2xl border-l-[3px] border-muted bg-muted/30 p-4 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
      {/* Recent venues skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="min-w-[200px] space-y-2">
              <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
