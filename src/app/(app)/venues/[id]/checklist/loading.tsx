import { Skeleton } from "@/components/ui/skeleton";

export default function VenueChecklistLoading() {
  return (
    <div className="space-y-4 pb-24">
      <Skeleton className="h-5 w-28" />
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-1 h-4 w-24" />
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-5 w-32" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="space-y-1 py-3">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
