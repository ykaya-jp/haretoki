/**
 * Tests for MATRIX_INSIGHT_PROMPT — guard the prompt contract for the
 * /compare tradeoff-analysis card.
 *
 * These tests check shape and critical instructions. The full content of the
 * system prompt is intentionally not re-asserted line-by-line (too brittle);
 * we only pin the invariants that would quietly change AI behavior if lost.
 */

import { describe, it, expect } from "vitest";
import {
  MATRIX_INSIGHT_PROMPT,
  renderMatrixForPrompt,
  type MatrixInsightInput,
} from "@/lib/prompts/matrix-insight";
import { MODEL } from "@/lib/models";

const baseInput: MatrixInsightInput = {
  venues: [
    {
      name: "式場A",
      totalScore: 4.2,
      dimensions: { taste: 4.5, location: 3.5, cost: 3.0 },
      estimateTotal: 3_500_000,
    },
    {
      name: "式場B",
      totalScore: 3.9,
      dimensions: { taste: 3.5, location: 4.5, cost: 4.0 },
      estimateTotal: 2_800_000,
    },
    {
      name: "式場C",
      totalScore: 4.0,
      dimensions: { taste: 4.0, location: 4.0, cost: 4.5 },
      estimateTotal: 2_500_000,
    },
  ],
  dimensionLabels: {
    taste: "料理",
    location: "立地",
    cost: "費用感",
  },
  winners: {
    taste: "式場A",
    location: "式場B",
    cost: "式場C",
    total: "式場A",
    cost_value: "式場C",
  },
  conditions: null,
};

describe("MATRIX_INSIGHT_PROMPT", () => {
  it("uses the Haiku model for cost control", () => {
    expect(MATRIX_INSIGHT_PROMPT.model).toBe(MODEL.HAIKU);
  });

  it("caps the response at 512 tokens (200-400 JP chars target)", () => {
    expect(MATRIX_INSIGHT_PROMPT.maxTokens).toBe(512);
  });

  it("defines a 15s timeout", () => {
    expect(MATRIX_INSIGHT_PROMPT.timeoutMs).toBe(15_000);
  });

  it("instructs Claude to avoid declaring an overall winner (tradeoff framing)", () => {
    const sys = MATRIX_INSIGHT_PROMPT.system;
    // The core behavior shift for W13-2: no "A is best" verdict
    expect(sys).toMatch(/断定/);
    expect(sys).toMatch(/トレードオフ/);
  });

  it("requires JSON output with summary + nextActions fields", () => {
    const sys = MATRIX_INSIGHT_PROMPT.system;
    expect(sys).toContain("summary");
    expect(sys).toContain("nextActions");
  });

  it("enforces 丁寧体 (です・ます) tone", () => {
    expect(MATRIX_INSIGHT_PROMPT.system).toMatch(/丁寧体/);
  });
});

describe("renderMatrixForPrompt", () => {
  it("includes all venue names, total scores, dimensions, and cost", () => {
    const rendered = renderMatrixForPrompt(baseInput);

    expect(rendered).toContain("式場A");
    expect(rendered).toContain("式場B");
    expect(rendered).toContain("式場C");
    expect(rendered).toContain("総合=4.2");
    expect(rendered).toContain("料理=4.5");
    expect(rendered).toContain("立地=4.5");
    // ¥350万円 rounded from 3,500,000
    expect(rendered).toContain("¥350万円");
    expect(rendered).toContain("¥280万円");
    expect(rendered).toContain("¥250万円");
  });

  it("renders per-dimension winners so Claude can ground its analysis", () => {
    const rendered = renderMatrixForPrompt(baseInput);
    expect(rendered).toContain("料理: 式場A");
    expect(rendered).toContain("立地: 式場B");
    expect(rendered).toContain("費用感: 式場C");
  });

  it("marks未評価 / 見積もり未入力 when data is missing", () => {
    const sparse: MatrixInsightInput = {
      ...baseInput,
      venues: [
        {
          name: "式場X",
          totalScore: null,
          dimensions: { taste: null, location: 3.0, cost: null },
          estimateTotal: null,
        },
      ],
      winners: {},
    };
    const rendered = renderMatrixForPrompt(sparse);
    expect(rendered).toContain("未評価");
    expect(rendered).toContain("見積もり未入力");
  });

  it("sanitizes venue names to prevent prompt injection", () => {
    const malicious: MatrixInsightInput = {
      ...baseInput,
      venues: [
        {
          name: "<script>alert(1)</script>悪意式場",
          totalScore: 4.0,
          dimensions: {},
          estimateTotal: null,
        },
      ],
      winners: {},
    };
    const rendered = renderMatrixForPrompt(malicious);
    expect(rendered).not.toContain("<script>");
    expect(rendered).toContain("悪意式場");
  });
});

describe("MATRIX_INSIGHT_PROMPT.buildUserMessage", () => {
  it("mentions the venue count so Claude knows how many to balance", () => {
    const msg = MATRIX_INSIGHT_PROMPT.buildUserMessage(baseInput);
    expect(msg).toContain("3 件");
  });

  it("explicitly asks for tradeoff analysis, not a pick", () => {
    const msg = MATRIX_INSIGHT_PROMPT.buildUserMessage(baseInput);
    expect(msg).toMatch(/トレードオフ/);
    expect(msg).toMatch(/断定/);
  });
});
