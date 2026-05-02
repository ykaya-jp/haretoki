"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * D3 — Partner welcome modal.
 *
 * Surfaces ONCE per device when a partner-role member lands on /home
 * for the first time after signup. Owner-side onboarding (the 4-step
 * flow) is intentionally NOT shown to partners — they joined via an
 * invite link, the conditions are already set by the owner; the
 * partner just needs a "you've arrived, here's what's already here"
 * primer.
 *
 * Visibility contract:
 *   - Server gates the mount: only renders when membership.role
 *     === "partner". Owners never receive this component in their
 *     React tree.
 *   - Client gates the visibility: localStorage dismiss flag drops
 *     the modal silently on subsequent loads.
 *   - Both layers are required because the server gate alone would
 *     re-show the modal on every /home revisit, and the client gate
 *     alone would show it briefly to owners during the dismiss
 *     check (an owner should never see this surface at all).
 *
 * Pairs visually with OnboardingPartnerHint (A-5) and
 * PartnerCanRateHint (wave 1.4): same gold-warm border, same X
 * dismiss control proportion, same tri-state hydration to avoid
 * flash-of-modal for users who already dismissed. The differences
 * are intentional:
 *   - Heavier surface (full-screen overlay vs in-panel banner) —
 *     this is "first time arrival", not "by-the-way notice".
 *   - Sunny gradient background hero — the brand metaphor for
 *     "you've arrived at the bright morning, the fog is lifting".
 *   - 2 CTAs (はじめる / あとで) instead of just an X — the partner
 *     either commits to the new context or asks for a moment, both
 *     close the modal but emit different events.
 */

const DISMISS_KEY = "partner_welcome_modal_dismissed";

interface PartnerWelcomeModalProps {
  /** The owner's display name as resolved on the server. Falls back
   *  to "おふたりの相棒" so the headline always reads as a sentence
   *  even when the owner has not set a name yet. */
  ownerName: string;
}

export function PartnerWelcomeModal({ ownerName }: PartnerWelcomeModalProps) {
  // Tri-state mirrors the OnboardingPartnerHint / PartnerCanRateHint
  // pattern: null = pre-hydration, true/false = post-hydration. The
  // explicit null prevents a flash of the modal for users who already
  // dismissed it on a prior /home visit.
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let isDismissed = false;
    try {
      isDismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // Safari private mode etc. — treat as "not dismissed" so the
      // partner can still see the welcome on a regular browser, and
      // the dismiss is honoured by component state below within the
      // current session even if we cannot persist.
      isDismissed = false;
    }
    // rAF defer so the setState doesn't fire during the synchronous
    // effect tick (React Compiler set-state-in-effect rule). Same
    // recipe as the rest of the partner-onboarding family.
    const raf = requestAnimationFrame(() => {
      setDismissed(isDismissed);
      if (!isDismissed) {
        track("partner_welcome_seen");
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Once we know the modal is going to render (post-hydration AND
  // not dismissed), park focus on the primary CTA so keyboard users
  // can press Enter immediately, and SR users hear the dialog title
  // first via aria-labelledby.
  useEffect(() => {
    if (dismissed === false) {
      // Tiny defer so the DOM has actually mounted the button by the
      // time we ask for focus. Same single-rAF defer the other
      // effects use; never cascades.
      const raf = requestAnimationFrame(() => {
        startButtonRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [dismissed]);

  if (dismissed) return null;

  const persistDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Same private-mode story — dismiss state held in component
      // state below is sufficient for this session.
    }
    setDismissed(true);
  };

  const handleStart = () => {
    track("partner_welcome_clicked");
    persistDismiss();
  };

  const handleLater = () => {
    track("partner_welcome_dismissed");
    persistDismiss();
  };

  return (
    // role="dialog" + aria-modal="true" + onKeyDown form is the
    // canonical modal pattern — the linter doesn't accept
    // role=dialog as interactive, but the role itself promotes the
    // div to an interactive element semantically. Same disable
    // recipe as src/components/settings/data-management.tsx.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-welcome-title"
      // Esc dismisses on top of the explicit "あとで" button —
      // matches WCAG "no-keyboard-trap" expectation for modal
      // dialogs. Wrapped on the outer div so SR users hitting Esc
      // anywhere on the modal close it.
      onKeyDown={(e) => {
        if (e.key === "Escape") handleLater();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-[env(safe-area-inset-bottom)] sm:items-center"
    >
      {/* Backdrop — real button so keyboard users can reach the
          dismiss control without tabbing all the way to the
          explicit button below. tabIndex=-1 keeps it out of the
          tab order; SR navigation reaches it via the aria-label. */}
      <button
        type="button"
        aria-label="ようこそモーダルを閉じる"
        onClick={handleLater}
        className="absolute inset-0 bg-black/50"
        tabIndex={-1}
      />

      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-xl"
      >
        {/* Sunny gradient hero — same wash recipe as DecisionCeremony's
            "sunny" stage so the partner arrives in the same brand
            moment the couple lands on at the end of the decision flow.
            Using color-mix anchored to var(--card) keeps the warmth in
            both light and dark themes (round-22 dark-mode parity). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-44"
          style={{
            background:
              "radial-gradient(80% 60% at 50% 30%, color-mix(in oklab, var(--gold-warm) 22%, transparent) 0%, color-mix(in oklab, var(--gold-light) 8%, transparent) 60%, transparent 80%)",
          }}
        />

        {/* Top-right dismiss — duplicate of the あとで CTA but at the
            corner where couples expect a "close" affordance to live.
            36px hit target matches the OnboardingPartnerHint /
            PartnerCanRateHint pattern. */}
        <button
          type="button"
          onClick={handleLater}
          aria-label="ようこそモーダルを閉じる"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.96]"
        >
          <X className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
        </button>

        <div className="relative px-6 pb-6 pt-12 sm:px-8">
          <p className="flex items-center gap-1.5 text-eyebrow text-[var(--gold-warm)]">
            <Sparkles
              className="h-3.5 w-3.5"
              strokeWidth={1.6}
              aria-hidden="true"
            />
            ふたりの式場さがしへ
          </p>

          <h2
            id="partner-welcome-title"
            className="mt-3 font-[family-name:var(--font-display)] text-h2 font-light leading-[1.4] tracking-[-0.005em] text-foreground"
          >
            {ownerName}さんに招かれて、
            <br />
            ふたりの式場さがしへ。
          </h2>

          <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
            おふたりが同じ画面で、 同じ式場を、 別々の視点から見つめられる場所です。
          </p>

          {/* 機能ハイライト 3 行 — bullet list, intentional 2-tone
              (gold dot + body text). Reads in 2 seconds at the size
              this surface is shown at on mobile. */}
          <ul className="mt-5 space-y-2.5 text-[14px] leading-relaxed text-foreground/85">
            {[
              "すでに追加された候補式場が、 そのまま見られます",
              "評価や見学メモを、 おふたりで残せます",
              "比較ボードで「ここがいい」 が伝わります",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold-warm)]"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <button
              ref={startButtonRef}
              type="button"
              onClick={handleStart}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--gold-warm)] px-6 text-sm font-medium text-white shadow-[0_2px_8px_rgba(196,129,110,0.25)] transition-all duration-200 hover:bg-[var(--gold-warm)]/90 active:scale-[0.98] sm:w-auto sm:flex-1"
            >
              はじめる
            </button>
            <button
              type="button"
              onClick={handleLater}
              className="inline-flex min-h-11 items-center justify-center px-6 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground active:scale-[0.98]"
            >
              あとで
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
