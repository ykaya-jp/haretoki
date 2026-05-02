import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <div
      className="mx-auto max-w-lg space-y-6 py-8"
      aria-busy="true"
      aria-label="オンボーディングを読み込み中"
    >
      {/* Progress bar */}
      <Skeleton aria-hidden="true" className="h-1 w-full rounded-full" />
      {/* Chat bubbles */}
      <div aria-hidden="true" className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-24 w-64 rounded-2xl" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-12 w-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
