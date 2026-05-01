// /visits/[visitId]/way-home — single-screen reflection capture flow
// (WayHomeFlow). Couples reach this on the train home from a venue
// visit, often on a flaky cellular connection, so a deliberate skeleton
// matters more here than the white-flash that Server Component
// navigation causes by default.
export default function WayHomeLoading() {
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <div className="space-y-2">
        <div className="h-3 w-16 animate-pulse rounded bg-muted/60" />
        <div className="h-7 w-44 animate-pulse rounded bg-muted/80" />
      </div>

      {/* Hero card — matches the WayHomeFlow's first-step prompt block. */}
      <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted/40" />

      {/* Action rail */}
      <div className="space-y-3">
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted/50" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted/30" />
      </div>
    </div>
  );
}
