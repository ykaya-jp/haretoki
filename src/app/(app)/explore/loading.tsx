export default function ExploreLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 rounded bg-muted" />
        <div className="h-10 w-16 rounded-xl bg-muted" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-20 shrink-0 rounded-full bg-muted" />
        ))}
      </div>

      {/* Venue cards */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <div className="aspect-[4/3] w-full rounded-t-2xl bg-muted" />
          <div className="space-y-2 p-4">
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-muted" />
              <div className="h-6 w-16 rounded-full bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
