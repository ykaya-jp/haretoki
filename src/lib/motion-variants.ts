/** Shared framer-motion variants for Atmospheric Layers v4.1 */

/** Luxury easing — matches cubic-bezier(0.16, 1, 0.3, 1) */
export const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

/** Hero section: 600ms entry (down from 900ms) */
export const heroVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: LUXURY_EASE },
  },
} as const;

/** Secondary section: 400ms, with optional 50ms stagger */
export const secondaryVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: LUXURY_EASE, delay: i * 0.05 },
  }),
} as const;
