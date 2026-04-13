export default function VenueDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Photo carousel skeleton */}
      <div className="aspect-[4/3] w-full rounded-2xl bg-muted" />

      {/* Venue name */}
      <div className="space-y-2">
        <div className="h-7 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>

      {/* Action bar */}
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-11 flex-1 rounded-2xl bg-muted" />
        ))}
      </div>

      {/* Content sections */}
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl bg-card p-5 shadow-sm">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
