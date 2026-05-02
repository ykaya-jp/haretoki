import { Skeleton } from "@/components/ui/skeleton";

export default function ExploreLoading() {
  return (
    <div
      className="space-y-10"
      aria-busy="true"
      aria-label="式場をさがす画面を読み込み中"
    >
      {/* Header — eyebrow + h1 + subtitle */}
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3.5 w-36" />
      </div>

      {/* Search bar */}
      <Skeleton aria-hidden="true" className="h-12 w-full rounded-2xl" />

      {/* Filter chips */}
      <div aria-hidden="true" className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-full" />
        ))}
      </div>

      {/* Venue cards */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="space-y-3 rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]"
        >
          <Skeleton className="aspect-[3/2] w-full rounded-t-2xl" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
