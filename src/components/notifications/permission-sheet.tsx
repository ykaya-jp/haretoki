"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  getPushState,
  isPushSupported,
  requestAndSubscribe,
} from "@/lib/push/subscription";

/**
 * Permission opt-in bottom sheet (Track B-1).
 *
 * Triggers 1 sec after `triggerKey` changes — typically the
 * just-saved visit id, surfaced from the visit-create flow. The
 * 1-sec delay lets the success toast settle before the modal lands
 * so the two surfaces don't race for the user's attention.
 *
 * Suppression rules (must compose, all checked before showing):
 *   1. `localStorage["haretoki.push-prompt-dismissed"] = "1"` — set
 *      when the user clicks "受け取らない". Permanent until they
 *      manually opt-in from the settings UI.
 *   2. `Notification.permission` is already `granted` or `denied` —
 *      nothing to ask, the system has already decided.
 *   3. Browser doesn't support Push at all — silent no-show.
 *
 * The "後で" path doesn't persist anything: the sheet will surface
 * again next time the user adds a visit. Designed so the user can
 * defer without committing to "never".
 *
 * Lexicon (docs/copy-lexicon.md):
 *   - 急かさない: no time pressure copy
 *   - ふたり主語: 「おふたりに届けます」
 *   - 命令形避ける: 「受け取りますか？」
 */

const DISMISSED_STORAGE_KEY = "haretoki.push-prompt-dismissed";

interface PermissionSheetProps {
  /**
   * Caller passes a value that changes whenever a fresh trigger
   * should fire (typically the just-saved visit id). Same value =
   * already-shown; new value = re-evaluate suppression and maybe
   * open the sheet.
   */
  triggerKey: string | null;
  /** VAPID public key — passed from the server so it tracks env. */
  vapidPublicKey: string;
}

export function PermissionSheet({
  triggerKey,
  vapidPublicKey,
}: PermissionSheetProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Dedupe key tracked in a ref (not state) so we don't trip React 19's
  // `set-state-in-effect` rule. The ref is for "have we already evaluated
  // this trigger?" — we never need to re-render when it changes.
  const lastTriggerRef = useRef<string | null>(null);

  useEffect(() => {
    if (!triggerKey || triggerKey === lastTriggerRef.current) return;
    lastTriggerRef.current = triggerKey;

    // Suppression checks — keep these synchronous + cheap so a fast
    // user flow doesn't flicker.
    if (!isPushSupported()) return;
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(DISMISSED_STORAGE_KEY) === "1") return;
    } catch {
      // Private mode / quota exceeded — proceed without persistence.
    }
    if (Notification.permission !== "default") return;

    // 1-second delay so the visit-save toast lands first.
    const timer = setTimeout(() => setOpen(true), 1000);
    return () => clearTimeout(timer);
  }, [triggerKey]);

  function handleAccept() {
    startTransition(async () => {
      try {
        const state = await requestAndSubscribe({ vapidPublicKey });
        setOpen(false);
        if (state.supported && state.permission === "granted") {
          toast.success("リマインダーをお届けします", {
            description: "通知設定はマイページからいつでも変更できます",
          });
        } else if (state.supported && state.permission === "denied") {
          toast.message("受け取らないことにします", {
            description: "ブラウザ設定からあとで変更できます",
          });
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message === "notifications-not-supported"
            ? "このブラウザは通知に対応していません"
            : "通知の設定に失敗しました";
        toast.error(message);
        setOpen(false);
      }
    });
  }

  function handleLater() {
    // No persistence — the sheet will surface again on the next visit.
    setOpen(false);
  }

  function handleNever() {
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    } catch {
      // Private mode — fall back to in-session suppression. Re-opens
      // on next page load, which is acceptable UX.
    }
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold-subtle)] text-[var(--gold-warm)]">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </div>
          <SheetTitle className="text-center font-serif text-xl font-light tracking-tight">
            見学のリマインダーを
            <br />
            おふたりに届けますか？
          </SheetTitle>
          <SheetDescription className="text-center text-sm leading-relaxed text-muted-foreground">
            前日朝に持ちものを、当日 1 時間前に注目ポイントを、
            <br />
            見学後にメモのお誘いをお届けします。
          </SheetDescription>
        </SheetHeader>

        <ul className="my-6 space-y-2 px-2 text-sm text-foreground">
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--gold-warm)]" />
            <span>前日朝に下見準備のメモ</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--gold-warm)]" />
            <span>当日 1 時間前に注目ポイント</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--gold-warm)]" />
            <span>見学後にメモを残すお誘い</span>
          </li>
        </ul>

        <div className="flex flex-col gap-2.5">
          <Button
            type="button"
            onClick={handleAccept}
            disabled={isPending}
            className="min-h-11 w-full"
          >
            {isPending ? "確認中…" : "はい、お願いします"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleLater}
            disabled={isPending}
            className="min-h-11 w-full"
          >
            あとで決める
          </Button>
          <button
            type="button"
            onClick={handleNever}
            disabled={isPending}
            className="mt-1 inline-flex min-h-11 items-center justify-center gap-1.5 self-center text-xs text-muted-foreground hover:text-foreground"
          >
            <BellOff className="h-3 w-3" aria-hidden="true" />
            受け取らない
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Test-only escape hatch. Components that gate on
 * `localStorage.haretoki.push-prompt-dismissed` can clear it through
 * this helper (jsdom localStorage is per-test, but keeping the
 * constant exported lets other suites reset deterministically).
 */
export const PUSH_PROMPT_DISMISSED_KEY = DISMISSED_STORAGE_KEY;

// Re-exported so the settings-page UI can use the same state probe
// without importing the lib directly (keeps the import surface small
// for the page).
export { getPushState, isPushSupported };
