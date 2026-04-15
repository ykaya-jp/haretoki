export default function NotificationsLoading() {
  return (
    <div className="space-y-8">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-64 rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border bg-card p-4 space-y-2"
          >
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
