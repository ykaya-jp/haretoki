export default function CandidatesLoading() {
  return (
    <div className="space-y-4">
      {/* Segmented control skeleton */}
      <div className="flex gap-1 rounded-full bg-muted p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 flex-1 animate-pulse rounded-full bg-card" />
        ))}
      </div>
      {/* Card skeletons */}
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-card p-0 shadow-sm">
            <div className="aspect-[4/3] animate-pulse rounded-t-2xl bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-5 w-48 animate-pulse rounded bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
