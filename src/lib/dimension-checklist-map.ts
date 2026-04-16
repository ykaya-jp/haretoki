/** Maps the 8 score dimensions to checklist preset items (item-level, not category-level) */

import type { Tier1Dimension } from "./constants";
import { type ChecklistPresetItem, CHECKLIST_PRESETS } from "./checklist-presets";

const ITEM_TO_DIMENSION: Record<string, Tier1Dimension> = {
  // ── ceremony_space (挙式会場) ──
  "chapel.interior.decor-style": "ceremony_space",
  "chapel.interior.size": "ceremony_space",
  "chapel.interior.virgin-road": "ceremony_space",
  "chapel.interior.lighting": "ceremony_space",
  "chapel.interior.cross-removable": "ceremony_space",
  "chapel.interior.shinto-style": "ceremony_space",
  "chapel.interior.non-family-attend": "ceremony_space",
  "chapel.guest.spacing": "ceremony_space",
  "chapel.guest.visibility": "ceremony_space",
  "chapel.performance.ceremony-style": "ceremony_space",
  "chapel.performance.music": "ceremony_space",
  "chapel.performance.effects": "ceremony_space",
  "chapel.performance.rain-plan": "ceremony_space",
  "chapel.photo.interior": "ceremony_space",
  "chapel.memo.overall": "ceremony_space",

  // ── banquet_space (披露宴会場) ──
  "banquet.layout.table-capacity": "banquet_space",
  "banquet.layout.main-visibility": "banquet_space",
  "banquet.layout.guest-visibility": "banquet_space",
  "banquet.interior.flowers": "banquet_space",
  "banquet.interior.linens": "banquet_space",
  "banquet.interior.lighting": "banquet_space",
  "banquet.interior.garden": "banquet_space",
  "banquet.performance.space": "banquet_space",
  "banquet.performance.screen": "banquet_space",
  "banquet.performance.sound": "banquet_space",
  "banquet.performance.lighting-variety": "banquet_space",
  "banquet.photo.interior": "banquet_space",
  "banquet.memo.overall": "banquet_space",

  // ── cuisine (料理・飲み物) ──
  "cuisine_drink.cuisine.taste": "cuisine",
  "cuisine_drink.cuisine.ingredients": "cuisine",
  "cuisine_drink.cuisine.age-appropriate": "cuisine",
  "cuisine_drink.cuisine.custom": "cuisine",
  "cuisine_drink.cuisine.special-menu": "cuisine",
  "cuisine_drink.cuisine.performance": "cuisine",
  "cuisine_drink.cuisine.tableware": "cuisine",
  "cuisine_drink.drink.variety": "cuisine",
  "cuisine_drink.drink.cake": "cuisine",
  "cuisine_drink.drink.cake-custom": "cuisine",
  "cuisine_drink.drink.performance": "cuisine",
  "cuisine_drink.photo.food": "cuisine",
  "cuisine_drink.memo.overall": "cuisine",

  // ── attire_items (衣裳・アイテム) ──
  "dress_item.dress.variety": "attire_items",
  "dress_item.dress.accessories": "attire_items",
  "dress_item.dress.bouquet": "attire_items",
  "dress_item.dress.bring-in": "attire_items",
  "dress_item.dress.bring-in-fee": "attire_items",
  "dress_item.dress.groom": "attire_items",
  "dress_item.dress.family-rental": "attire_items",
  "dress_item.dress.family-hairmake": "attire_items",
  "dress_item.dress.hairmake-style": "attire_items",
  "dress_item.dress.plan-limit": "attire_items",
  "dress_item.items.paper": "attire_items",
  "dress_item.items.gifts": "attire_items",
  "dress_item.items.bring-in": "attire_items",
  "dress_item.photo.dress": "attire_items",
  "dress_item.memo.overall": "attire_items",

  // ── hospitality (スタッフ・対応) ──
  "staff_estimate.staff.planner": "hospitality",
  "staff_estimate.staff.attitude": "hospitality",
  "staff_estimate.staff.external-mc": "hospitality",
  "cuisine_drink.cuisine.service-staff": "hospitality", // moved from cuisine
  "staff_estimate.memo.overall": "hospitality",

  // ── cost_contract (費用・契約) ──
  "staff_estimate.estimate.included": "cost_contract",
  "staff_estimate.estimate.payment-timing": "cost_contract",
  "staff_estimate.estimate.payment-method": "cost_contract",
  "staff_estimate.estimate.campaigns": "cost_contract",
  "staff_estimate.estimate.cancellation": "cost_contract",
  "staff_estimate.estimate.total-amount": "cost_contract",
  "staff_estimate.photo.document": "cost_contract",

  // ── logistics (利便性・設備) ──
  "chapel.guest.capacity": "logistics", // moved from ceremony_space
  "banquet.layout.capacity": "logistics", // moved from banquet_space
  "staff_estimate.estimate.availability": "logistics", // moved from cost
  "facility.general.no-overlap": "logistics",
  "facility.general.flow": "logistics",
  "facility.general.guest-room": "logistics",
  "facility.general.brides-room": "logistics",
  "facility.general.cloakroom": "logistics",
  "facility.general.nursing-room": "logistics",
  "facility.general.toilet": "logistics",
  "facility.general.accessibility": "logistics",
  "facility.general.smoking": "logistics",
  "facility.general.accommodation": "logistics",
  "facility.photo.general": "logistics",
  "facility.memo.overall": "logistics",
};

export function getChecklistItemsForDimension(dimension: Tier1Dimension): ChecklistPresetItem[] {
  return CHECKLIST_PRESETS.filter((item) => ITEM_TO_DIMENSION[item.id] === dimension);
}

export function getDimensionForPreset(presetId: string): Tier1Dimension {
  return ITEM_TO_DIMENSION[presetId] ?? "overall";
}

export { ITEM_TO_DIMENSION };
