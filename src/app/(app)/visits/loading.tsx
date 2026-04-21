export default function VisitsLoading() {
  return (
    <div className="space-y-8 pb-8">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-20 rounded-full bg-muted animate-pulse" />
        <div className="h-7 w-40 rounded-full bg-muted animate-pulse" />
      </div>
      {/* Calendar skeleton */}
      <div className="h-64 rounded-2xl bg-muted animate-pulse" />
      {/* List skeleton */}
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
