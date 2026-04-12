import { z } from "zod";

export const ratingSchema = z.object({
  ratings: z.record(
    z.string(),
    z
      .number()
      .int()
      .min(1, "1以上で評価してください")
      .max(5, "5以下で評価してください"),
  ),
});

export type RatingInput = z.infer<typeof ratingSchema>;

/** Pure validation -- no side effects */
export function validateRatingInput(input: unknown) {
  return ratingSchema.safeParse(input);
}
