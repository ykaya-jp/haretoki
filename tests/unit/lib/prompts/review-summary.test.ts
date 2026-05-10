/**
 * Tests for REVIEW_SUMMARY_PROMPT — guard the input-size invariants
 * that prevent Sonnet from timing out on dense review pages.
 *
 * Background: a 50K-char input cap caused Sonnet (60s upstream timeout)
 * to abort on dense zexy /kuchikomi/ listings, surfacing as
 * "AI 分析を取得できませんでした" while Haiku (extraction) still
 * succeeded. Cap was tightened to 30K to stay inside the budget.
 */

import { describe, it, expect } from "vitest";
import { REVIEW_SUMMARY_PROMPT } from "@/lib/prompts/review-summary";
import { MODEL } from "@/lib/models";

describe("REVIEW_SUMMARY_PROMPT", () => {
  it("uses Sonnet (model contract is stable for the cache key)", () => {
    expect(REVIEW_SUMMARY_PROMPT.model).toBe(MODEL.SONNET);
  });

  describe("buildUserMessage", () => {
    it("includes venue name and review count in the header", () => {
      const msg = REVIEW_SUMMARY_PROMPT.buildUserMessage(
        ["短い口コミ"],
        "テスト式場",
      );
      expect(msg).toContain("「テスト式場」");
      expect(msg).toContain("（1件）");
    });

    it("passes through inputs shorter than the 30K cap unchanged", () => {
      const short = "あ".repeat(1_000);
      const msg = REVIEW_SUMMARY_PROMPT.buildUserMessage([short], "Venue");
      expect(msg).toContain(short);
    });

    it("truncates the joined corpus to 30K characters", () => {
      // Single 50K-char block — should be sliced down to 30K.
      const huge = "あ".repeat(50_000);
      const msg = REVIEW_SUMMARY_PROMPT.buildUserMessage([huge], "Venue");
      // Body after the "分析してください:\n\n" header must be exactly 30K
      // chars — the slice point. Anything more means Sonnet is still
      // getting the old 50K bomb; anything less means the slice is
      // wrong. Assert via the trailing block of repeated chars.
      const tail = msg.slice(-30_000);
      expect(tail).toBe("あ".repeat(30_000));
      // And the message length is bounded — header + 30K body, never more.
      // Header is < 200 chars in practice.
      expect(msg.length).toBeLessThanOrEqual(30_500);
    });

    it("joins multiple reviews with the --- separator before slicing", () => {
      const a = "あ".repeat(100);
      const b = "い".repeat(100);
      const msg = REVIEW_SUMMARY_PROMPT.buildUserMessage([a, b], "Venue");
      expect(msg).toContain(`${a}\n---\n${b}`);
      expect(msg).toContain("（2件）");
    });
  });
});
