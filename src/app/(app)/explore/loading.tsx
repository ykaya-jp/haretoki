export default function ExploreLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-20 animate-pulse rounded-lg bg-muted" />
      </div>
      {/* Filter chips */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      {/* Venue cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-card p-0 shadow-sm">
            <div className="aspect-[4/3] animate-pulse rounded-t-2xl bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-5 w-48 animate-pulse rounded bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
