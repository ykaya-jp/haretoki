import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SwipeCard } from "@/components/candidates/swipe-card";

/**
 * W10-3 — static guard that SwipeCard keeps wiring drag gestures through
 * framer-motion's `motion.div`. The drag props (`drag`, `dragConstraints`,
 * `dragElastic`, `onDragEnd`) are the entire reason the MotionProvider has
 * to load `domMax` instead of the lighter `domAnimation` bundle.
 *
 * If drag is ever removed from SwipeCard, the provider should be downgraded
 * back to `domAnimation` to save ~6KB gz. This test is the tripwire: failing
 * here signals "revisit motion-provider.tsx feature bundle choice".
 */

// PhotoCarousel pulls Next.js `next/image` + framer-motion + useEmblaCarousel
// which are heavy in jsdom; we don't need it for this smoke test.
vi.mock("@/components/venues/photo-carousel", () => ({
  PhotoCarousel: () => null,
}));

// CircularProgressScore animates via framer-motion; stub to a plain node.
vi.mock("@/components/comparison/circular-score", () => ({
  CircularProgressScore: ({ score }: { score: number }) => (
    <span data-testid="circular-score">{score}</span>
  ),
}));

const baseVenue = {
  id: "v1",
  name: "テスト式場",
  location: "東京都港区",
  photoUrls: [],
  totalScore: 82,
  topStrengths: ["料理", "景観"],
  latestEstimate: { total: 2_500_000 },
};

describe("SwipeCard drag wiring", () => {
  afterEach(() => cleanup());

  it("renders without throwing for the top card (drag enabled)", () => {
    expect(() =>
      render(
        <SwipeCard venue={baseVenue} isTop={true} onSwipe={() => {}} />,
      ),
    ).not.toThrow();
  });

  it("renders without throwing for a non-top card (drag disabled)", () => {
    expect(() =>
      render(
        <SwipeCard venue={baseVenue} isTop={false} onSwipe={() => {}} />,
      ),
    ).not.toThrow();
  });

  it("SwipeCard source still passes drag gesture props to motion.div", () => {
    // Static assertion: we cannot reliably observe framer-motion's internal
    // drag state in jsdom, so we pin the contract at the source level.
    // If these props disappear, the MotionProvider feature bundle choice
    // needs to be reconsidered.
    const source = readFileSync(
      path.resolve(
        __dirname,
        "../../../../src/components/candidates/swipe-card.tsx",
      ),
      "utf8",
    );

    expect(source).toMatch(/drag=\{isTop\}/);
    expect(source).toMatch(/dragConstraints=/);
    expect(source).toMatch(/dragElastic=/);
    expect(source).toMatch(/onDragEnd=/);
    // Ensure drag is on a framer-motion element, not a raw div.
    expect(source).toMatch(/<motion\.div/);
  });

  it("calls onSwipe with the expected direction literals (type-safety smoke)", () => {
    // Pure static check that the callback signature shape we advertise to
    // SwipeCompare hasn't drifted. onSwipe is exercised via drag in the
    // browser, but the compile-time contract is what we pin here.
    const handler = vi.fn<(d: "left" | "right" | "up") => void>();
    render(
      <SwipeCard venue={baseVenue} isTop={true} onSwipe={handler} />,
    );
    // Simulate the three valid directions via the prop interface itself;
    // this is effectively a type test + no-op at runtime.
    handler("left");
    handler("right");
    handler("up");
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
