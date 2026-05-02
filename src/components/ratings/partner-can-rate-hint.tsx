"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * Partner Level 2 — Wave 1.4 upgrade hint.
 *
 * Surfaces the new "partner can rate" capability to a partner-role
 * member who hasn't yet entered any of their own ratings on this venue.
 * Pairs with the A-5 onboarding partner-hint visually + behaviourally
 * so the couple sees a single, recognisable "we have something new for
 * you" treatment across the app.
 *
 * Visibility contract — server gates the mount, the client only
 * decides whether the user has dismissed it before:
 *
 *   - Server passes the hint into <RatingsContent> (or any peer
 *     surface) only when:
 *       1. membership.role === "partner"
 *       2. the partner has zero own ratings on this venue
 *     Both checks live server-side because they're authoritative —
 *     it's cheaper to never ship the hint to an owner-side render
 *     than to let the client repaint after a role check.
 *   - Client just runs the localStorage dismiss gate before mount.
 *
 * Analytics events match the partner-L2 design spec naming:
 *   - `onboarding_partner_can_rate_seen` — first paint after dismiss
 *     check passes (idempotent — re-mounting after a dismiss returns
 *     null before the track call)
 *   - `onboarding_partner_can_rate_clicked` — anchor tap before scroll
 *   - `onboarding_partner_can_rate_dismissed` — X tap before the
 *     localStorage write so the order is observable in the funnel
 *
 * The hint scrolls to the rating section instead of navigating away,
 * because Wave 1.1 already lets a partner edit their own ratings
 * inline on the venue detail page. The CTA is a quiet anchor, not a
 * transition.
 */

const DISMISS_KEY = "onboarding_partner_can_rate_dismissed";

interface PartnerCanRateHintProps {
  /** Anchor target the CTA scrolls to. Defaults to "rating" — the
   *  id rating-section.tsx (Wave 1.1) renders. Pass a different id
   *  when this hint sits on a surface that uses a different anchor. */
  ratingSectionId?: string;
}

export function PartnerCanRateHint({
  ratingSectionId = "rating",
}: PartnerCanRateHintProps) {
  // Tri-state mirrors the OnboardingPartnerHint pattern (round 20):
  // null = pre-hydration, true/false = post-hydration resolution.
  // Keeping the explicit null avoids a flash of the hint for users
  // who already dismissed it.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let isDismissed = false;
    try {
      isDismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // localStorage can throw under Safari private-mode quotas;
      // treat as "not dismissed" so the partner can still see and
      // act on it next session.
      isDismissed = false;
    }
    // Same rAF defer as OnboardingPartnerHint — keeps React Compiler
    // happy with the set-state-in-effect rule without disabling it.
    const raf = requestAnimationFrame(() => {
      setDismissed(isDismissed);
      if (!isDismissed) {
        track("onboarding_partner_can_rate_seen");
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (dismissed) return null;

  const handleClick = () => {
    track("onboarding_partner_can_rate_clicked");
    // Smooth-scroll to the rating section. The anchor href would
    // also work, but smooth-scroll keeps the in-page move calm.
    if (typeof document !== "undefined") {
      const target = document.getElementById(ratingSectionId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleDismiss = () => {
    track("onboarding_partner_can_rate_dismissed");
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Same private-mode fallback — honour the dismiss for this
      // session via component state even if we can't persist.
    }
    setDismissed(true);
  };

  return (
    <div
      className="relative rounded-2xl border bg-card/40 px-5 py-4"
      style={{
        borderColor: "color-mix(in oklab, var(--gold-warm) 18%, transparent)",
      }}
    >
      {/* Dismiss — same proportions as OnboardingPartnerHint so the
          two surfaces feel like one family. */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="このお誘いを閉じる"
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground active:bg-muted"
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>

      <p className="flex items-center gap-1.5 text-eyebrow text-[var(--gold-warm)]">
        <Sparkles
          className="h-3.5 w-3.5"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        新しくなりました
      </p>
      <button
        type="button"
        onClick={handleClick}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-foreground hover:text-[var(--gold-warm)]"
      >
        自分の評価を加える
        <span aria-hidden="true" className="text-[var(--gold-warm)]">
          ↓
        </span>
      </button>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        おふたりの評価を並べて、合うところと違うところを見つけられます。
      </p>
    </div>
  );
}
