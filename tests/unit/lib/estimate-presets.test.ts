import { describe, it, expect } from "vitest";
import { ESTIMATE_PRESETS, type EstimateCategory, type EstimateItemTier } from "@/lib/estimate-presets";

const ALL_CATEGORIES: EstimateCategory[] = [
  "attire",
  "cuisine",
  "photo_video",
  "flowers",
  "performance",
  "av_equipment",
  "venue_fee",
  "other",
];

const VALID_TIERS: EstimateItemTier[] = ["minimum", "standard", "premium", "unknown"];

describe("ESTIMATE_PRESETS", () => {
  it("has at least 40 items", () => {
    expect(ESTIMATE_PRESETS.length).toBeGreaterThanOrEqual(40);
  });

  it("covers all EstimateItemCategory values", () => {
    const categories = new Set(ESTIMATE_PRESETS.map((p) => p.category));
    for (const cat of ALL_CATEGORIES) {
      expect(categories.has(cat), `category "${cat}" has no preset`).toBe(true);
    }
  });

  it("has unique item names (no duplicates)", () => {
    const names = ESTIMATE_PRESETS.map((p) => p.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("every entry has required shape { name, category, categoryLabel, defaultTier }", () => {
    for (const preset of ESTIMATE_PRESETS) {
      expect(typeof preset.name, `name missing on ${JSON.stringify(preset)}`).toBe("string");
      expect(preset.name.length, `name empty on entry`).toBeGreaterThan(0);
      expect(ALL_CATEGORIES, `invalid category on ${preset.name}`).toContain(preset.category);
      expect(typeof preset.categoryLabel, `categoryLabel missing on ${preset.name}`).toBe("string");
      expect(VALID_TIERS, `invalid defaultTier on ${preset.name}`).toContain(preset.defaultTier);
    }
  });

  it("each category has at least 3 items", () => {
    for (const cat of ALL_CATEGORIES) {
      const count = ESTIMATE_PRESETS.filter((p) => p.category === cat).length;
      expect(count, `category "${cat}" has only ${count} items`).toBeGreaterThanOrEqual(3);
    }
  });
});
