export default function SettingsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="h-6 w-16 rounded bg-muted" />

      {/* Profile section */}
      <div className="space-y-3">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="mt-2 h-5 w-48 rounded bg-muted" />
        </div>
      </div>

      {/* Partner section */}
      <div className="space-y-3">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="mt-2 h-5 w-36 rounded bg-muted" />
        </div>
      </div>

      {/* Preferences section */}
      <div className="space-y-3">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="space-y-4 rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-20 rounded-full bg-muted" />
            ))}
          </div>
        </div>
      </div>

      {/* Theme section */}
      <div className="space-y-3">
        <div className="h-3 w-12 rounded bg-muted" />
        <div className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="flex gap-1 rounded-full bg-muted p-1">
            <div className="h-8 w-16 rounded-full bg-muted/50" />
            <div className="h-8 w-16 rounded-full bg-transparent" />
            <div className="h-8 w-16 rounded-full bg-transparent" />
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="pt-4">
        <div className="h-12 w-full rounded-xl bg-muted" />
      </div>
    </div>
  );
}
