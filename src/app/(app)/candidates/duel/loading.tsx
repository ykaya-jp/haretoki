import { Skeleton } from "@/components/ui/skeleton";

// /candidates/duel — picks two venues from the URL and renders DuelClient.
// The shell here matches the duel layout: two side-by-side venue cards
// stacked above a question rail. Skeleton blocks reflect that rhythm so
// the layout shift on hydration stays minimal.
export default function DuelLoading() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="比較画面を読み込み中"
    >
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-44" />
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        <Skeleton className="aspect-[3/4] rounded-2xl" />
        <Skeleton className="aspect-[3/4] rounded-2xl" />
      </div>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </div>
  );
}
