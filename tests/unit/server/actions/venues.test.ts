import { describe, it, expect } from "vitest";
import { validateVenueInput } from "@/server/actions/venue-schema";

describe("validateVenueInput", () => {
  it("returns success for valid input", () => {
    const result = validateVenueInput({
      name: "ホテル椿山荘東京",
      location: "東京都文京区",
      capacityMin: 30,
      capacityMax: 150,
    });
    expect(result.success).toBe(true);
  });

  it("returns failure when name is empty", () => {
    const result = validateVenueInput({
      name: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = result.error.flatten();
      expect(flat.fieldErrors.name).toBeDefined();
    }
  });

  it("returns failure when capacityMin > capacityMax", () => {
    const result = validateVenueInput({
      name: "テスト式場",
      capacityMin: 100,
      capacityMax: 50,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = result.error.flatten();
      expect(flat.formErrors.length).toBeGreaterThan(0);
    }
  });
});
