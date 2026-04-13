export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-16 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
