export default function CoachLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
      {/* Insight card skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="min-h-[120px] animate-pulse rounded-lg border-l-[3px] border-l-muted bg-muted/30 p-4"
        >
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
