// /candidates/duel — picks two venues from the URL and renders DuelClient.
// The shell here matches the duel layout: two side-by-side venue cards
// stacked above a question rail. Skeleton blocks reflect that rhythm so
// the layout shift on hydration stays minimal.
export default function DuelLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-7 w-44 animate-pulse rounded bg-muted/80" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="aspect-[3/4] animate-pulse rounded-2xl bg-muted/50" />
        <div className="aspect-[3/4] animate-pulse rounded-2xl bg-muted/50" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted/70" />
        <div className="h-20 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    </div>
  );
}
