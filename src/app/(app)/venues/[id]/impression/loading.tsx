import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-[640px] pb-32">
      <header className="sticky top-0 z-20 -mx-5 flex items-center gap-3 border-b border-border/40 bg-background/85 px-5 py-3 backdrop-blur-md">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="ml-auto h-3 w-20" />
      </header>
      <Skeleton className="-mx-5 mt-2 aspect-[4/3] w-[calc(100%+2.5rem)]" />
      <div className="-mt-8 px-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-9 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
      <div className="mt-8 space-y-3 px-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </main>
  );
}
