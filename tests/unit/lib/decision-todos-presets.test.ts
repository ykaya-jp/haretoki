import { describe, it, expect } from "vitest";
import {
  DECISION_TODO_PRESETS,
  DECISION_TODO_PRESET_COUNT,
  CUSTOM_TODO_LIMIT,
} from "@/lib/decision-todos/presets";

/**
 * 15 件 preset の正当性契約。
 * - 件数固定（減ると UI の 1/15 表示が崩れる、増えると "網羅性 vs 完遂率" の設計判断が壊れる）
 * - templateKey 重複なし（@@unique([projectId, templateKey]) + skipDuplicates の前提）
 * - orderIndex が 0..N-1 の連続（シードの「表示順」仕様）
 * - priority 値が enum に収まる
 */
describe("DECISION_TODO_PRESETS — system 15 件契約", () => {
  it("has exactly 15 entries", () => {
    expect(DECISION_TODO_PRESETS.length).toBe(15);
    expect(DECISION_TODO_PRESET_COUNT).toBe(15);
  });

  it("has unique templateKeys", () => {
    const keys = DECISION_TODO_PRESETS.map((p) => p.templateKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("templateKeys do not collide with the custom: prefix", () => {
    for (const p of DECISION_TODO_PRESETS) {
      expect(p.templateKey.startsWith("custom:")).toBe(false);
    }
  });

  it("orderIndex values are 0..N-1 and contiguous", () => {
    const indices = DECISION_TODO_PRESETS.map((p) => p.orderIndex).sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < indices.length; i++) {
      expect(indices[i]).toBe(i);
    }
  });

  it("priority is one of high/normal/low", () => {
    const allowed = new Set(["high", "normal", "low"]);
    for (const p of DECISION_TODO_PRESETS) {
      expect(allowed.has(p.priority)).toBe(true);
    }
  });

  it("all system presets have non-empty title and description", () => {
    for (const p of DECISION_TODO_PRESETS) {
      expect(p.title.trim().length).toBeGreaterThan(0);
      expect(p.description.trim().length).toBeGreaterThan(0);
      // Design §4.3: description は句点なし
      expect(p.description.endsWith("。")).toBe(false);
    }
  });

  it("dueOffsetDays are reasonable (null or positive integer <= 365)", () => {
    for (const p of DECISION_TODO_PRESETS) {
      if (p.dueOffsetDays === null) continue;
      expect(Number.isInteger(p.dueOffsetDays)).toBe(true);
      expect(p.dueOffsetDays).toBeGreaterThan(0);
      expect(p.dueOffsetDays).toBeLessThanOrEqual(365);
    }
  });

  it("priority ordering: high presets come before normal, normal before low", () => {
    // Design: high → normal → low の順で並べるのが基本
    let lastRank = 0;
    const rank: Record<string, number> = { high: 1, normal: 2, low: 3 };
    const sorted = [...DECISION_TODO_PRESETS].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    for (const p of sorted) {
      const r = rank[p.priority];
      expect(r).toBeGreaterThanOrEqual(lastRank);
      lastRank = r;
    }
  });

  it("CUSTOM_TODO_LIMIT is 10 (design §4.4)", () => {
    expect(CUSTOM_TODO_LIMIT).toBe(10);
  });
});
