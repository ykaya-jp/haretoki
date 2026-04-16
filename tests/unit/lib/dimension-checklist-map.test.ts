import { describe, it, expect } from "vitest";
import { getChecklistItemsForDimension, getDimensionForPreset, ITEM_TO_DIMENSION } from "@/lib/dimension-checklist-map";
import { TIER1_DIMENSIONS } from "@/lib/constants";
import { CHECKLIST_PRESETS } from "@/lib/checklist-presets";

describe("ITEM_TO_DIMENSION (MECE item-level mapping)", () => {
  it("every CHECKLIST_PRESETS item is mapped to exactly one dimension", () => {
    for (const preset of CHECKLIST_PRESETS) {
      const dim = ITEM_TO_DIMENSION[preset.id];
      expect(dim, `${preset.id} is not mapped to any dimension`).toBeDefined();
      expect(TIER1_DIMENSIONS as readonly string[]).toContain(dim);
    }
  });

  it("no item is mapped to two dimensions (mutual exclusivity)", () => {
    const seen = new Map<string, string>();
    for (const [itemId, dim] of Object.entries(ITEM_TO_DIMENSION)) {
      expect(seen.has(itemId), `${itemId} appears twice`).toBe(false);
      seen.set(itemId, dim);
    }
  });

  it("mapped item count equals CHECKLIST_PRESETS count (collective exhaustiveness)", () => {
    const presetIds = new Set(CHECKLIST_PRESETS.map((p) => p.id));
    const mappedIds = new Set(Object.keys(ITEM_TO_DIMENSION));
    const unmapped = [...presetIds].filter((id) => !mappedIds.has(id));
    expect(unmapped, `Unmapped items: ${unmapped.join(", ")}`).toEqual([]);
  });
});

describe("getChecklistItemsForDimension", () => {
  it("overall returns empty (no checklist items)", () => {
    expect(getChecklistItemsForDimension("overall")).toEqual([]);
  });

  it("ceremony_space contains chapel items but NOT chapel.guest.capacity", () => {
    const items = getChecklistItemsForDimension("ceremony_space");
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.id === "chapel.interior.decor-style")).toBe(true);
    expect(items.some((i) => i.id === "chapel.guest.capacity")).toBe(false);
  });

  it("logistics contains capacity items and date availability", () => {
    const items = getChecklistItemsForDimension("logistics");
    expect(items.some((i) => i.id === "chapel.guest.capacity")).toBe(true);
    expect(items.some((i) => i.id === "banquet.layout.capacity")).toBe(true);
    expect(items.some((i) => i.id === "staff_estimate.estimate.availability")).toBe(true);
  });

  it("hospitality contains service-staff (moved from cuisine)", () => {
    const items = getChecklistItemsForDimension("hospitality");
    expect(items.some((i) => i.id === "cuisine_drink.cuisine.service-staff")).toBe(true);
  });

  it("attire_items contains all dress_item presets", () => {
    const items = getChecklistItemsForDimension("attire_items");
    const dressPresets = CHECKLIST_PRESETS.filter((p) => p.category === "dress_item");
    expect(items.length).toBe(dressPresets.length);
  });

  it("cost_contract does NOT contain date availability", () => {
    const items = getChecklistItemsForDimension("cost_contract");
    expect(items.some((i) => i.id === "staff_estimate.estimate.availability")).toBe(false);
  });

  it("cuisine does NOT contain service-staff", () => {
    const items = getChecklistItemsForDimension("cuisine");
    expect(items.some((i) => i.id === "cuisine_drink.cuisine.service-staff")).toBe(false);
  });
});

describe("getDimensionForPreset", () => {
  it("returns correct dimension for moved items", () => {
    expect(getDimensionForPreset("chapel.guest.capacity")).toBe("logistics");
    expect(getDimensionForPreset("cuisine_drink.cuisine.service-staff")).toBe("hospitality");
    expect(getDimensionForPreset("staff_estimate.estimate.availability")).toBe("logistics");
  });

  it("returns correct dimension for attire items", () => {
    expect(getDimensionForPreset("dress_item.dress.variety")).toBe("attire_items");
  });

  it("returns overall for unknown items", () => {
    expect(getDimensionForPreset("nonexistent.item")).toBe("overall");
  });
});
