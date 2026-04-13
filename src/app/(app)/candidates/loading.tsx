export default function CandidatesLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div className="h-6 w-16 rounded bg-muted" />

      {/* Segmented control skeleton */}
      <div className="flex gap-1 rounded-2xl bg-muted/60 p-1.5">
        <div className="h-10 flex-1 rounded-xl bg-muted" />
        <div className="h-10 flex-1 rounded-xl bg-transparent" />
        <div className="h-10 flex-1 rounded-xl bg-transparent" />
      </div>

      {/* Filter pills skeleton */}
      <div className="flex gap-2">
        <div className="h-8 w-16 rounded-full bg-muted" />
        <div className="h-8 w-24 rounded-full bg-muted" />
        <div className="h-8 w-20 rounded-full bg-muted" />
      </div>

      {/* Venue card skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <div className="aspect-[4/3] w-full rounded-xl bg-muted" />
          <div className="h-5 w-3/4 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
