import { Skeleton } from "@/components/ui/skeleton";

export default function SavedSearchesLoading() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="保存した検索を読み込み中"
    >
      <div aria-hidden="true" className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
