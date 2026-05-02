import { Skeleton } from "@/components/ui/skeleton";

export default function WeightsLoading() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="重み設定を読み込み中"
    >
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div aria-hidden="true" className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
