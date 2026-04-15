export default function JourneyLoading() {
  return (
    <div className="space-y-8 animate-pulse" aria-hidden="true">
      <div className="space-y-3">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="h-7 w-48 rounded bg-muted" />
          <div className="h-4 w-56 rounded bg-muted" />
        </div>
      </div>

      <div className="h-px w-full rounded bg-muted" />

      <div className="space-y-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
            <div className="flex-1 space-y-2 pb-2">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-3 w-40 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
