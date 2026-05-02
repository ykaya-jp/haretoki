import { Skeleton } from "@/components/ui/skeleton";

// /visits/[visitId]/way-home — single-screen reflection capture flow
// (WayHomeFlow). Couples reach this on the train home from a venue
// visit, often on a flaky cellular connection, so a deliberate skeleton
// matters more here than the white-flash that Server Component
// navigation causes by default.
export default function WayHomeLoading() {
  return (
    <div
      className="mx-auto max-w-md space-y-6 px-4 py-8"
      aria-busy="true"
      aria-label="帰り道メモを読み込み中"
    >
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-44" />
      </div>

      {/* Hero card — matches the WayHomeFlow's first-step prompt block. */}
      <Skeleton aria-hidden="true" className="aspect-[4/3] rounded-2xl" />

      {/* Action rail */}
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
