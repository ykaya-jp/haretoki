export default function VenueDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Photo gallery */}
      <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
      {/* Venue name */}
      <div className="space-y-2">
        <div className="h-6 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      {/* Rating section */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-6 w-6 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
