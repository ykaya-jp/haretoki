import { describe, it, expect } from "vitest";
import { validateRatingInput } from "@/server/actions/rating-schema";

describe("validateRatingInput", () => {
  it("accepts valid ratings", () => {
    const result = validateRatingInput({
      ratings: {
        atmosphere: 4,
        hospitality: 5,
        cuisine: 3,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects score of 0 (below minimum)", () => {
    const result = validateRatingInput({
      ratings: {
        atmosphere: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects score of 6 (above maximum)", () => {
    const result = validateRatingInput({
      ratings: {
        atmosphere: 6,
      },
    });
    expect(result.success).toBe(false);
  });
});
