import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-40 rounded bg-muted" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-[var(--shadow-soft)]">
            <CardContent className="p-4">
              <div className="h-3 w-16 rounded bg-muted mb-2" />
              <div className="h-8 w-12 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-[var(--shadow-soft)]">
        <CardContent className="p-4 space-y-3">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-10 w-32 rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
