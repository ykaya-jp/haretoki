import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

/**
 * Segment-level not-found boundary for the venue detail route.
 *
 * Without this file, a `notFound()` call inside /venues/[id]/page.tsx
 * (which fires when the venue has been deleted or doesn't belong to the
 * caller's project) bubbled up to the parent error.tsx and rendered as
 * "式場情報を読み込めませんでした" — making a stale link look like an
 * app crash and blocking the couple from deleting or re-adding a venue.
 * Catching it here gives them a clean recovery.
 */
export default function VenueDetailNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <Search className="h-12 w-12 text-muted-foreground" />
          <div>
            <h2 className="text-lg">
              その式場は、もう見つかりませんでした
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              一覧の情報が古いかもしれません。候補から開き直すと最新の状態に戻ります。
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button render={<Link href="/candidates" prefetch={true} />} className="w-full">
              候補一覧に戻る
            </Button>
            <Button
              variant="outline"
              render={<Link href="/explore" prefetch={true} />}
              className="w-full"
            >
              式場を探す
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
