import { Skeleton } from "@/components/ui/skeleton";

export default function CompareLoading() {
  return (
    <div
      className="pb-24"
      aria-busy="true"
      aria-label="比較ボードを読み込み中"
    >
      <div aria-hidden="true" className="mb-4 space-y-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div aria-hidden="true" className="overflow-x-auto">
        <div className="flex gap-3 pb-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-32 flex-shrink-0 rounded-lg" />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-3 border-b py-3">
            <Skeleton className="h-4 w-40 flex-shrink-0" />
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-8 w-32 flex-shrink-0 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
