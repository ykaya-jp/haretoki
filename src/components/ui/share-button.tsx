"use client";

import { useState, useTransition } from "react";
import { Share2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/use-haptic";
import { track } from "@/lib/analytics";

/**
 * Canonical share primitive — Web Share API → clipboard fallback.
 *
 * Two production callsites already inline this pattern in slightly
 * different shapes (`src/components/venues/share-button.tsx` for
 * the venue detail page, `src/components/family/family-share-manager.tsx`
 * for the family invitation flow). This module is the *consolidated*
 * version a future caller can import once and never re-implement.
 *
 * The two existing callsites are intentionally NOT migrated on this
 * branch — both surfaces are touched by parallel workers (D1 / D6 /
 * family revoke), and a coordinated rewrite would create churn-conflict.
 * The `analyticsKind` prop and the consistent toast / haptic / a11y
 * posture below are the contract a future cleanup round can collapse
 * the legacy callsites onto.
 *
 * Behaviour matrix:
 *   - `navigator.share` available + user accepts → toast skipped (the
 *     OS share sheet IS the success signal).
 *   - `navigator.share` available + user cancels → silent (no toast).
 *     The Web Share spec rejects with `AbortError`; we swallow that
 *     and fall through to clipboard NEVER (a cancel is intentional).
 *   - `navigator.share` unavailable / throws non-AbortError → fall
 *     back to `navigator.clipboard.writeText` + a "リンクをコピー
 *     しました" toast with a 1.5 s success state on the button.
 *   - Clipboard also unavailable (very old browsers, file://) →
 *     toast.error("リンクをうまくコピーできませんでした").
 *
 * a11y: button is a real `<button>` with an `aria-label` that names
 * the action ("リンクを共有"); the success Check icon is `aria-hidden`
 * + a polite `aria-live` region announces "リンクをコピーしました"
 * for SR users.
 *
 * Analytics: emits `<analyticsKind>_share_attempted` and one of
 * `_share_succeeded` / `_share_cancelled` so each surface can measure
 * the cancel rate independently. `analyticsKind` is required on
 * purpose — anonymous "share clicked" events are not useful in the
 * funnel; naming the surface makes the events actionable.
 */

export type ShareButtonVariant = "primary" | "ghost" | "icon";

export interface CanonicalShareButtonProps {
  /** Title passed to the OS share sheet (the OS may ignore it on
   *  desktop / Chrome). */
  title: string;
  /** Body text for the OS share sheet. Should read as a sentence. */
  text?: string;
  /** URL to share. Defaults to `window.location.href`. */
  url?: string;
  /** Disambiguates the analytics event prefix per surface
   *  (`venue` / `compare` / `decision` / `family_invite`). */
  analyticsKind: string;
  /** Visual treatment. `primary` = filled gold-warm CTA, `ghost`
   *  = bordered button, `icon` = circular icon-only (used inside
   *  toolbars). */
  variant?: ShareButtonVariant;
  /** Custom label override. Defaults to "友だちに伝える" for
   *  primary/ghost; ignored for the icon variant. */
  label?: string;
  /** Tailwind class extension hook for layout-specific positioning
   *  on top of the variant's base class. */
  className?: string;
}

const BASE_BY_VARIANT: Record<ShareButtonVariant, string> = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--gold-warm)] px-6 text-sm font-medium text-white shadow-[0_2px_8px_rgba(196,129,110,0.25)] transition-all duration-200 hover:bg-[var(--gold-warm)]/90 active:scale-[0.98] disabled:opacity-50",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card/40 px-5 text-sm text-foreground transition-colors duration-200 hover:bg-muted active:scale-[0.98] disabled:opacity-50",
  icon: "inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:opacity-50",
};

export function ShareButton({
  title,
  text,
  url,
  analyticsKind,
  variant = "ghost",
  label,
  className,
}: CanonicalShareButtonProps) {
  const haptic = useHaptic();
  const [isPending, startTransition] = useTransition();
  // Brief "✓ コピーしました" confirmation state on the button after
  // a clipboard fallback succeeds. Cleared 1.5s later so re-shares
  // don't get a stale checkmark.
  const [justCopied, setJustCopied] = useState(false);

  const resolvedLabel =
    variant === "icon" ? null : label ?? "友だちに伝える";

  const handleShare = () => {
    if (isPending) return;
    haptic("select");
    track(`${analyticsKind}_share_attempted`);
    startTransition(async () => {
      const shareUrl =
        url ?? (typeof window !== "undefined" ? window.location.href : "");
      if (!shareUrl) {
        // Defensive: SSR or malformed environment. Treat as cancel.
        track(`${analyticsKind}_share_cancelled`, { reason: "no_url" });
        return;
      }
      const shareData: ShareData = {
        title,
        text: text ?? title,
        url: shareUrl,
      };

      // Web Share API path
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        try {
          await navigator.share(shareData);
          track(`${analyticsKind}_share_succeeded`, { method: "web_share" });
          return;
        } catch (err) {
          // AbortError = user dismissed the share sheet. That is a
          // legitimate outcome, not an error — emit a cancel event
          // and stop. Falling through to clipboard would surprise
          // the user with a "コピーしました" toast they did not ask for.
          if (err instanceof Error && err.name === "AbortError") {
            track(`${analyticsKind}_share_cancelled`, {
              reason: "user_aborted",
            });
            return;
          }
          // Other errors (permission denied, navigator.share threw
          // synchronously) → fall through to clipboard.
        }
      }

      // Clipboard fallback path
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          track(`${analyticsKind}_share_succeeded`, { method: "clipboard" });
          setJustCopied(true);
          toast.success("リンクをコピーしました");
          window.setTimeout(() => setJustCopied(false), 1500);
          return;
        } catch {
          // Permission denied / focus lost / very old browser.
        }
      }

      track(`${analyticsKind}_share_cancelled`, { reason: "unsupported" });
      toast.error("リンクをうまくコピーできませんでした");
    });
  };

  const Icon = justCopied ? Check : Share2;

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={isPending}
        aria-label={
          variant === "icon"
            ? "リンクを共有"
            : resolvedLabel ?? "リンクを共有"
        }
        className={cn(BASE_BY_VARIANT[variant], className)}
      >
        {isPending ? (
          <Loader2
            className={
              variant === "icon" ? "h-5 w-5 animate-spin" : "h-4 w-4 animate-spin"
            }
            strokeWidth={1.6}
            aria-hidden="true"
          />
        ) : (
          <Icon
            className={
              variant === "icon" ? "h-5 w-5" : "h-4 w-4"
            }
            strokeWidth={1.6}
            aria-hidden="true"
          />
        )}
        {resolvedLabel ? <span>{resolvedLabel}</span> : null}
      </button>
      {/* Polite live region — only updates when the clipboard fallback
          succeeded. Web Share path is silent (the OS share sheet itself
          is the SR-readable feedback). */}
      <span className="sr-only" role="status" aria-live="polite">
        {justCopied ? "リンクをコピーしました" : ""}
      </span>
    </>
  );
}
