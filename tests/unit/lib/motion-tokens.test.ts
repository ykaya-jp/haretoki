import { describe, it, expect } from "vitest";
import {
  EASE_OUT_SOFT,
  DURATION,
  SPRING,
  STAGGER,
  fadeUpVariants,
  fadeInVariants,
  respectReducedMotion,
} from "@/lib/motion-tokens";

// Tokens are a published contract — once a Hero / Modal / Landing
// surface depends on a name, renaming or re-shaping silently
// breaks every consumer. These tests pin the contract so a
// future "tweak the easing" PR has to consciously update the
// expectation here too.
describe("motion-tokens", () => {
  it("EASE_OUT_SOFT matches the brand cubic-bezier literal", () => {
    expect(EASE_OUT_SOFT).toEqual([0.16, 1, 0.3, 1]);
  });

  it("DURATION names cover the editorial vocabulary", () => {
    expect(DURATION.quickShift).toBe(0.2);
    expect(DURATION.enter).toBe(0.4);
    expect(DURATION.enterEditorial).toBe(0.6);
    expect(DURATION.enterDramatic).toBe(0.9);
    expect(DURATION.washCrossfade).toBe(1.0);
  });

  it("SPRING presets have type + stiffness + damping", () => {
    expect(SPRING.gentle).toMatchObject({
      type: "spring",
      stiffness: expect.any(Number),
      damping: expect.any(Number),
    });
    expect(SPRING.pop).toMatchObject({
      type: "spring",
      stiffness: expect.any(Number),
      damping: expect.any(Number),
    });
    expect(SPRING.pop.stiffness).toBeGreaterThan(SPRING.gentle.stiffness);
  });

  it("STAGGER editorial delay is longer than brisk", () => {
    expect(STAGGER.editorial).toBeGreaterThan(STAGGER.brisk);
  });

  it("fadeUpVariants hidden / visible shape", () => {
    expect(fadeUpVariants.hidden).toEqual({ opacity: 0, y: 24 });
    const v = fadeUpVariants.visible(0);
    expect(v).toMatchObject({ opacity: 1, y: 0 });
    expect(v.transition.duration).toBe(DURATION.enterEditorial);
    expect(v.transition.ease).toEqual(EASE_OUT_SOFT);
  });

  it("fadeUpVariants delay scales with index via STAGGER.editorial", () => {
    const at0 = fadeUpVariants.visible(0).transition.delay;
    const at1 = fadeUpVariants.visible(1).transition.delay;
    const at2 = fadeUpVariants.visible(2).transition.delay;
    expect(at0).toBe(0);
    expect(at1).toBeCloseTo(STAGGER.editorial, 5);
    expect(at2).toBeCloseTo(STAGGER.editorial * 2, 5);
  });

  it("fadeInVariants is opacity-only (no translate)", () => {
    expect(fadeInVariants.hidden).toEqual({ opacity: 0 });
    expect(fadeInVariants.visible).toMatchObject({ opacity: 1 });
  });

  describe("respectReducedMotion", () => {
    it("returns the transition unchanged when not reduced", () => {
      const t = { duration: 0.6, delay: 0.2, ease: EASE_OUT_SOFT };
      expect(respectReducedMotion(false, t)).toBe(t);
      expect(respectReducedMotion(null, t)).toBe(t);
    });

    it("collapses duration + delay to 0 when reduced-motion is preferred", () => {
      const t = { duration: 0.9, delay: 0.4 };
      const out = respectReducedMotion(true, t);
      expect(out.duration).toBe(0);
      expect(out.delay).toBe(0);
    });

    it("preserves non-duration fields when reducing", () => {
      const t = {
        duration: 0.6,
        delay: 0.2,
        ease: EASE_OUT_SOFT,
      } as const;
      const out = respectReducedMotion(true, t);
      expect(out.ease).toEqual(EASE_OUT_SOFT);
    });
  });
});
