import { describe, it, expect } from "vitest";
import {
  CHECKLIST_PRESETS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  getPresetById,
  getPresetsByCategory,
} from "@/lib/checklist-presets";

describe("CHECKLIST_PRESETS", () => {
  it("has at least 80 items", () => {
    expect(CHECKLIST_PRESETS.length).toBeGreaterThanOrEqual(80);
  });

  it("covers all 6 categories", () => {
    const categories = new Set(CHECKLIST_PRESETS.map((p) => p.category));
    expect(categories.size).toBe(6);
    for (const cat of CATEGORY_ORDER) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = CHECKLIST_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all items have valid type", () => {
    const validTypes = new Set(["yesno", "memo", "photo", "number"]);
    for (const item of CHECKLIST_PRESETS) {
      expect(validTypes.has(item.type), `${item.id} has invalid type ${item.type}`).toBe(true);
    }
  });

  it("each category has at least 5 items", () => {
    for (const cat of CATEGORY_ORDER) {
      const items = getPresetsByCategory(cat);
      expect(items.length, `${cat} has fewer than 5 items`).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("getPresetById", () => {
  it("returns the correct item", () => {
    const item = getPresetById("chapel.interior.decor-style");
    expect(item).toBeDefined();
    expect(item?.category).toBe("chapel");
  });

  it("returns undefined for unknown id", () => {
    expect(getPresetById("nonexistent.id")).toBeUndefined();
  });
});

describe("CATEGORY_LABELS", () => {
  it("has labels for all categories", () => {
    for (const cat of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});
