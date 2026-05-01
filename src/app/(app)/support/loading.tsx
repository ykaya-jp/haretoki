export default function SupportLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-12 px-4 pb-32 pt-6">
      <div className="space-y-3">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted/80" />
        <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
      </div>
      <div className="space-y-3">
        <div className="h-5 w-32 animate-pulse rounded bg-muted/80" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted/40" />
      </div>
      <div className="space-y-3">
        <div className="h-5 w-32 animate-pulse rounded bg-muted/80" />
        <div className="h-72 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    </div>
  );
}
