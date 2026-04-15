export default function CoachLoading() {
  return (
    <div className="space-y-5 animate-pulse pb-20">
      {/* Header */}
      <div className="h-6 w-24 rounded bg-muted" />

      {/* Insight card skeletons */}
      {[1, 2].map((i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl border-l-[3px] border-l-muted bg-muted/30 p-4"
        >
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-20 rounded-full bg-muted" />
          </div>
        </div>
      ))}

      {/* Chat divider skeleton */}
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-px flex-1 bg-muted" />
      </div>

      <div className="flex gap-2.5">
        <div className="h-8 w-8 rounded-full bg-muted" />
        <div className="h-16 w-3/4 rounded-2xl bg-muted" />
      </div>
      <div className="flex justify-end">
        <div className="h-12 w-2/3 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
