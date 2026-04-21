"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteVenue, refreshVenueFromSource } from "@/server/actions/venues";

interface VenueOverflowMenuProps {
  venueId: string;
  venueName: string;
  hasSourceUrl?: boolean;
}

/**
 * Top-right overflow ("…") menu on the venue detail page.
 *
 * Destructive actions live here (not in the sticky ActionBar) so the
 * primary CTA "比べる" and the trash icon are never adjacent — mis-tapping
 * delete next to the main action at 375px was the recurring complaint.
 * Airbnb / Zola / Resy all follow the same separation.
 *
 * Kept dependency-light: no popover / dropdown primitive — a plain
 * absolutely-positioned panel with outside-click + Escape close.
 */
export function VenueOverflowMenu({ venueId, venueName, hasSourceUrl = false }: VenueOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleRefresh() {
    setOpen(false);
    startRefreshTransition(async () => {
      try {
        const result = await refreshVenueFromSource(venueId);
        if (result.success) {
          const count = result.updatedFields.length;
          const photos = result.photoAddedCount;
          if (count === 0 && photos === 0) {
            toast.info("最新情報と変わりませんでした");
          } else {
            const photoMsg = photos > 0 ? ` · 写真 ${photos} 枚` : "";
            toast.success(`${count} 件の情報を更新しました${photoMsg}`);
          }
        } else {
          toast.error(result.error ?? "更新に失敗しました");
        }
      } catch {
        // Network / route-handler level failure — the action itself
        // threw rather than returning a structured error.
        toast.error(
          "式場の情報サイトにつながりませんでした。しばらくしてからもう一度",
        );
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVenue(venueId);
      if (result.success) {
        toast.success(`${venueName} を削除しました`);
        // Hard nav — PPR Router Cache was keeping the deleted row
        // visible on /explore until reload. See also venue-action-bar.
        window.location.assign("/explore");
      } else {
        toast.error(result.error ?? "削除に失敗しました");
        setShowConfirm(false);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="その他のメニュー"
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:bg-muted"
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-[0_8px_32px_rgba(42,35,32,0.12)]"
          >
            {hasSourceUrl && (
              <button
                type="button"
                role="menuitem"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex w-full min-h-11 items-center gap-2 px-4 text-left text-sm transition-colors hover:bg-muted/50 active:bg-muted disabled:opacity-50"
                style={{ color: "var(--gold-warm, oklch(0.65 0.12 80))" }}
              >
                <RefreshCw className={`h-4 w-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} strokeWidth={1.5} />
                {isRefreshing ? "更新中…" : "情報を更新する"}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setShowConfirm(true);
                setOpen(false);
              }}
              className="flex w-full min-h-11 items-center gap-2 px-4 text-left text-sm text-destructive transition-colors hover:bg-destructive/5 active:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              この式場を削除
            </button>
          </div>
        )}
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={() => {
            if (!isPending) setShowConfirm(false);
          }}
        >
          <div
            className="mx-4 mb-20 w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl sm:mb-0"
            onClick={(e) => e.stopPropagation()}
          >
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
    </>
  );
}
