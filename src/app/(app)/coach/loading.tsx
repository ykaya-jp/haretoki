import { Skeleton } from "@/components/ui/skeleton";

export default function CoachLoading() {
  return (
    <div
      className="space-y-5 pb-20"
      aria-busy="true"
      aria-label="AIコーチを読み込み中"
    >
      {/* Header */}
      <Skeleton aria-hidden="true" className="h-6 w-24" />

      {/* Insight card skeletons */}
      {[1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="space-y-3 rounded-2xl border-l-[3px] border-l-muted bg-surface-sunken p-4"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
      ))}

      {/* Chat divider skeleton */}
      <div aria-hidden="true" className="my-4 flex items-center gap-3">
        <Skeleton className="h-px flex-1" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-px flex-1" />
      </div>

      <div aria-hidden="true" className="flex gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
      </div>
      <div aria-hidden="true" className="flex justify-end">
        <Skeleton className="h-12 w-2/3 rounded-2xl" />
      </div>
    </div>
  );
}
