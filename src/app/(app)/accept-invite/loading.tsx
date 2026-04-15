import { Card, CardContent } from "@/components/ui/card";

export default function AcceptInviteLoading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <div className="mx-auto h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="mx-auto h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="space-y-4 p-6">
            <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-muted" />
            <div className="mx-auto h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
