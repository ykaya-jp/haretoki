import { describe, it, expect } from "vitest";
import { getHomeStage } from "@/components/home/home-stage";

/**
 * Lexicon §5.4 contract — pins the Hero NBA copy + CTA routing for each
 * progress stage. The audit's decision was that these are **fixed
 * couple-facing lines** (not creative per-deploy rewrites), so drift
 * should surface as a test failure and force a conscious edit.
 *
 * Branching (in resolution order):
 *   1. hasDecision            → "ここから、当日の準備へ"
 *   2. favoriteCount === 2    → "2 件で迷ったら、情景で決める" / duel
 *   3. favoriteCount >= 3     → "ふたりで並べて、見比べてみましょう" / compare
 *   4. visitedVenues >= 1     → "見学の印象を、忘れないうちに残しましょう"
 *   5. totalVenues >= 1       → "最初の見学を入れてみませんか"
 *   6. otherwise (0 venues)   → "まず 1 件、気になる式場を"
 */

const EMPTY = {
  totalVenues: 0,
  visitedVenues: 0,
  favoriteCount: 0,
  hasDecision: false,
};

describe("getHomeStage — Lexicon §5.4 pinning", () => {
  it("zero-venues state starts with the URL add prompt", () => {
    const r = getHomeStage(EMPTY);
    expect(r.key).toBe("start");
    expect(r.headline).toBe("まず 1 件、気になる式場を");
    expect(r.ctaLabel).toBe("URL から追加");
    expect(r.ctaHref).toBe("/explore?addVenue=1");
  });

  it("one-venue (no visit) prompts the first 見学", () => {
    const r = getHomeStage({ ...EMPTY, totalVenues: 1, firstVenueId: "v1" });
    expect(r.key).toBe("adding");
    expect(r.headline).toBe("最初の見学を入れてみませんか");
    expect(r.ctaLabel).toBe("見学を入れる");
    expect(r.ctaHref).toBe("/venues/v1#visit");
  });

  it("post-visit prompts the 印象記録", () => {
    const r = getHomeStage({
      ...EMPTY,
      totalVenues: 1,
      visitedVenues: 1,
      firstVenueId: "v1",
    });
    expect(r.key).toBe("visiting");
    expect(r.headline).toBe("見学の印象を、忘れないうちに残しましょう");
    expect(r.ctaLabel).toBe("印象を残す");
  });

  it("exactly 2 favorites with both ids → duel route with a/b params", () => {
    const r = getHomeStage({
      ...EMPTY,
      totalVenues: 2,
      favoriteCount: 2,
      favoriteAId: "venue-a",
      favoriteBId: "venue-b",
    });
    expect(r.key).toBe("comparing");
    expect(r.headline).toBe("2 件で迷ったら、情景で決める");
    expect(r.ctaLabel).toBe("情景で決める");
    // duel page requires both a+b — previous /candidates?tab=duel URL
    // was unreachable (no such tab in Tab union). Fix: route directly
    // to /candidates/duel with the pair preselected.
    expect(r.ctaHref).toBe("/candidates/duel?a=venue-a&b=venue-b");
  });

  it("exactly 2 favorites without ids → fall back to compare view", () => {
    const r = getHomeStage({ ...EMPTY, totalVenues: 2, favoriteCount: 2 });
    expect(r.key).toBe("comparing");
    expect(r.ctaHref).toBe("/candidates?view=compare");
  });

  it("3+ favorites → side-by-side compare inside candidates", () => {
    const r = getHomeStage({ ...EMPTY, totalVenues: 5, favoriteCount: 3 });
    expect(r.key).toBe("comparing");
    expect(r.headline).toBe("ふたりで並べて、見比べてみましょう");
    expect(r.ctaLabel).toBe("比べる");
    // Consolidated compare lives inside /candidates now; standalone
    // /compare route is still deep-linkable but no longer the default.
    expect(r.ctaHref).toBe("/candidates?view=compare");
  });

  it("decided stage routes to 当日の準備", () => {
    const r = getHomeStage({ ...EMPTY, hasDecision: true });
    expect(r.key).toBe("decided");
    expect(r.headline).toBe("ここから、当日の準備へ");
    expect(r.ctaLabel).toBe("準備を始める");
  });

  it("hasDecision wins over other signals (even with lots of favorites)", () => {
    const r = getHomeStage({
      totalVenues: 10,
      visitedVenues: 5,
      favoriteCount: 4,
      hasDecision: true,
    });
    expect(r.key).toBe("decided");
  });
});
