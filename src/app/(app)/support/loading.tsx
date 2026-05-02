import { Skeleton } from "@/components/ui/skeleton";

export default function SupportLoading() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-12 px-4 pb-32 pt-6"
      aria-busy="true"
      aria-label="サポート画面を読み込み中"
    >
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
