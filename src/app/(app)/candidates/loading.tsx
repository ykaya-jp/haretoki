import { Skeleton } from "@/components/ui/skeleton";

export default function CandidatesLoading() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <Skeleton className="h-6 w-16" />

      {/* Segmented control (3 buttons) */}
      <div className="flex gap-1 rounded-2xl bg-muted/60 p-1.5">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      {/* Venue cards (3) */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
