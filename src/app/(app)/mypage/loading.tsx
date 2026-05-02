import { Skeleton } from "@/components/ui/skeleton";

export default function MyPageLoading() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="マイページを読み込み中"
    >
      <Skeleton aria-hidden="true" className="h-8 w-32" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} aria-hidden="true" className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
