import { describe, it, expect } from "vitest";
import { z } from "zod";

// Copy the schema from onboarding.ts for testing (schema is not exported)
const onboardingSchema = z.object({
  style: z.array(z.string()).optional(),
  guestCount: z.number().int().positive().optional(),
  area: z.array(z.string()).optional(),
  budget: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
  }).optional(),
});

describe("onboardingSchema", () => {
  it("accepts valid full answers", () => {
    const result = onboardingSchema.safeParse({
      style: ["チャペル", "ガーデン"],
      guestCount: 80,
      area: ["表参道"],
      budget: { min: 2000000, max: 4000000 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty/partial answers (all optional)", () => {
    expect(onboardingSchema.safeParse({}).success).toBe(true);
    expect(onboardingSchema.safeParse({ style: [] }).success).toBe(true);
  });

  it("rejects negative guest count", () => {
    const result = onboardingSchema.safeParse({ guestCount: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects zero guest count", () => {
    const result = onboardingSchema.safeParse({ guestCount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects budget with negative min", () => {
    const result = onboardingSchema.safeParse({ budget: { min: -1, max: 1000 } });
    expect(result.success).toBe(false);
  });

  it("rejects budget with zero max", () => {
    const result = onboardingSchema.safeParse({ budget: { min: 0, max: 0 } });
    expect(result.success).toBe(false);
  });

  it("accepts budget with zero min", () => {
    const result = onboardingSchema.safeParse({ budget: { min: 0, max: 1000000 } });
    expect(result.success).toBe(true);
  });

  it("rejects non-integer guest count", () => {
    const result = onboardingSchema.safeParse({ guestCount: 1.5 });
    expect(result.success).toBe(false);
  });
});
