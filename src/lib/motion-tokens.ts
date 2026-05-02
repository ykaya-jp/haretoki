/**
 * Brand motion tokens — single source of truth for framer-motion
 * easing / duration / variant patterns used across editorial surfaces
 * (Hero, DecisionCeremony, Onboarding, Welcome modal, Landing).
 *
 * Why a token file instead of inline literals everywhere:
 *   - One ease curve gets applied across the app: every "the moment
 *     should feel slow" surface lands on the same `[0.16, 1, 0.3, 1]`
 *     cubic. A retune (rare) flips one number, not 20.
 *   - One reduced-motion contract: `EASE_OUT_SOFT` + the
 *     `respectReducedMotion()` helper let any consumer bypass motion
 *     consistently without each surface re-implementing the
 *     `useReducedMotion()` -> `duration: 0` ladder.
 *   - Variant compositions: `fadeUpStaggered` is the same recipe the
 *     Hero / Landing / Onboarding-flow already use; centralising it
 *     means the next editorial surface gets it for free.
 *
 * Migration note: existing callsites (decision-ceremony /
 * onboarding-hero / partner-welcome-modal / landing-page) inline
 * literally the same numbers. They are NOT refactored on this branch —
 * the tokens here are additive, future-only, so worker-A / worker-B
 * concurrent edits to those surfaces don't conflict on a tokenisation
 * pass. A dedicated cleanup round can replace the inline literals
 * with `import { ... } from "@/lib/motion-tokens"`.
 */

/**
 * Standard cubic-bezier curve used for editorial surfaces. Reads as
 * "settle in slowly" — the long tail at the end is what makes a
 * Hero / DecisionCeremony moment feel like an exhale rather than a
 * snap.
 *
 * Identical to the literal `[0.16, 1, 0.3, 1]` already used in
 * decision-ceremony.tsx, onboarding-hero.tsx, landing-page.tsx, and
 * the Onboarding-flow zone wash. The literal is preserved here as a
 * `readonly tuple` so framer-motion accepts the value without a
 * type assertion at the callsite.
 */
export const EASE_OUT_SOFT = [0.16, 1, 0.3, 1] as const;

/**
 * Standard durations (seconds). Pick by intent, not number — the
 * names encode the editorial role so the next reader doesn't have
 * to remember "is 0.4s a fade or a slide".
 *
 *   - `enter`: a single element entering view (hero h1, modal card)
 *   - `enterEditorial`: a slow editorial moment (DecisionCeremony,
 *     Onboarding hero — readable as "the page is settling")
 *   - `enterDramatic`: hero copy in a long-page LP fade
 *   - `quickShift`: bottom-nav indicator slide, hover translate;
 *     should feel almost-immediate but not zero
 *   - `washCrossfade`: the 1-second opacity fade between gradient
 *     wash layers (see decision-ceremony, onboarding-flow)
 */
export const DURATION = {
  quickShift: 0.2,
  enter: 0.4,
  enterEditorial: 0.6,
  enterDramatic: 0.9,
  washCrossfade: 1.0,
} as const;

/**
 * Spring presets. framer-motion springs ignore `duration` so we
 * pin the feel via stiffness + damping. Pick `gentle` for "card
 * lifts into place" moments, `pop` for the gold-check pulse on
 * step advance.
 */
export const SPRING = {
  gentle: { type: "spring", stiffness: 220, damping: 22 } as const,
  pop: { type: "spring", stiffness: 360, damping: 18 } as const,
} as const;

/**
 * `fadeUp` variants (custom-indexed staggered children). The custom
 * index `i` lets each child's delay scale: `transition: { delay: i *
 * STAGGER }` so a Hero h1 → lead → benefits panel → CTA reads as
 * an unfolding sequence, not a simultaneous reveal.
 *
 * Already inlined in landing-page.tsx + onboarding-flow.tsx as
 * `fadeUp` / `staggerIn`. Centralised here so future editorial
 * surfaces opt in with one import instead of re-deriving the
 * variants.
 */
export const STAGGER = {
  /** Long stagger — landing-page hero, where each beat is an
   *  editorial paragraph. */
  editorial: 0.18,
  /** Fast stagger — feature grid, recommendations card list. */
  brisk: 0.06,
} as const;

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * STAGGER.editorial,
      duration: DURATION.enterEditorial,
      ease: EASE_OUT_SOFT,
    },
  }),
};

/**
 * Subtle fade for surfaces that should appear without the upward
 * slide (modal hero, secondary copy). y-axis movement on a modal
 * looks unmoored if the modal is itself anchored mid-screen.
 */
export const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: DURATION.enter,
      ease: EASE_OUT_SOFT,
    },
  },
};

/**
 * Reduced-motion adapter. Pass any duration / transition object
 * through this and the function collapses it to a 0-duration
 * variant when the user prefers reduced motion.
 *
 * Use:
 *   const prefersReduced = useReducedMotion();
 *   <motion.div transition={respectReducedMotion(prefersReduced, {
 *     duration: DURATION.enterEditorial,
 *     ease: EASE_OUT_SOFT,
 *   })} />
 *
 * The function is intentionally NOT a hook — it just folds a
 * boolean into the transition. Hooks that already have access to
 * `useReducedMotion()` pass the value in.
 */
export function respectReducedMotion<
  T extends { duration?: number; delay?: number },
>(prefersReduced: boolean | null, transition: T): T {
  if (!prefersReduced) return transition;
  return {
    ...transition,
    duration: 0,
    delay: 0,
  };
}
