/**
 * Unit tests for summarizePreferenceVector — pure synchronous formatter.
 *
 * Focus areas:
 *   1. Cold short-circuit: cold:true → null (caller branches to "好みデータ
 *      収集中" copy).
 *   2. Empty content even if cold:false → null (no parts to render).
 *   3. Bullet points rendered for each populated field.
 *   4. Cost range divided by 10000 and rounded to 万円 unit.
 */

import { describe, it, expect } from "vitest";
import { summarizePreferenceVector } from "@/lib/preference-vector-format";
import type { PreferenceVector } from "@/server/actions/preference-vector";

const base: PreferenceVector = {
  cold: false,
  topVibes: [],
  topStyles: [],
  topAreas: [],
  capacityRange: null,
  costRange: null,
  signalCount: 0,
};

describe("summarizePreferenceVector", () => {
  it("returns null when cold:true (no behavioral signal yet)", () => {
    expect(
      summarizePreferenceVector({
        ...base,
        cold: true,
        signalCount: 1,
      }),
    ).toBeNull();
  });

  it("returns null when cold:false but every field is empty", () => {
    expect(
      summarizePreferenceVector({
        ...base,
        cold: false,
        signalCount: 2,
      }),
    ).toBeNull();
  });

  it("renders all bullet points when every field is populated", () => {
    const result = summarizePreferenceVector({
      cold: false,
      topVibes: ["natural", "elegant"],
      topStyles: ["chapel"],
      topAreas: ["東京都渋谷区"],
      capacityRange: { min: 60, max: 100 },
      costRange: { min: 3_000_000, max: 4_500_000 },
      signalCount: 5,
    });

    expect(result).not.toBeNull();
    expect(result).toContain("おふたりが今までお気に入り・見学に追加した 5 件");
    expect(result).toContain("雰囲気の好み: natural・elegant");
    expect(result).toContain("挙式スタイルの好み: chapel");
    expect(result).toContain("エリアの好み: 東京都渋谷区");
    expect(result).toContain("収容人数の傾向: 60〜100名");
    // 3_000_000 / 10000 = 300, 4_500_000 / 10000 = 450
    expect(result).toContain("費用感の傾向: 300〜450万円");
  });

  it("renders only 雰囲気の好み when only topVibes is populated", () => {
    const result = summarizePreferenceVector({
      ...base,
      cold: false,
      topVibes: ["natural"],
      signalCount: 2,
    });

    expect(result).not.toBeNull();
    expect(result).toContain("雰囲気の好み: natural");
    expect(result).not.toContain("挙式スタイル");
    expect(result).not.toContain("エリア");
    expect(result).not.toContain("収容人数");
    expect(result).not.toContain("費用感");
  });

  it("formats cost range in 万円 with rounding (10000 で divide)", () => {
    const result = summarizePreferenceVector({
      ...base,
      cold: false,
      // 3_456_789 / 10000 = 345.6789 → 346, 4_999_999 / 10000 = 499.9999 → 500
      costRange: { min: 3_456_789, max: 4_999_999 },
      signalCount: 3,
    });

    expect(result).toContain("費用感の傾向: 346〜500万円");
  });

  it("joins multiple top items with the ・ separator", () => {
    const result = summarizePreferenceVector({
      ...base,
      cold: false,
      topVibes: ["a", "b", "c"],
      signalCount: 4,
    });

    expect(result).toContain("雰囲気の好み: a・b・c");
  });
});
