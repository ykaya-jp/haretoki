import { z } from "zod";

/**
 * VenuePlan input schema.
 *
 * - `dressAllowance` (legacy free-text) is preserved for backwards compatibility
 *   when reading existing rows, but new submissions should use the structured
 *   `dressBrideCount` / `dressGroomCount` / `dressBudgetCapYen` columns plus
 *   `dressAllowanceNote` for any free-form note.
 * - Bounds on count/budget fields are intentionally generous but sanity-checked
 *   (e.g., 衣裳5着 / 上限1000万円) so a typo can't store wild values.
 */
export const planInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, "プラン名を入力してください"),
    basePrice: z.coerce.number().int().nonnegative().max(100_000_000).optional(),
    guestCountMin: z.coerce.number().int().nonnegative().max(1000).optional(),
    guestCountMax: z.coerce.number().int().nonnegative().max(1000).optional(),
    includedItems: z.array(z.string().min(1)).default([]),
    excludedItems: z.array(z.string().min(1)).default([]),
    bringInItems: z
      .array(
        z.object({
          item: z.string().min(1),
          fee: z.coerce.number().int().nonnegative().max(10_000_000).optional(),
        }),
      )
      .default([]),
    dressBrideCount: z.coerce.number().int().min(0).max(5).optional(),
    dressGroomCount: z.coerce.number().int().min(0).max(3).optional(),
    dressBudgetCapYen: z.coerce.number().int().nonnegative().max(10_000_000).optional(),
    dressAllowanceNote: z.string().max(2000).optional(),
    campaigns: z
      .array(
        z.object({
          name: z.string().min(1),
          discount: z.string().optional(),
        }),
      )
      .default([]),
    notes: z.string().max(4000).optional(),
  })
  .refine(
    (data) => {
      if (data.guestCountMin != null && data.guestCountMax != null) {
        return data.guestCountMin <= data.guestCountMax;
      }
      return true;
    },
    { message: "最小人数は最大人数以下にしてください" },
  );

export type PlanInput = z.infer<typeof planInputSchema>;

/** Pure validation — no side effects. Used by tests and server actions. */
export function validatePlanInput(input: unknown) {
  return planInputSchema.safeParse(input);
}
