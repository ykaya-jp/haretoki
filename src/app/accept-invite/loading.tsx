import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AcceptInviteLoading() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-background p-4"
      aria-busy="true"
      aria-label="招待を読み込み中"
    >
      <div aria-hidden="true" className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <Skeleton className="mx-auto h-6 w-48" />
          <Skeleton className="mx-auto h-4 w-64" />
        </div>
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="space-y-4 p-6">
            <Skeleton className="mx-auto h-16 w-16 rounded-full" />
            <Skeleton className="mx-auto h-4 w-full" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
