// Spring and transition presets for framer-motion animations
// See docs/product-design.md Section 6 for rationale

/** Standard spring — buttons, small elements */
export const springStandard = { type: "spring" as const, stiffness: 400, damping: 30 };

/** Premium spring — cards, page transitions */
export const springPremium = { type: "spring" as const, stiffness: 300, damping: 25 };

/** Slow luxury spring — hero sections, celebrations */
export const springLuxury = { type: "spring" as const, stiffness: 200, damping: 20 };

/** Page enter — ease-out-expo */
export const enterTransition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as number[] };

/** Page exit — ease-in, 70% of enter duration */
export const exitTransition = { duration: 0.4, ease: [0.4, 0, 1, 1] as number[] };
