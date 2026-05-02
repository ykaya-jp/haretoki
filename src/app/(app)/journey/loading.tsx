import { Skeleton } from "@/components/ui/skeleton";

export default function JourneyLoading() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="晴れまでの道を読み込み中"
    >
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      <Skeleton aria-hidden="true" className="h-px w-full" />

      <div aria-hidden="true" className="space-y-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
