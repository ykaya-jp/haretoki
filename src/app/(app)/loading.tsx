export default function HomeLoading() {
  return (
    <div className="space-y-6">
      {/* Greeting skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded-lg bg-muted" />
      </div>
      {/* Bento grid skeleton (2/3 + 1/3) */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
      {/* Quick actions skeleton */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      {/* Recent venues skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="min-w-[280px] space-y-2">
              <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
