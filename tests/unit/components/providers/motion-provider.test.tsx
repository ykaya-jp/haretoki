import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as framerMotion from "framer-motion";

/**
 * W10-3 regression guard — see commit 8020263 and swipe-card.tsx.
 *
 * framer-motion ships two feature bundles used with `LazyMotion`:
 *   - `domAnimation` — small, excludes drag/pan/layout gesture features
 *   - `domMax`       — larger, includes drag + pan + layout + exit
 *
 * SwipeCompare (`src/components/candidates/swipe-card.tsx`) uses
 * `drag` / `dragConstraints` / `dragElastic` on `motion.div`. Those props
 * are no-ops at runtime unless the LazyMotion provider loads a feature
 * bundle that includes drag, i.e. `domMax`.
 *
 * The W8-2 lazy-loading refactor originally loaded `domAnimation`, which
 * silently broke swipe (no throw, no console error — it just didn't drag).
 * This test fails the build if someone ever switches back.
 *
 * We assert three independent things so the guard cannot be trivially
 * sidestepped:
 *   1. The provider source literally imports `domMax`.
 *   2. `framer-motion` actually exports a `domMax` value.
 *   3. `domAnimation` is NOT referenced in the provider source.
 */
describe("MotionProvider feature bundle", () => {
  const providerPath = path.resolve(
    __dirname,
    "../../../../src/components/providers/motion-provider.tsx",
  );
  const providerSource = readFileSync(providerPath, "utf8");

  it("loads `domMax` (drag-capable) feature bundle", () => {
    // Matches `.then((m) => m.domMax)` or `.then(m => m.domMax)` etc.
    expect(providerSource).toMatch(/\bm\.domMax\b/);
  });

  it("does NOT load `domAnimation` (drag-less) feature bundle", () => {
    expect(providerSource).not.toMatch(/\bm\.domAnimation\b/);
  });

  it("framer-motion still exports the `domMax` symbol", () => {
    // Guards against an upstream rename / breaking change in framer-motion.
    // If this fails, update the provider and this test together.
    expect(framerMotion).toHaveProperty("domMax");
    expect(typeof (framerMotion as { domMax: unknown }).domMax).not.toBe(
      "undefined",
    );
  });

  it("keeps the regression-warning comment in place", () => {
    // The warning comment is the human-readable signal to future editors.
    // Removing it means the next refactor loses the context; keep it pinned.
    expect(providerSource).toMatch(/features must be `domMax`/);
  });
});
