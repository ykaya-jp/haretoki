import { Skeleton } from "@/components/ui/skeleton";

export default function GuestViewLoading() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="共有された候補を読み込み中"
    >
      <div aria-hidden="true" className="space-y-4 text-center">
        <Skeleton className="mx-auto h-3 w-32 rounded-full" />
        <Skeleton className="mx-auto h-8 w-[260px] rounded-full" />
        <Skeleton className="mx-auto h-3 w-48 rounded-full" />
      </div>
      <ul aria-hidden="true" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card"
          >
            <Skeleton className="aspect-[4/3]" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
