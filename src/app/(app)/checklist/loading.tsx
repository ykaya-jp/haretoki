import { Skeleton } from "@/components/ui/skeleton";

export default function ChecklistLoading() {
  return (
    <div className="space-y-4 pb-24">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-6 w-32" />
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="flex items-center justify-between py-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
