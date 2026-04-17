"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { HeartButton } from "@/components/venues/heart-button";
import { ShareButton } from "@/components/venues/share-button";
import { deleteVenue } from "@/server/actions/venues";
import Link from "next/link";

interface VenueActionBarProps {
  venueId: string;
  venueName: string;
  isFavorite: boolean;
}

export function VenueActionBar({ venueId, venueName, isFavorite }: VenueActionBarProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVenue(venueId);
      if (result.success) {
        toast.success(`${venueName} を削除しました`);
        // Force full refresh to clear cached DOM (cacheComponents soft-nav
        // can leave stale venue data/photos in the client cache).
        router.refresh();
        router.push("/explore");
      } else {
        toast.error(result.error ?? "削除に失敗しました");
        setShowConfirm(false);
      }
    });
  }

  return (
    <>
      {/* Delete confirmation overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm pb-[calc(56px+env(safe-area-inset-bottom)+68px)]">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
            <p className="text-sm font-medium text-foreground">
              「{venueName}」を削除しますか？
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              評価・見積もり・見学記録もすべて削除されます。この操作は取り消せません。
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-border text-sm text-muted-foreground transition-transform active:scale-[0.98]"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-destructive text-sm font-medium text-destructive-foreground transition-transform active:scale-[0.98]"
              >
                {isPending ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-border/40 bg-card/80 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <HeartButton venueId={venueId} initialFavorite={isFavorite} />
          <ShareButton venueName={venueName} />
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="flex min-h-[44px] w-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-transform active:scale-95 active:bg-muted"
            aria-label="式場を削除"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <Link
            href="/candidates"
            prefetch={true}
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-95"
          >
            {isFavorite ? "ほかの式場と比べる" : "候補に入れて比べる"}
          </Link>
        </div>
      </div>
    </>
  );
}
