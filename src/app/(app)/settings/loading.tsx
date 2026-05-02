import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="設定を読み込み中"
    >
      {/* Header */}
      <Skeleton aria-hidden="true" className="h-6 w-16" />

      {/* Profile section */}
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-5 w-48" />
        </div>
      </div>

      {/* Partner section */}
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-5 w-36" />
        </div>
      </div>

      {/* Preferences section */}
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <div className="space-y-4 rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <Skeleton className="h-4 w-20" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Theme section */}
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-3 w-12" />
        <div className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-1 rounded-full bg-muted p-1">
            <Skeleton className="h-8 w-16 rounded-full" />
            <div className="h-8 w-16 rounded-full bg-transparent" />
            <div className="h-8 w-16 rounded-full bg-transparent" />
          </div>
        </div>
      </div>

      {/* Logout */}
      <div aria-hidden="true" className="pt-4">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
