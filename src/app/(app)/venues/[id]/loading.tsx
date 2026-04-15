import { Skeleton } from "@/components/ui/skeleton";

export default function VenueDetailLoading() {
  return (
    <div className="space-y-6 pb-20">
      {/* Back link */}
      <Skeleton className="h-4 w-12" />

      {/* Photo carousel */}
      <Skeleton className="aspect-[4/3] w-full rounded-2xl" />

      {/* Venue header: name + address + chips */}
      <div className="space-y-3">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 flex-1 rounded-2xl" />
        ))}
      </div>

      {/* Rating section: heading + 6 star rows */}
      <section className="space-y-4 rounded-2xl bg-card p-5 shadow-sm">
        <Skeleton className="h-5 w-16" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-40" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Skeleton key={n} className="h-12 w-12 rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Estimate section: card-like */}
      <section className="space-y-3 rounded-2xl bg-card p-5 shadow-sm">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </section>
    </div>
  );
}
