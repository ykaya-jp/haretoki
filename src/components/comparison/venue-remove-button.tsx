"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { deleteVenue, restoreVenue } from "@/server/actions/venues";

interface VenueRemoveButtonProps {
  venueId: string;
  venueName: string;
}

/**
 * W21-7: × button overlaid on the comparison header photo.
 *
 * The whole header column is wrapped in a Link to /venues/[id], so every
 * pointer event we own has to `stopPropagation` + `preventDefault` —
 * otherwise tapping × or any dialog control navigates to the PDP at the
 * same time as opening the dialog. The dialog overlay is fixed to the
 * viewport (`fixed inset-0`) and re-stops propagation on its own
 * surfaces so the dismiss tap also can't reach the underlying Link.
 *
 * Soft-delete contract:
 *  - `deleteVenue` stamps `deletedAt = now()` across venue + visits +
 *    notes + ratings + checklist (W20-3) — the row is filtered out of
 *    every read path immediately but the data stays.
 *  - `restoreVenue` flips it back, restoring only the children whose
 *    `deletedAt` matches the parent's exact timestamp (so a future
 *    per-record 手放す UI doesn't get reverted by mistake).
 *  - The toast carries a "戻す" action that calls `restoreVenue` —
 *    Sonner's action duration is 8s, which is the headroom couples have
 *    to undo before the row commits to the "out of sight" state.
 */
export function VenueRemoveButton({
  venueId,
  venueName,
}: VenueRemoveButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function openDialog(e: React.MouseEvent) {
    // The button sits inside a <Link>; without these, every tap also
    // navigates to /venues/[id].
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  }

  function performRestore() {
    startTransition(async () => {
      const result = await restoreVenue(venueId);
      if (result.success) {
        toast.success(`${venueName}を戻しました`);
        router.refresh();
      } else {
        toast.error(result.error ?? "戻せませんでした");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVenue(venueId);
      if (!result.success) {
        toast.error(result.error ?? "手放せませんでした");
        return;
      }
      setShowConfirm(false);
      // The row is gone from /compare immediately on refresh; the toast
      // is the only place "戻す" can be triggered before it auto-
      // dismisses. duration 8000 leaves room for a panicked re-tap.
      toast.success(`${venueName}を比較から手放しました`, {
        description: "気が変わったら、ここから戻せます。",
        action: {
          label: "戻す",
          onClick: performRestore,
        },
        duration: 8000,
      });
      router.refresh();
    });
  }

  function dismissDialog(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    if (!isPending) setShowConfirm(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={`${venueName}を比較から手放す`}
        // Positioning is the caller's job — desktop grid pins this to the
        // header column, mobile snapper pins it to the photo's top-right.
        // Keeping the button itself flow-static lets both layouts wrap it
        // in their own absolute container without fighting each other.
        className="flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background hover:text-destructive active:scale-95"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </button>

      {showConfirm && (
        // a11y: dialog wrapper has onKeyDown for Escape; the rule
        // doesn't recognise role=dialog as interactive. Real-button
        // backdrop sits inside, see below.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          // W21-4: SafeArea inset so the bottom-sheet card doesn't land
          // under the iOS home bar at 375px. The bottom padding pulls
          // the home-pill height (typically 34px) into the overlay; on
          // desktop (sm:items-center) the dialog is centered and the
          // inset becomes a no-op. paddingLeft/Right protect against
          // landscape ears on iPhone notch devices. (Tailwind v4 scans
          // arbitrary class candidates out of comments, so any literal
          // utility name with three dots inside the brackets is
          // intentionally avoided here — last time it materialised as
          // a broken CSS rule and crashed the dev build.)
          className="fixed inset-0 z-50 flex items-end justify-center px-[max(0px,env(safe-area-inset-left))] pb-[env(safe-area-inset-bottom)] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="venue-remove-title"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !isPending) {
              e.stopPropagation();
              setShowConfirm(false);
            }
          }}
        >
          {/* Backdrop button — replaces a non-interactive div with
              onClick. tabIndex={-1} keeps it out of the Tab order
              (the cancel button below is the keyboard exit) but it
              still satisfies click-events-have-key-events because
              <button> is natively keyboard-actionable.
              The underlying ComparisonHeaderColumn is a <Link>, so the
              backdrop must also stop pointer-down propagation —
              otherwise the dismiss tap navigates to the PDP. */}
          <button
            type="button"
            aria-label="ダイアログを閉じる"
            tabIndex={-1}
            disabled={isPending}
            onClick={(e) => dismissDialog(e)}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          {/* Inner card. Mouse/touch listeners only stop propagation
              so taps inside the dialog don't reach the parent
              <Link> — they're not real interactive surfaces. */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className="relative mx-4 mb-20 w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl sm:mb-0"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <p
              id="venue-remove-title"
              className="text-sm font-medium text-foreground"
            >
              「{venueName}」を比較から外しますか？
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              評価・見積もり・見学記録は手元に残ります。あとから「戻す」でいつでも戻せます。
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(false);
                }}
                disabled={isPending}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-border text-sm text-muted-foreground transition-transform active:scale-[0.98]"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={isPending}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-destructive text-sm font-medium text-destructive-foreground transition-transform active:scale-[0.98]"
              >
                {isPending ? "手放しています…" : "手放す"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
