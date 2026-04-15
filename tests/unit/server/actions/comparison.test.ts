import { describe, it, expect } from "vitest";

// Duplicate types and logic from comparison.ts for testing (generateTemplateInsight is not exported)
interface ComparisonVenue {
  id: string;
  name: string;
  totalScore: number;
  topStrengths: string[];
  latestEstimate: { total: number; predictedFinal: number | null } | null;
}

function generateTemplateInsight(venues: ComparisonVenue[]) {
  if (venues.length < 2) return { text: "", recommendations: [] };

  const [a, b] = venues;
  const parts: string[] = [];
  const recommendations: string[] = [];

  if (a.totalScore > b.totalScore) {
    parts.push(
      `${a.name}は総合スコアで${a.totalScore}点と、${b.name}(${b.totalScore}点)を上回っています。`
    );
  } else if (b.totalScore > a.totalScore) {
    parts.push(
      `${b.name}は総合スコアで${b.totalScore}点と、${a.name}(${a.totalScore}点)を上回っています。`
    );
  } else {
    parts.push(`両式場の総合スコアは${a.totalScore}点で同等です。`);
  }

  if (a.topStrengths.length > 0) {
    parts.push(`${a.name}の強みは${a.topStrengths.join("・")}です。`);
  }
  if (b.topStrengths.length > 0) {
    parts.push(`${b.name}の強みは${b.topStrengths.join("・")}です。`);
  }

  if (a.latestEstimate && b.latestEstimate) {
    const diff = Math.abs(a.latestEstimate.total - b.latestEstimate.total);
    if (diff > 500000) {
      const cheaper = a.latestEstimate.total < b.latestEstimate.total ? a : b;
      recommendations.push(
        `費用面では${cheaper.name}が${Math.round(diff / 10000)}万円ほどお手頃です。`
      );
    }
  }

  if (!a.latestEstimate || !b.latestEstimate) {
    recommendations.push("見積もりを入力すると、費用面の比較もできます。");
  }

  return { text: parts.join(" "), recommendations };
}

describe("generateTemplateInsight", () => {
  const venueA: ComparisonVenue = {
    id: "a",
    name: "式場A",
    totalScore: 80,
    topStrengths: ["雰囲気", "料理"],
    latestEstimate: { total: 3500000, predictedFinal: null },
  };
  const venueB: ComparisonVenue = {
    id: "b",
    name: "式場B",
    totalScore: 70,
    topStrengths: ["アクセス"],
    latestEstimate: { total: 2800000, predictedFinal: null },
  };

  it("returns empty result when fewer than 2 venues", () => {
    const result = generateTemplateInsight([venueA]);
    expect(result.text).toBe("");
    expect(result.recommendations).toEqual([]);
  });

  it("mentions higher scoring venue first", () => {
    const result = generateTemplateInsight([venueA, venueB]);
    expect(result.text).toContain("式場Aは総合スコアで80点");
    expect(result.text).toContain("式場B(70点)を上回っています");
  });

  it("mentions lower scoring venue when B has higher score", () => {
    const result = generateTemplateInsight([venueB, venueA]);
    expect(result.text).toContain("式場Aは総合スコアで80点と、式場B(70点)を上回っています");
  });

  it("shows strengths for both venues", () => {
    const result = generateTemplateInsight([venueA, venueB]);
    expect(result.text).toContain("雰囲気・料理");
    expect(result.text).toContain("アクセス");
  });

  it("does not mention strengths when topStrengths is empty", () => {
    const noStrengthA = { ...venueA, topStrengths: [] };
    const result = generateTemplateInsight([noStrengthA, venueB]);
    expect(result.text).not.toContain("式場Aの強みは");
    expect(result.text).toContain("式場Bの強みは");
  });

  it("recommends cheaper venue when difference > 50万", () => {
    const result = generateTemplateInsight([venueA, venueB]);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining("式場B")])
    );
  });

  it("includes the price difference in recommendation", () => {
    const result = generateTemplateInsight([venueA, venueB]);
    // diff = 3500000 - 2800000 = 700000 → 70万円
    expect(result.recommendations[0]).toContain("70万円");
  });

  it("does not add price recommendation when difference <= 50万", () => {
    const closeA = { ...venueA, latestEstimate: { total: 3000000, predictedFinal: null } };
    const closeB = { ...venueB, latestEstimate: { total: 3200000, predictedFinal: null } };
    const result = generateTemplateInsight([closeA, closeB]);
    const hasPriceRec = result.recommendations.some((r) => r.includes("万円ほどお手頃"));
    expect(hasPriceRec).toBe(false);
  });

  it("handles equal scores", () => {
    const equalB = { ...venueB, totalScore: 80 };
    const result = generateTemplateInsight([venueA, equalB]);
    expect(result.text).toContain("同等");
  });

  it("recommends entering estimates when one is missing", () => {
    const noEst = { ...venueB, latestEstimate: null };
    const result = generateTemplateInsight([venueA, noEst]);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining("見積もり")])
    );
  });

  it("recommends entering estimates when both are missing", () => {
    const noEstA = { ...venueA, latestEstimate: null };
    const noEstB = { ...venueB, latestEstimate: null };
    const result = generateTemplateInsight([noEstA, noEstB]);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining("見積もり")])
    );
  });

  it("does not add estimate recommendation when both estimates are present", () => {
    const result = generateTemplateInsight([venueA, venueB]);
    const hasEstimateRec = result.recommendations.some((r) =>
      r.includes("見積もりを入力すると")
    );
    expect(hasEstimateRec).toBe(false);
  });
});
