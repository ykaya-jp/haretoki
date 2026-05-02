"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateDisplayName } from "@/server/actions/profile";
import { track } from "@/lib/analytics";

/**
 * Onboarding Hero gateway — the very first screen a brand-new user sees
 * after auth + project creation, before the 4-question coach flow.
 *
 * Design references (Track A-3):
 *   - master plan /tmp/haretoki-design-master-plan-2026-05-02.md "A-3"
 *   - Figma node 1:2 (https://www.figma.com/design/hob3A7HwgQDUtnUlO2gtOh?node-id=1-2)
 *     — Figma MCP rate-limited on the Starter plan, so this implementation
 *       follows the master plan's text spec + the A-0 Refero research
 *       findings (/tmp/haretoki-onboarding-refero-2026-05-02.md):
 *         - Headspace narrative welcome → first session pattern
 *         - Zola couple-first framing
 *         - Soft secondary CTA ("Get Started" + "Learn more" pattern)
 *
 * Replaces the prior step === -1 "preview list + display name" screen.
 * The 3-line preview list collapses into the single subtitle (avoiding
 * meaning duplication with the coach welcome line of Step 1) but the
 * optional display name input is preserved — losing it was a regression
 * the coach later compensates with "(未設定)" fallbacks across home /
 * coach / journey copy.
 *
 * Motion: cloudy → break gradient sky behind a serif headline. The DOM
 * mounts with opacity 0 / translateY 12px and animates in over 600ms
 * with the brand's standard easing (cubic-bezier(0.16, 1, 0.3, 1)) —
 * matching DecisionCeremony / Step 1 transitions for visual continuity.
 *
 * Analytics:
 *   - `onboarding_hero_seen` fires once on mount (idempotent via
 *     useEffect deps) so the funnel can measure hero exposure separately
 *     from the CTA tap.
 *   - `onboarding_entry_clicked` fires on the primary CTA tap with a
 *     `{ from: "onboarding_hero", variant }` payload — same event name
 *     emitted on the home start-stage CTA so a single PostHog funnel
 *     can compare conversion across the two entry points.
 *   - `onboarding_started` (legacy) is preserved so existing dashboards
 *     keep working; new dashboards should listen on
 *     `onboarding_entry_clicked` going forward.
 *   - The "あとで" secondary CTA is routed to /home and tracked via
 *     `onboarding_hero_deferred`.
 */

/**
 * Onboarding hero copy variants (Phase 3 prep — Phase 4 will wire
 * server-decided experiment buckets).
 *
 * `control` keeps the production hero. `warm` softens the headline
 * into a couple-first invitation. The serif headline is the only
 * surface that forks (button label / subtitle / display-name help-text
 * stay shared) — every variant should still read as "Haretoki" so the
 * A/B is genuinely about voice, not surface area.
 */
export type OnboardingHeroVariant = "control" | "warm";

const ONBOARDING_HERO_COPY: Record<
  OnboardingHeroVariant,
  {
    headlineLine1: string;
    headlineLine2: string;
    subtitleLine1: string;
    subtitleLine2: string;
  }
> = {
  control: {
    headlineLine1: "ふたりの晴れの日を、",
    headlineLine2: "ここから",
    subtitleLine1: "コーチが 4 つの質問で",
    subtitleLine2: "おふたりの好みを聞きます",
  },
  warm: {
    headlineLine1: "おふたりらしい一日を、",
    headlineLine2: "ここで描きはじめる",
    subtitleLine1: "4 つのやさしい質問から、",
    subtitleLine2: "ふたりに合う場所が見えてきます",
  },
};

export interface OnboardingHeroProps {
  onStart: () => void;
  /** Server-decided copy variant. Defaults to `control` so callers
   *  who haven't opted into the prep continue to render exactly the
   *  production copy. */
  variant?: OnboardingHeroVariant;
}

export function OnboardingHero({
  onStart,
  variant = "control",
}: OnboardingHeroProps) {
  const copy = ONBOARDING_HERO_COPY[variant] ?? ONBOARDING_HERO_COPY.control;
  const [displayName, setDisplayName] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  // Fire once on mount — useEffect deps [] guarantees a single emit
  // even if the parent re-renders. Funnel analysis treats this as the
  // "user reached the gateway" event. The `variant` is included so
  // the funnel can split impressions per copy bucket too.
  useEffect(() => {
    track("onboarding_hero_seen", { variant });
    // variant is captured intentionally on first mount only — re-firing
    // on a variant change would double-count the same session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = async () => {
    if (isStarting) return;
    setIsStarting(true);
    // Unified entry event — same name as the home start-stage CTA so
    // PostHog can build a single conversion funnel keyed on
    // `onboarding_entry_clicked` regardless of which surface the
    // couple started from.
    track("onboarding_entry_clicked", {
      from: "onboarding_hero",
      variant,
    });
    // Legacy event — kept in place so existing dashboards don't break
    // until the migration round flips them to the unified event.
    track("onboarding_started");
    const trimmed = displayName.trim();
    if (trimmed) {
      // Best-effort: don't block the flow if the write fails — the user
      // can change the name from /mypage later. Same behaviour the
      // pre-A-3 step === -1 screen had.
      updateDisplayName(trimmed).catch(() => {});
    }
    onStart();
  };

  const handleDeferred = () => {
    track("onboarding_hero_deferred", { variant });
    // /home navigation is handled by the <Link>; this just emits the
    // event. The middleware honors the onboarding_completed cookie
    // separately, so leaving without completing means the user will
    // see the hero again on the next /onboarding visit (intended).
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative isolate mx-auto flex min-h-[80vh] max-w-sm flex-col items-center justify-center gap-10 px-4 py-10 text-center"
    >
      {/* Sky gradient backdrop — cloudy at the top blending into a
          break-of-dawn warmth at the bottom. Sits behind the hero
          content via -z-10 + the parent's `isolate` so it doesn't
          bleed into surrounding layout.
          Recipe matches DecisionCeremony's washByStage (color-mix on
          muted-foreground / gold-warm / primary tokens) — see
          src/components/decision/decision-ceremony.tsx — so the
          brand's "曇り → 晴れ間 → 晴れ" metaphor stays continuous from
          first contact to decision day. We use color-mix instead of
          dedicated --bg-* tokens so we never accidentally drop the
          gradient if a token rename happens. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--muted-foreground) 8%, transparent) 0%, color-mix(in oklab, var(--gold-warm) 14%, transparent) 70%, color-mix(in oklab, var(--primary) 4%, transparent) 100%)",
        }}
      />

      <div className="space-y-4" data-onboarding-variant={variant}>
        <p className="text-eyebrow font-medium text-[var(--gold-warm)]">
          Haretoki
        </p>
        {/* A-6: --text-fluid-3xl is clamp(28→48px), which subsumes the
            previous static 28 + sm:text-3xl pair into a single token
            that scales fluidly. Shippori is kept (≥24px so the display
            serif is allowed by the typography invariant). */}
        <h1 className="font-[family-name:var(--font-display)] text-fluid-3xl font-light leading-snug tracking-[-0.005em] text-foreground">
          {copy.headlineLine1}
          <br />
          {copy.headlineLine2}
        </h1>
        <p className="text-sm font-light leading-relaxed text-foreground/75">
          {copy.subtitleLine1}
          <br />
          {copy.subtitleLine2}
        </p>
      </div>

      <div className="w-full space-y-2 text-left">
        <label
          htmlFor="onboarding-hero-name"
          className="text-eyebrow text-muted-foreground"
        >
          お名前 (任意)
        </label>
        <Input
          id="onboarding-hero-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="例: ゆうすけ"
          maxLength={50}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">
          ホームや見学メモで呼びかけに使います。あとで変更できます。
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <Button
          onClick={handleStart}
          disabled={isStarting}
          className="h-11 min-h-11 w-full rounded-full"
        >
          はじめる
        </Button>
        <Link
          href="/home"
          prefetch={true}
          onClick={handleDeferred}
          className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          あとで
        </Link>
      </div>
    </motion.div>
  );
}
