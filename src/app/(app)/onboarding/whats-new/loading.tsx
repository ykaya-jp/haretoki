import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-[420px] px-5 pb-24 pt-8 sm:max-w-[640px]">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="mt-8 flex h-40 items-end justify-center">
        <Skeleton className="h-32 w-32 rounded-full" />
      </div>
      <Skeleton className="mx-auto mt-6 h-9 w-72" />
      <Skeleton className="mx-auto mt-3 h-4 w-60" />
      <Skeleton className="mt-8 h-32 w-full rounded-xl" />
      <div className="mt-8 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="mt-10 h-12 w-full" />
    </main>
  );
}
