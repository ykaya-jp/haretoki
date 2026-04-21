export default function ExploreLoading() {
  return (
    <div className="space-y-10 animate-pulse">
      {/* Header — eyebrow + h1 + subtitle */}
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-3.5 w-36 rounded bg-muted" />
      </div>

      {/* Search bar */}
      <div className="h-12 w-full rounded-2xl bg-muted" />

      {/* Filter chips */}
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-20 shrink-0 rounded-full bg-muted" />
        ))}
      </div>

      {/* Venue cards */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]"
        >
          <div className="aspect-[3/2] w-full rounded-t-2xl bg-muted" />
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
