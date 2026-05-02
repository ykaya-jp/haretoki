import { Skeleton } from "@/components/ui/skeleton";

/**
 * (app) segment fallback — fires before any nested loading.tsx
 * resolves, or for routes without their own. The previous spinner
 * was the only non-editorial loading surface in the (app) tree;
 * D4 swaps it for a 3-line shimmer header so the brand language
 * (gold-tinted shimmer sweep, reduced-motion friendly) holds even
 * on the briefest fallback paint.
 *
 * Kept short — every (app)/<segment>/loading.tsx renders a richer
 * structure-aware skeleton; this one only shows when none of those
 * are matched yet.
 */
export default function AppLoading() {
  return (
    <div
      className="space-y-6 pb-8"
      aria-label="読み込み中"
      aria-live="polite"
      aria-busy="true"
    >
      <div aria-hidden="true" className="space-y-2.5">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-7 w-56 rounded-lg" />
        <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
      </div>
      <Skeleton aria-hidden="true" className="h-px w-full" />
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    </div>
  );
}
