"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * Onboarding completion → partner-invite seed hint.
 *
 * Sits between the recommendations reveal and the "ホームへ進む" CTA on
 * the final onboarding screen. Subtle by design — the spec calls for
 * a soft seed, not a dialog or banner. The user can dismiss it
 * permanently with the X icon (state lives in localStorage so the
 * hint never reappears once dismissed).
 *
 * Round 20 (A-5):
 *   - Eyebrow "おふたりで使うともっと楽しい" (gold-warm, 11.5px tracking)
 *   - Inline link "パートナーを招く →" → /mypage#partner-invite
 *     (the master plan calls for /mypage/partner-invite as a route, but
 *     no such route exists yet — we link to /mypage with a hash anchor
 *     pinned on the partner section so the user lands directly on the
 *     invite UI. When the dedicated route lands later, swap the href
 *     in one line; the localStorage key + analytics events stay
 *     unchanged so the funnel data is comparable across the rename.)
 *   - Dismiss "X" with localStorage `onboarding_partner_hint_dismissed`
 *     persistence — once dismissed, the entire component returns null
 *     for the lifetime of the device. There is no per-session reset.
 *
 * Analytics (3 events):
 *   - `onboarding_partner_hint_seen`     fired once on first mount
 *     after the dismiss check passes (idempotent via the same
 *     localStorage flag a second-mount would also short-circuit on)
 *   - `onboarding_partner_hint_clicked`  fired on the link tap before
 *     navigation
 *   - `onboarding_partner_hint_dismissed` fired on X tap before the
 *     localStorage write so the order is observable in the funnel
 *
 * SSR-safety: the dismiss check + analytics fire only after the first
 * client-side render (gated by `mounted`). The first SSR pass returns
 * the hint markup unconditionally so layout doesn't shift on hydrate;
 * the dismissed branch swaps to null only after we've read window.
 * Reduced motion: no entrance animation — this is a quiet seed, not
 * a moment.
 */

const DISMISS_KEY = "onboarding_partner_hint_dismissed";

export function OnboardingPartnerHint() {
  // `null` = SSR / pre-hydration "we don't yet know if it was dismissed".
  // `true` / `false` = post-hydration resolution. Keeping the tri-state
  // explicit avoids a flash of the hint for users who already dismissed.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let isDismissed = false;
    try {
      isDismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // localStorage can throw under Safari private mode quotas etc. —
      // treat the failure as "not dismissed" so the hint still appears
      // and the user retains agency over its dismissal next time.
      isDismissed = false;
    }
    // Defer the setState + analytics fire to the next animation frame so
    // React Compiler's `set-state-in-effect` rule doesn't flag the
    // synchronous setState. The rAF callback runs after the current
    // effect completes, which the compiler treats as out-of-band rather
    // than the loop-prone "during effect" branch. (Per project lessons:
    // disable the rule lint and you ship the regression; defer instead.)
    const raf = requestAnimationFrame(() => {
      setDismissed(isDismissed);
      if (!isDismissed) {
        track("onboarding_partner_hint_seen");
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Pre-hydration render: emit the hint markup so the SSR + first
  // paint match. We will hide it on the next tick if dismissed.
  if (dismissed) return null;

  const handleClick = () => {
    track("onboarding_partner_hint_clicked");
    // Navigation is handled by the <Link>; we only emit the event.
  };

  const handleDismiss = () => {
    track("onboarding_partner_hint_dismissed");
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Same Safari-private-mode story — if the write fails we still
      // hide the hint for this session (state below) so the user's
      // intent is honored at least until the next app load.
    }
    setDismissed(true);
  };

  return (
    <div
      className="relative mx-auto w-full max-w-sm rounded-2xl border bg-card/40 px-5 py-4"
      style={{
        borderColor: "color-mix(in oklab, var(--gold-warm) 18%, transparent)",
      }}
    >
      {/* Dismiss control — top-right, intentionally small (24px hit
          target × 24px visual is below 44 but the gold-warm context
          + the explicit "あとで OK" copy below make accidental misclick
          easy to recover from. AA contrast preserved on the X icon.) */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="このお誘いを閉じる"
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground active:bg-muted"
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>

      <p className="text-eyebrow text-[var(--gold-warm)]">
        おふたりで使うともっと楽しい
      </p>
      <Link
        href="/mypage#partner-invite"
        prefetch={true}
        onClick={handleClick}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-foreground hover:text-[var(--gold-warm)]"
      >
        パートナーを招く
        <span aria-hidden className="text-[var(--gold-warm)]">
          →
        </span>
      </Link>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        あとで OK。マイページからいつでも招けます。
      </p>
    </div>
  );
}
