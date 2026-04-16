import { describe, it, expect } from "vitest";
import {
  DIMENSION_CHECKLIST_MAP,
  getChecklistItemsForDimension,
  getDimensionForPreset,
} from "../../../src/lib/dimension-checklist-map";
import { TIER1_DIMENSIONS } from "../../../src/lib/constants";
import { CHECKLIST_PRESETS } from "../../../src/lib/checklist-presets";

describe("DIMENSION_CHECKLIST_MAP", () => {
  it("covers all TIER1_DIMENSIONS", () => {
    for (const dim of TIER1_DIMENSIONS) {
      expect(DIMENSION_CHECKLIST_MAP).toHaveProperty(dim);
    }
  });

  it("every mapped preset ID exists in CHECKLIST_PRESETS", () => {
    const allIds = new Set(CHECKLIST_PRESETS.map((item) => item.id));
    for (const [, mapping] of Object.entries(DIMENSION_CHECKLIST_MAP)) {
      for (const id of mapping.presetIds) {
        expect(allIds.has(id), `preset ID not found: ${id}`).toBe(true);
      }
    }
  });

  it("no preset ID is mapped to more than one dimension", () => {
    const seen = new Map<string, string>();
    for (const [dim, mapping] of Object.entries(DIMENSION_CHECKLIST_MAP)) {
      for (const id of mapping.presetIds) {
        if (seen.has(id)) {
          throw new Error(`Preset "${id}" mapped to both "${seen.get(id)}" and "${dim}"`);
        }
        seen.set(id, dim);
      }
    }
  });

  it("dress_item presets are not mapped to any dimension", () => {
    const dressIds = new Set(
      CHECKLIST_PRESETS.filter((item) => item.category === "dress_item").map((item) => item.id),
    );
    for (const [, mapping] of Object.entries(DIMENSION_CHECKLIST_MAP)) {
      for (const id of mapping.presetIds) {
        expect(dressIds.has(id), `dress_item preset "${id}" should not be mapped`).toBe(false);
      }
    }
  });
});

describe("getChecklistItemsForDimension", () => {
  it("reviews returns empty array", () => {
    const items = getChecklistItemsForDimension("reviews");
    expect(items).toEqual([]);
  });

  it("cuisine maps to cuisine_drink items only", () => {
    const items = getChecklistItemsForDimension("cuisine");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.category).toBe("cuisine_drink");
    }
  });

  it("hospitality maps only to staff_estimate items with スタッフ subcategory", () => {
    const items = getChecklistItemsForDimension("hospitality");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.category).toBe("staff_estimate");
      expect(item.subcategory).toBe("スタッフ");
    }
  });

  it("cost maps only to staff_estimate items with 見積り subcategory", () => {
    const items = getChecklistItemsForDimension("cost");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.category).toBe("staff_estimate");
      expect(item.subcategory).toBe("見積り");
    }
  });

  it("atmosphere maps to chapel and banquet items", () => {
    const items = getChecklistItemsForDimension("atmosphere");
    expect(items.length).toBeGreaterThan(0);
    const categories = new Set(items.map((item) => item.category));
    expect(categories.has("chapel")).toBe(true);
    expect(categories.has("banquet")).toBe(true);
  });

  it("access maps to facility items", () => {
    const items = getChecklistItemsForDimension("access");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.category).toBe("facility");
    }
  });

  it("returned items are actual ChecklistPresetItem objects", () => {
    const items = getChecklistItemsForDimension("cuisine");
    for (const item of items) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("question");
      expect(item).toHaveProperty("type");
    }
  });
});

describe("getDimensionForPreset", () => {
  it("returns the correct dimension for a chapel preset", () => {
    expect(getDimensionForPreset("chapel.interior.decor-style")).toBe("atmosphere");
  });

  it("returns the correct dimension for a cuisine_drink preset", () => {
    expect(getDimensionForPreset("cuisine_drink.cuisine.taste")).toBe("cuisine");
  });

  it("returns the correct dimension for a staff スタッフ preset", () => {
    expect(getDimensionForPreset("staff_estimate.staff.planner")).toBe("hospitality");
  });

  it("returns the correct dimension for a staff 見積り preset", () => {
    expect(getDimensionForPreset("staff_estimate.estimate.total-amount")).toBe("cost");
  });

  it("returns the correct dimension for a facility preset", () => {
    expect(getDimensionForPreset("facility.general.no-overlap")).toBe("access");
  });

  it("returns atmosphere as fallback for unmapped presets (dress_item)", () => {
    expect(getDimensionForPreset("dress_item.dress.variety")).toBe("atmosphere");
  });

  it("returns atmosphere as fallback for unknown preset IDs", () => {
    expect(getDimensionForPreset("nonexistent.item.id")).toBe("atmosphere");
  });
});
