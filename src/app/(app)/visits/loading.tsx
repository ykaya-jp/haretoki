import { Skeleton } from "@/components/ui/skeleton";

export default function VisitsLoading() {
  return (
    <div
      className="space-y-8 pb-8"
      aria-busy="true"
      aria-label="見学カレンダーを読み込み中"
    >
      {/* Title skeleton */}
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-7 w-40 rounded-full" />
      </div>
      {/* Calendar skeleton */}
      <Skeleton aria-hidden="true" className="h-64 rounded-2xl" />
      {/* List skeleton */}
      <div aria-hidden="true" className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
