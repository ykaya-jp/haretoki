import { Skeleton } from "@/components/ui/skeleton";

export default function PreparationLoading() {
  return (
    <div className="space-y-8 pb-24">
      <div className="space-y-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="flex justify-center">
        <Skeleton className="h-24 w-24 rounded-full" />
      </div>

      {[1, 2].map((g) => (
        <div key={g} className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
