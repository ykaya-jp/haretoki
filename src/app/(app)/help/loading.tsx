import { Skeleton } from "@/components/ui/skeleton";

export default function HelpLoading() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-12 px-4 pb-32 pt-6"
      aria-busy="true"
      aria-label="ヘルプを読み込み中"
    >
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
      <Skeleton aria-hidden="true" className="h-32 rounded-2xl" />
    </div>
  );
}
