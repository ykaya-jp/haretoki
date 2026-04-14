import { z } from "zod";

export const ratingSchema = z.object({
  ratings: z.record(
    z.string(),
    z
      .number()
      .multipleOf(0.5)
      .min(0.5, "0.5以上で評価してください")
      .max(5, "5以下で評価してください"),
  ),
});

export type RatingInput = z.infer<typeof ratingSchema>;

/** Pure validation -- no side effects */
export function validateRatingInput(input: unknown) {
  return ratingSchema.safeParse(input);
}
